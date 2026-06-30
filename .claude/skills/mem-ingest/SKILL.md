---
name: mem-ingest
description: Use when populating the MCP-MEM server with cross-source knowledge — converting cartographer repo-map files, PR/comments crawler output (comments.md), Jira exports, or GitHub PR data into canonical ingest bundles and pushing them. This is the WRITE side of MCP-MEM (the read side is the `memory` skill). Trigger when asked to "ingest", "populate the memory server", "load repo-map/comments into MCP-MEM", or when running as an ingest agent in the discovery workflow.
---

# mem-ingest skill

You are acting as an **ingest agent** for MCP-MEM. Your job: turn raw project
knowledge into **canonical bundles** (nodes + edges, with multilingual
enrichment) and load them into the server. The server is dumb (graph + FTS, no
LLM) — **all the intelligence is yours**: you write the synonyms, summaries and
links that make retrieval work later.

Spec: `spec/mcp-mem-v0.3.md` (§4 data model, §6.4 `ingest_bundle`, §12 transform
standard). Reference output: `spec/examples/bundle-comments.json`.

## Node types & identity

| type | `name` (identity, lowercased server-side) | typical source |
|---|---|---|
| `package` | npm name (`catalog-process`) | monorepo `package.json` |
| `area` | `area_id` (`04-catalog-domain`) | `repo-map/NN-*.md` |
| `pr` | PR number as string (`3059`) | `comments.md`, GitHub |
| `feature` | stable slug (`suffissi-template-eservice`) | `comments.md`, Jira epic |
| `endpoint` | `VERB /path` (canonicalized server-side) | `comments.md`, OpenAPI |

## Recommended edges

`pr -touches-> package` · `feature -includes-> pr` · `endpoint -introduced_by-> pr`
· `endpoint -belongs_to-> package` · `area -contains-> package` ·
`area -depends_on_area-> area` · `package -depends_on-> package`.
`relation` is a free string — these are conventions, not enforced.

## Enrichment rules (this is where the value is)

For every node:
- **`summary`**: 1-2 sentence human summary (original language ok).
- **`summary_ai`**: a denser restatement optimized for retrieval (indexed in FTS).
- **`keywords`**: the highest-leverage field. Include **bilingual it/en synonyms**,
  domain terms, Jira keys, event names, acronyms. This is what makes a query like
  "firmare documenti" find `documents-signer`. Be generous (10-20 terms). Include
  **flexed verb forms** in both languages (firma / firmare / firmato; sign /
  signing / signed) — FTS5 does not stem, so each surface form must be present.
- **`aliases`**: short exact-match handles (Jira keys, camelCase identifiers,
  event names). Jira keys in `extra.jira_keys` are auto-added as aliases by the
  server, but adding them here too is harmless.
- **`extra`**: structured metadata (`jira_keys`, `author`, `state`,
  `files_count`, `introduced_by_pr`, `epic_key`, …). Free-form object.
- **`source_url`** when you have one (e.g. the GitHub PR URL).

Endpoints: pass the path in its natural form
(`POST /templates/eservices/{eServiceId}/instanceLabel/update`). The server
canonicalizes to positional params (`{1}`) and stores the original mapping.

## Per-source transform

**`repo-map/NN-*.md` (cartographer)** — 1 file = 1 `area` node.
- `source_kind: "cartographer"`, `source_file: "repo-map/NN-slug.md"`.
- Edges: `contains` (→ package by basename of each key path), `depends_on_area`.
- Do **not** truncate `body_md` (use the full markdown).
- Note: the reference CLI (`src/cli/buildBundles.ts`) already builds area +
  package bundles deterministically. Only hand-author area bundles if you are
  adding enrichment the CLI can't (e.g. richer keywords) or working without the CLI.

**`comments.md` (crawler)** — 1 file = 1 bundle: 1 `feature` + N `pr` + M `endpoint`.
- `source_kind: "crawler"`, `source_file: "comments.md"`.
- `feature` slug = stable kebab-case from the epic title.
- One `pr` node per PR row; `name` = the PR number string; `touches` edges to the
  packages from the "Touched Paths" column (use the **package basename**, e.g.
  `packages/catalog-process` → `catalog-process`, so edges resolve to package nodes).
- `endpoint` nodes for any REST endpoint mentioned in prose; link `introduced_by`
  the PR and `belongs_to` the package. If endpoints are ambiguous, omit them on the
  first pass — they can be added later via `upsert_node` from chat.
- `feature -includes-> pr` for every PR in the epic.

**Jira / GitHub (when wired into the workflow)** — same `pr` / `feature` shapes;
set `source_kind: "crawler"` (or `"manual"` for hand-curated), `source_url` to the
canonical link, and put ticket metadata in `extra`.

## Bundle envelope (§6.4)

```jsonc
{
  "schema_version": "1.0",                 // required
  "bundle_id": "crawler/<iso-ts>/<slug>",  // required, unique idempotency key
  "branch": "develop",
  "commit_sha": "abc123",                  // optional
  "source_kind": "crawler",                // package_json|cartographer|crawler|manual|claude_runtime
  "source_file": "comments.md",
  "ingested_at": "2026-06-24T10:00:00Z",   // optional
  "replace_edges": true,                   // default true; removes prior edges of
                                           // THIS source_kind for each node before re-adding
  "nodes": [ /* … */ ]
}
```

`bundle_id` must be **unique per logical ingest**. Re-sending the same id is a
no-op (idempotent). Re-sending the same content under a new id returns a
`duplicate_payload` warning but still ingests.

## How to load

Two interchangeable paths:

1. **Write bundle files, then push with the CLI** (preferred for offline /
   workflow runs, and the only path when the server isn't running yet):
   - Emit one `*.json` file per bundle into a folder (e.g. `spec/examples/` or a
     scratch `bundles/` dir).
   - The operator runs:
     `mise run ingest-client -- --bundles <abs path to folder> --api-key <key>`
   - You can also combine `--monorepo` / `--filesExt` in the same run.
   - Optional `--workspace <id>` tags every node of the run with a tenant scope
     ([a-z0-9-]). **Omit it and the nodes are global** (visible from every
     workspace) — that is the right default for shared cross-source knowledge.

2. **Push directly via MCP** when the server is already running and the `memory`
   MCP server is configured: call `mcp__memory__ingest_bundle` with the bundle
   object as arguments. For small corrections use `upsert_node` / `add_link` /
   `add_alias` instead of a whole bundle. To scope a write, add an optional
   `workspace` field to the arguments; omit it for global.

## Validate before you trust it

- Every `links[].target_name` should resolve to a node that exists (same bundle or
  already ingested) — otherwise the server records a `warnings` entry and skips
  that edge. Ingest package/area bundles **before** crawler bundles so `touches`
  edges land.
- After ingest, sanity-check with the read side: `mcp__memory__get_context` with a
  couple of representative queries, and `GET /stats` (or
  `GET /stats/workspace?workspace=<id>`) for counts.
