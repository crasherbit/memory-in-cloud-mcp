# MCP-MEM v0.3

Remote MCP server providing a dumb graph-store + FTS over cross-source knowledge (code, PRs, Jira, Confluence, …). A **single SQLite database** (`data/memory.db`) holds everything. Tenancy is **optional**: each node may carry a `workspace` tag — pass one to scope, omit it and the node is **global** (visible from every workspace). Nothing about a repo is baked into the URL. Zero LLM and zero paid services on the server side — all intelligence lives in the calling agents (ingest agent enriches with its own LLM; Claude Code queries and corrects with its own plan).

Spec: [`spec/mcp-mem-v0.3.md`](./spec/mcp-mem-v0.3.md).

---

## Run locally

```bash
mise run install
API_KEY=local-dev-token mise run serve
# → http://localhost:8080
```

Health: `curl http://localhost:8080/healthz`.

## Ingest from filesExt + monorepo

```bash
mise run ingest-client -- \
  --monorepo /abs/path/to/monorepo \
  --filesExt /Users/Shared/workspace/work/BUILDO/MCP-MEM/filesExt \
  --bundles /abs/path/to/prebuilt-bundles \
  --api-key local-dev-token
  # optional: --workspace <id> to tag the ingested nodes (omit → global)
```

The CLI:
- scans `--monorepo` for `package.json` → `package` nodes + `depends_on` edges (with keyword enrichment)
- parses `<filesExt>/repo-map/*.md` → `area` nodes + `contains` / `depends_on_area` edges
- loads any `*.json` in `--bundles` (validated against the canonical schema) — this
  is how PR / feature / endpoint bundles produced from `comments.md`, Jira or GitHub
  enter the system
- POSTs each bundle to the server via MCP `ingest_bundle`

At least one of `--monorepo` / `--filesExt` / `--bundles` is required.

### Producing cross-source bundles (PR / feature / endpoint)

`package` and `area` nodes are derived deterministically. The high-value
cross-source nodes (PRs, features, endpoints from `comments.md`, Jira, GitHub)
are produced by an **ingest agent** driven by the `mem-ingest` skill
(`.claude/skills/mem-ingest/SKILL.md`). The agent reads the raw sources, emits
canonical bundle `*.json` files (see `spec/examples/bundle-comments.json`), and
those are loaded via `--bundles` or pushed directly via the `ingest_bundle` MCP
tool. Wire this agent (or one agent per source) into the discovery workflow so the
server is refreshed on each run.

## Use from Claude Code

`.mcp.json`:
```json
{
  "mcpServers": {
    "memory": {
      "url": "http://localhost:8080/mcp",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer ${MCP_MEM_KEY}",
        "X-Agent-Id": "claude-code:${USER}"
      }
    }
  }
}
```

Export `MCP_MEM_KEY=local-dev-token` in the shell that launches Claude Code.

The `.claude/skills/memory/SKILL.md` describes the tools (`get_context`, `report_miss`, `upsert_node`, `add_link`, `add_alias`, `remove_link`, `remove_node`). Every tool accepts an optional `workspace` argument: on read it filters to that workspace **plus** global items; on write it tags the node (omit → global).

## Deploy on a Linux server (Ansible + nginx)

The image is multi-stage: it compiles TypeScript to `dist/`, prunes to prod deps,
and runs the compiled server as the non-root `node` user with a `/healthz`
HEALTHCHECK.

```bash
# build & run via Docker
docker build -t mcp-mem:0.3 .
docker run -d \
  --name mcp-mem \
  -p 127.0.0.1:8080:8080 \
  -e API_KEY="$(openssl rand -hex 32)" \
  -e ADMIN_KEY="$(openssl rand -hex 32)" \
  -v /srv/mcp-mem/data:/app/data \
  --restart unless-stopped \
  mcp-mem:0.3
```

Bind to `127.0.0.1` and let **nginx** terminate TLS and reverse-proxy to it.
Stateless transport → no sticky sessions needed.

**nginx must forward the real client IP** (the rate limiter keys on it):

```nginx
location / {
    proxy_pass         http://127.0.0.1:8080;
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_http_version 1.1;
}
```

**Ansible**: deploy as (1) build & push image to your registry, or build on host;
(2) template the systemd unit / `docker run` with `API_KEY` + `ADMIN_KEY` pulled
from Vault/ansible-vault (never commit them); (3) template the nginx vhost above
with your TLS cert; (4) mount `/srv/mcp-mem/data` as a persistent volume and back
it up (a single `memory.db` holds all repos — `sqlite3 .backup` or copy with WAL
checkpoint).

### Run without Docker (compiled)

```bash
mise run build          # → dist/
API_KEY=... ADMIN_KEY=... mise run start
```

### Key rotation

```bash
# Step 1: set both keys
docker run ... -e API_KEY="<new>" -e API_KEY_PREVIOUS="<old>" ...
# Step 2: redistribute new key to team .mcp.json files
# Step 3: drop API_KEY_PREVIOUS on the next restart
```

## Environment

| Var | Required | Default | Notes |
|---|---|---|---|
| `API_KEY` | yes | — | Bearer token for read/write routes. Server refuses requests if empty. |
| `API_KEY_PREVIOUS` | no | — | Transitional second token accepted alongside `API_KEY`. |
| `ADMIN_KEY` | recommended | — | Separate token required for destructive admin routes (prune, drop workspace). If unset, those routes fall back to `API_KEY` (logged as a warning). Set a distinct value in shared deployments. |
| `PORT` | no | `8080` | HTTP listen port. |
| `DATA_DIR` | no | `./data` | Holds the single `memory.db` (everything, optionally scoped by the `workspace` column). |

## Admin

| Endpoint | Method | Notes |
|---|---|---|
| `/healthz` | GET | open |
| `/stats` | GET | bearer; db file + per-workspace node counts (`""` = global) |
| `/stats/workspace?workspace=<id>` | GET | bearer; per-workspace metrics + recent runs (omit `workspace` → global bucket) |
| `/admin/prune` | POST | **ADMIN_KEY**; query params `workspace` / `source_kind` / `agent_id` / `older_than` (e.g. `30d`); at least one required |
| `/admin/workspace?workspace=<id>` | DELETE | **ADMIN_KEY**; requires `?confirm=<id>` (or `confirm=global` for the global bucket); deletes all rows for that workspace (nodes + missed_queries + ingest_runs) in one transaction |

## License & contributing

Internal PoC, no license. Reach the maintainer before reusing.
