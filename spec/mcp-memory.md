# MCP Memory — PoC Spec

## 1. Goal

Local Proof-of-Concept of an MCP server that gives Claude pre-computed context about a TypeScript monorepo, so Claude doesn't have to explore the codebase from scratch every session.

**Success criterion**: the user pastes a Jira ticket text in a Claude Code conversation → a project skill instructs Claude to invoke the MCP tool → the MCP returns relevant "Package cards" → Claude can immediately discuss the task with the right context, citing which packages it's focusing on.

The PoC is intentionally minimal: it must be enough to *decide* if the larger idea (Endpoint / Domain Entity / Past-Incident cards, Confluence/Jira ingestion, team-shared hosting, graph extraction) is worth building.

## 2. Explicitly out of scope (for PoC)

- Vector search / embeddings (keyword + entity match is enough for demo).
- LLM-based summarization of cards (mechanical extraction only).
- Confluence and Jira ingestion (tickets are pasted manually into chat).
- Endpoint, Domain Entity, Past-Incident cards (only Package cards).
- Auth, multi-user, hosting (all local).
- Webhook freshness or true cron (manual `ingest` command for PoC; cron can be wired by the user via an OS-level scheduler if desired).
- Tests (PoC validation is "paste ticket, see context"). A small unit test for the entity tokenizer may be added if cheap.

## 3. Architecture

One Node.js/TypeScript project with three runtime artifacts:

1. **Indexer** — CLI command that walks a monorepo and writes Package cards to SQLite.
2. **Storage** — SQLite file `data/memory.db`, one `packages` table + FTS5 virtual table.
3. **MCP server** — stdio MCP server exposing a single `get_context` tool.

Plus one config artifact:

4. **Skill** — project-level Claude Code skill (`.claude/skills/memory.md`) that tells Claude when to call the tool.

The MCP server is launched by Claude Code on demand via a project `.mcp.json` file. No long-running server process needs to be started manually.

## 4. Data model

### 4.1 Package card

The only card type in PoC. One per `package.json` found in the target repo (excluding `node_modules`, `dist`, `build`, `.git`).

```ts
type PackageCard = {
  name: string;              // package.json "name"
  path: string;              // dir relative to monorepo root
  description?: string;      // package.json "description"
  readme?: string;           // README.md content, truncated to ~2000 chars
  dependencies: string[];    // names from deps + devDeps (no versions)
  scripts: Record<string, string>;
  aliases: string[];         // derived, see §6
  entry_points: string[];    // top-level files in <path>/src/ if it exists
  updated_at: string;        // ISO timestamp of last ingest
};
```

### 4.2 SQLite schema (graph-shaped)

The schema is a property-graph over SQL: a generic `nodes` table + an `edges` table. In the PoC `nodes.type` only ever takes the value `'package'` and `edges.relation` only `'depends_on'`. Future card types (Endpoint, Domain Entity, Past-Incident) are added as new `type` values without schema changes.

```sql
CREATE TABLE nodes (
  id          INTEGER PRIMARY KEY,
  type        TEXT NOT NULL,            -- 'package' (only in PoC)
  name        TEXT NOT NULL,
  description TEXT,                     -- promoted for FTS
  readme      TEXT,                     -- promoted for FTS
  json_blob   TEXT NOT NULL,            -- full card payload (e.g. PackageCard)
  updated_at  TEXT NOT NULL,
  UNIQUE (type, name)
);
CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_name ON nodes(name);

CREATE TABLE node_aliases (
  alias    TEXT NOT NULL,
  node_id  INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  PRIMARY KEY (alias, node_id)
);
CREATE INDEX idx_node_aliases_alias ON node_aliases(alias);

CREATE TABLE edges (
  source_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  relation  TEXT NOT NULL,              -- 'depends_on' (only in PoC)
  PRIMARY KEY (source_id, target_id, relation)
);
CREATE INDEX idx_edges_source ON edges(source_id, relation);
CREATE INDEX idx_edges_target ON edges(target_id, relation);

CREATE VIRTUAL TABLE nodes_fts USING fts5(
  name, description, readme,
  content='nodes', content_rowid='id'
);

-- triggers to keep FTS in sync on insert/update/delete
```

**Why this shape now**: zero overhead vs a flat `packages` table, but the day a graph traversal *is* useful (e.g. "all tickets touching packages downstream of `auth-lib`") we already have the model. The same SQLite file can later be replicated to Kuzu/Neo4j without redesigning the data layer.

## 5. Indexer

CLI: `mise run ingest -- <repo-path>` (or `pnpm run ingest -- <repo-path>`)

Two-pass ingest (nodes first, then edges, because edges need node IDs).

**Pass 1 — nodes**:

1. Resolve `<repo-path>` to an absolute path. Fail loudly if it's not a directory.
2. Walk recursively, find every `package.json`. Skip `node_modules`, `dist`, `build`, `.next`, `.git`, `coverage`.
3. For each `package.json` found:
   - Parse it; skip if no `name` field.
   - Read sibling `README.md` if present; truncate to 2000 chars.
   - List top-level files of `src/` (one level only) as `entry_points`.
   - Compute `aliases` (§6).
   - Build a `PackageCard` payload.
4. Upsert into `nodes` (`type='package'`, key = `(type, name)`). Persist `description` and `readme` as columns; persist the full card as `json_blob`. On upsert, replace `node_aliases` rows for that node.

**Pass 2 — edges**:

5. For each ingested package, scan its `dependencies + devDependencies`. For each dep name, look up `nodes WHERE type='package' AND name = ?`. If found, upsert an edge `source=current, target=found, relation='depends_on'`. If not found (external lib), ignore.
6. Print a one-line summary per package, then a final count of nodes and edges.

Idempotent: re-running updates rows. Packages removed from disk since last ingest are NOT pruned in PoC (documented limitation). Edges from a re-ingested package are first deleted to avoid stale links.

## 6. Alias rules

Mechanical, no LLM. Given a package name `N`:

- Lowercase the name itself as an alias (so case-insensitive exact match works).
- Split on `-`. If the first segments match common prefixes (`interop-be`, `interop-fe`, `pagopa-be`, `pagopa-fe`), the alias is the remainder joined: `interop-be-token-generation-checker` → `token-generation-checker`.
- If the last segment is a known role suffix (`checker`, `worker`, `consumer`, `producer`, `bff`, `api`, `service`), keep it as an additional alias on its own.
- Acronym from segments of length ≥ 2 (first letter of each): `backend-for-frontend` → `bff`.

All aliases are stored lowercase. Conflicts (same alias maps to multiple packages) are allowed — the lookup returns all matches.

## 7. MCP server

Single tool.

### 7.1 Tool schema

```
name:        get_context
description: Retrieve pre-computed context (nodes) from the indexed monorepo
             that are relevant to the given task/ticket text. Call this at the start
             of any coding task that mentions a service, package, or codebase area.
input:  { text: string }   -- the task/ticket text, raw paste is fine
output: {
  matches: Array<{
    card:       PackageCard,                                  // node payload
    type:       "package",                                    // node type
    reason:     "exact_name" | "alias" | "fts",
    score:      number,
    links_out:  Array<{ relation: string, target_name: string }>  // 1-hop neighbors
  }>,
  total_indexed: number
}
```

`links_out` is populated at query time from the `edges` table — it gives Claude a "what's nearby" hint without us fetching the full neighbor cards. If Claude wants a neighbor's card, it can call `get_context` again with that name.

### 7.2 Retrieval logic

1. Tokenize `text`: split on whitespace and on most punctuation, but **keep `-` and `_`** inside tokens. Lowercase. Discard tokens of length < 3.
2. **Exact name match**: for each token, `SELECT * FROM nodes WHERE type='package' AND name = ?`. Score 1.0, reason `exact_name`.
3. **Alias match**: for each remaining token, `SELECT n.* FROM nodes n JOIN node_aliases a ON a.node_id = n.id WHERE a.alias = ?`. Score 0.8, reason `alias`.
4. **FTS fallback**: with the original text, run one FTS5 MATCH against `nodes_fts`. Score = normalized BM25 (mapped to [0, 0.6]), reason `fts`.
5. Merge by `node.id`, keep the highest-scoring reason per node, dedup.
6. Sort by score desc. Truncate to top 5.
7. For each surviving node, fetch outgoing edges:
   `SELECT e.relation, t.name FROM edges e JOIN nodes t ON t.id = e.target_id WHERE e.source_id = ?`. Embed in `links_out`.
8. Return cards with full JSON blob + `links_out`.

Token budget is implicit: top 5 cards × ~2KB each ≈ 10KB. No further pruning in PoC.

## 8. Skill

Path: `.claude/skills/memory/SKILL.md` (project-scoped Claude Code skill in the standard directory format, auto-discovered when Claude Code is opened in this project root).

Frontmatter `description` is what the harness uses to decide whether to activate the skill, so it must explicitly mention the trigger surfaces (Jira ticket text, error logs, package/service references) and the action (call `get_context` first). See the actual file for the final wording.

## 9. Project structure

```
.
├── spec/
│   └── mcp-memory.md          # this file
├── src/
│   ├── shared/
│   │   ├── db.ts              # open SQLite, run schema migrations
│   │   └── types.ts           # PackageCard + tool I/O types
│   ├── indexer/
│   │   ├── cli.ts             # `npm run ingest` entry (orchestrates 2 passes)
│   │   ├── discover.ts        # find package.json files
│   │   ├── extract.ts         # build PackageCard from a dir
│   │   ├── aliases.ts         # alias rules (§6)
│   │   ├── store.ts           # upsert nodes + node_aliases
│   │   └── edges.ts           # pass-2: build depends_on edges
│   └── server/
│       ├── cli.ts             # MCP server stdio entry
│       ├── tokenize.ts        # entity tokenizer (§7.2 step 1)
│       └── tools/
│           └── getContext.ts  # the single tool implementation
├── .claude/
│   └── skills/
│       └── memory/
│           └── SKILL.md
├── .mcp.json                  # registers the server with Claude Code
├── data/                      # SQLite DB lives here (gitignored)
├── package.json
├── tsconfig.json
└── .gitignore
```

## 10. Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "better-sqlite3":            "^11.0.0",
    "fast-glob":                 "^3.3.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node":           "^22.0.0",
    "tsx":                   "^4.0.0",
    "typescript":            "^5.5.0"
  }
}
```

No build step — `tsx` runs TS directly. Demo-speed priority.

## 11. .mcp.json

```json
{
  "mcpServers": {
    "memory": {
      "command": "pnpm",
      "args": ["exec", "tsx", "src/server/cli.ts"]
    }
  }
}
```

Toolchain (Node + pnpm versions) is pinned via `mise.toml`, so `pnpm` on PATH
resolves through mise shims.

## 12. Commands the user will run

(Claude does not run these — per policy.)

```bash
# one-time: install the toolchain pinned in mise.toml (node + pnpm)
mise install

# one-time: install JS deps
mise run install        # = pnpm install

# index a target monorepo (re-run any time)
mise run ingest -- /absolute/path/to/your/monorepo

# nothing else: when Claude Code is opened in this project's directory,
# .mcp.json launches the MCP server automatically, and the memory skill
# is auto-loaded.
```

Other mise tasks: `mise run server` (launch the MCP server manually over
stdio), `mise run inspector` (open the MCP Inspector UI against the local
server for manual tool calls).

## 13. Demo flow

1. User runs `npm install`.
2. User runs `npm run ingest -- /path/to/repo`. Indexer prints N packages indexed.
3. User opens Claude Code with CWD = this project's root (so the skill and `.mcp.json` are picked up).
4. User pastes a Jira ticket text in the conversation.
5. Skill triggers → Claude calls `get_context` → MCP returns up to 5 Package cards.
6. Claude states which packages are relevant and grounds the rest of the conversation in them.

If step 5 returns nothing useful for tickets that clearly mention services in the repo, the entity extraction or alias rules need adjustment — this is what the PoC is designed to surface.

## 14. Known limitations of the PoC (documented, not bugs)

- No pruning of packages deleted from disk on re-ingest.
- No vector search → tickets that reference concepts *not* by name will likely miss.
- README truncation at 2000 chars may drop relevant info for large READMEs.
- Aliases are heuristic; some real aliases used by the team may not be captured.
- No incremental ingest — full re-walk on every run (fine for PoC scale).

## 15. Follow-ups if the PoC is promising

In rough order of expected value:

1. Endpoint cards (route → handler discovery via TS AST).
2. Past-Incident cards (closed Jira tickets with extracted error fingerprints).
3. Vector index for fuzzy matches on concepts (sqlite-vec or similar).
4. Jira ingestion via REST API + webhook.
5. Domain Entity cards (extracted from OpenAPI / Zod schemas / DB schema).
6. Confluence ingestion.
7. Move from local SQLite to a hosted store; add auth; team-shared mode.
8. Populate richer edges (`implements_endpoint`, `documents`, `mentions`, `caused_by`) and enable multi-hop retrieval in `get_context` (already structurally supported by the `edges` table).
