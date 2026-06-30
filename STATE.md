# Stato attuale — MCP-MEM v0.3.0

_Aggiornato: 2026-06-30_

Snapshot tecnico dello stato corrente della repo dopo il riordino. Per l'uso
operativo vedi [`README.md`](./README.md); per la specifica completa vedi
[`spec/mcp-mem-v0.3.md`](./spec/mcp-mem-v0.3.md).

## Cos'è

Server MCP remoto che espone un **graph-store "dumb" + FTS keyword** su
conoscenza cross-source (codice, PR, Jira, Confluence…). Zero LLM e zero servizi
a pagamento lato server: tutta l'intelligenza vive negli agenti chiamanti
(l'ingest agent arricchisce con il proprio LLM, Claude Code interroga e corregge
con il proprio piano). **Un solo DB SQLite** (`data/memory.db`). Lo scoping è
**opzionale**: ogni nodo può portare un tag `workspace`; se lo ometti il nodo è
**globale** (visibile da ogni workspace). In lettura, filtrare per `workspace=X`
ritorna `X` + i globali; senza filtro vedi tutto. Niente repo nell'URL.

## Architettura

Tre aree sotto `src/`, più la spec:

```
src/
├── server/      server HTTP MCP (Hono) — la "dumb store"
├── cli/         ingest client di riferimento (deriva package/area + push bundle)
└── shared/      schema, tipi, canonicalizzazione, hashing, accesso DB
```

### `src/server/` — il server MCP
| File | Ruolo |
|---|---|
| `cli.ts` | entrypoint: monta Hono, middleware, transport, admin; legge `API_KEY` / `PORT` / `DATA_DIR` |
| `transport/http.ts` | transport Streamable HTTP MCP; registra i tool e li instrada |
| `dbPool.ts` | connessione singleton al DB unico (`memory.db`); `normalizeWorkspace`, `workspaceFilter`, helper `listWorkspaces`/`dropWorkspace` |
| `admin.ts` | route admin: `/stats`, `/stats/workspace`, `/admin/prune`, `/admin/workspace` (DELETE); `workspace` come query param opzionale |
| `middleware/auth.ts` | bearer auth (`API_KEY` + `API_KEY_PREVIOUS`), separa `ADMIN_KEY` |
| `tokenize.ts` | tokenizer per lookup esatto/alias |
| `tools/` | gli 8 tool MCP (sotto) |

**Tool MCP** (`src/server/tools/`), esposti su un unico endpoint `/mcp`:
`get_context` (read, retrieval multi-branch), `report_miss` (log delle query a
vuoto), `ingest_bundle` (write bulk validato), `upsert_node`, `add_link`,
`add_alias`, `remove_link`, `remove_node` (correzioni puntuali). **Ogni tool
accetta un argomento opzionale `workspace`**: in lettura filtra (workspace +
globali), in scrittura tagga il nodo (assente → globale).

### `src/cli/` — ingest client di riferimento
| File | Ruolo |
|---|---|
| `cli.ts` | entrypoint CLI: orchestra scan monorepo + parsing filesExt + push bundle |
| `discover.ts` | trova i `package.json` nel monorepo |
| `extract.ts` | estrae `package` node + edge `depends_on` |
| `repoMap.ts` | parsa `filesExt/repo-map/*.md` → `area` node + edge `contains`/`depends_on_area` |
| `buildBundles.ts` | assembla i bundle canonici dai dati derivati |
| `aliases.ts` | helper di convenzione Pagopa (opzionale, solo lato CLI) |

I nodi ad alto valore cross-source (PR, feature, endpoint) **non** li produce
questa CLI: li produce un **ingest agent** guidato dalla skill
`mem-ingest` (`.claude/skills/mem-ingest/SKILL.md`), che emette bundle `*.json`
canonici (esempio: `spec/examples/bundle-comments.json`).

### `src/shared/` — schema e utility condivise
| File | Ruolo |
|---|---|
| `bundleSchema.ts` | schema Zod del bundle di ingest (`SCHEMA_VERSION_CURRENT = "1.0"`) |
| `types.ts` / `nodeTypes.ts` | tipi delle card (`package`, `area`, `pr`, `feature`, `endpoint`) |
| `canonicalize.ts` | canonicalizzazione degli endpoint (signature/verb) |
| `payloadHash.ts` | hashing del payload per upsert idempotenti |
| `db.ts` | schema SQLite + FTS5, migrazioni idempotenti, accesso DB |

## Build, run, ingest

Task `mise` (vedi `mise.toml`) e script npm equivalenti (`package.json`):

| Task | Comando | Note |
|---|---|---|
| install | `mise run install` | `pnpm install` |
| typecheck | `mise run typecheck` | `tsc --noEmit` |
| build | `mise run build` | compila in `dist/` (`tsconfig.build.json`) |
| serve (dev) | `mise run serve` | server via `tsx`, legge env |
| start (prod) | `mise run start` | esegue `dist/server/cli.js` |
| ingest-client | `mise run ingest-client -- …` | client di ingest di riferimento |
| inspector | `mise run inspector` | MCP Inspector contro il server locale |

Toolchain: Node 22, pnpm 10. Runtime dev via `tsx`, build di produzione via
`tsc`. Dipendenze: Hono + `@hono/node-server` (HTTP), `@modelcontextprotocol/sdk`
(MCP), `better-sqlite3` (store), `fast-glob` (scan), `zod` (validazione).

## Deploy

`Dockerfile` multi-stage: compila TS → `dist/`, prune a sole prod-deps, esegue
come utente non-root `node` con HEALTHCHECK su `/healthz`. Pensato dietro nginx
(TLS + forward del real client IP per il rate limiter). Transport stateless → no
sticky session. Dati persistiti in `/app/data` (un solo `memory.db`), da
backuppare. Env: `API_KEY` (obbligatoria), `API_KEY_PREVIOUS`, `ADMIN_KEY`,
`PORT` (8080), `DATA_DIR` (`./data`).

## Layout repo

```
.
├── README.md                 # uso operativo (run, ingest, deploy, env, admin)
├── STATE.md                  # questo file
├── Dockerfile                # build multi-stage di produzione
├── mise.toml / package.json  # task + dipendenze
├── tsconfig.json / .build.json
├── .mcp.json                 # config client MCP di esempio
├── spec/
│   ├── mcp-mem-v0.3.md       # specifica corrente (unica spec attiva)
│   └── examples/bundle-comments.json
├── src/{server,cli,shared}/  # vedi sopra
└── .claude/skills/{memory,mem-ingest}/  # skill read-side e write-side
```

Ignorati da git (locali, rigenerati per run): `node_modules/`, `dist/`, `data/`
(DB SQLite di runtime), `filesExt/` e `bundles/` (input/output del workflow di
ingest), `appunti.md`, `.claude/settings.local.json`.

## Pulizia effettuata (2026-06-30)

Rimossi artefatti storici/scratch superati dalla v0.3:
- `spec/mcp-memory.md` (spec v0.1), `CHANGES.md` (delta v0.2), `REPORT.md`
  (vecchio report A/B che referenziava file già cancellati) — tracciati in git;
- `appunti.md` (note personali) e `bundles/QA-REPORT.md` (gitignored);
- DB runtime in `data/` (`local__dev.db`, `memory.db` + `-shm`/`-wal`).

Aggiornata la riga di lineage in `spec/mcp-mem-v0.3.md` (non punta più ai file
rimossi). Riorganizzazione precedente già in staging: `repo-map/` → `filesExt/repo-map/`,
`src/indexer/` → `src/cli/`, rimozione di `scripts/query.ts`.

## Modello di storage/scope (2026-06-30)

Due passaggi nello stesso giorno:
1. da **1 file SQLite per repo** → **DB unico** (`data/memory.db`);
2. da scope obbligatorio `repo` nell'URL → **scope `workspace` opzionale** in colonna.

Stato attuale: endpoint MCP unico `/mcp` (niente `:org/:repo`). La colonna
`workspace` (`'' ` = globale) è su `nodes`, `missed_queries`, `ingest_runs`;
unicità nodi `UNIQUE(workspace, type, name)`. `workspace` è un argomento
opzionale di ogni tool e un query param opzionale sulle route admin. Rimosso
`src/server/middleware/scope.ts`. `.mcp.json` punta a `/mcp`. Non ancora
typecheckato/buildato (policy: lancia tu `mise run typecheck`).
