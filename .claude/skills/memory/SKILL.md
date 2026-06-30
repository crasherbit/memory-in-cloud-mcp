---
name: memory
description: Use at the start of any coding task that references a service, package, endpoint, PR, feature, library, DB table, or domain entity from the indexed monorepo (typical inputs are Jira ticket texts, error logs, free-text task descriptions). The skill instructs Claude to call mcp__memory__get_context first so it can ground its work in pre-computed cards instead of exploring the codebase blind.
---

# Memory skill (v0.3)

The `memory` MCP server is a dumb graph-store + FTS over curated cross-source knowledge (code, PRs, Jira, Confluence, …). It returns cards for 5 node types: `package`, `area`, `pr`, `feature`, `endpoint`. The server has no LLM, no scoring magic; intelligence lives in you, the caller.

### Optional `workspace` scope

Every tool accepts an optional `workspace` argument (a tenant id). Knowledge is **global by default** — omit `workspace` and you read across everything. Pass `workspace: "<id>"` only when you want to narrow to one tenant; a scoped read still includes global items (`workspace + global`). Most callers can ignore this and never pass it.

## Read flow

Before starting a task that may touch known code, PRs, features, endpoints or domain knowledge:

1. Call `mcp__memory__get_context` with the user's full task text (do **not** pre-summarize — retrieval relies on literal entity names).

   Optional params (use when needed):
   - `limit` (1-50, default 6)
   - `types_filter` (e.g. `["pr", "feature"]` if you only want change-history)
   - `min_score` (filter weak matches)
   - `workspace` (narrow to one tenant; omit for global — see above)

2. Read each `match`. The discriminator is `match.type`:
   - `package` → `card` is a Package card (name, path, dependencies, scripts, README excerpt)
   - `area` → Area card (purpose, key paths, depends-on areas, owner)
   - `pr` → PR card (number, title, summary, body_md, jira_keys, author, state, touches[], source_url)
   - `feature` → Feature card (slug, title, summary, body_md, jira_keys, pr_numbers[])
   - `endpoint` → Endpoint card (signature canonical, verb, path with `{1}`/`{2}`, description, introduced_by_pr)

3. Each match exposes `signals` (raw):
   - `exact_name` (bool) — a token in the query matched this node's `name` exactly
   - `alias_hits[]` — which aliases matched
   - `fts_bm25` — raw BM25 from SQLite FTS5 (**lower is better**)
   - `fts_hits[]` — which tokens fed into FTS

   `score` is a 0-1 derived rank you can ignore if you want to combine signals yourself.

4. `links_out` are outgoing edges (this node depends on / contains / touches those); `links_in` are inverse edges (those nodes depend on / contain / link to this). Edge `relation` is a free-form string — read the convention from the source kind.

5. State in 1 short sentence which package(s)/area(s)/PR(s)/feature(s)/endpoint(s) you've identified as relevant, citing them by name. Then continue with the task.

## Write flow (new in v0.3)

When you discover information that the index is missing, you can write it back:

- `mcp__memory__upsert_node({ type, name, title, summary, body_md, summary_ai, keywords, aliases, extra, source_url, links })` — create or update any node. Last-writer-wins on the whole record. For `endpoint`, the server canonicalizes the path (`{eServiceId}` → `{1}`).
- `mcp__memory__add_link({ source_type, source_name, target_type, target_name, relation })` — add an edge.
- `mcp__memory__add_alias({ node_type, node_name, alias })` — add an alias.
- `mcp__memory__remove_link({...})` / `mcp__memory__remove_node({ type, name })` — undo your own mistakes.

These writes get `source_kind: "claude_runtime"` automatically; you don't need to specify it. Each write also accepts an optional `workspace` (omit → global). Use them sparingly and only when you are confident — what you write becomes index ground truth for the next call.

## Miss flow

If `get_context` returned nothing useful (empty `matches` or all unrelated), call `mcp__memory__report_miss({ query, notes? })` once. Then proceed normally.

Do NOT call `report_miss` to express dissatisfaction with cards that are actually relevant.
