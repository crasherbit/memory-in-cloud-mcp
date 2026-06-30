import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_DB_PATH = resolve(process.cwd(), "data/memory.db");

export function openDb(dbPath: string = DEFAULT_DB_PATH): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  migrateSchema(db);
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id          INTEGER PRIMARY KEY,
      workspace   TEXT NOT NULL DEFAULT '',
      type        TEXT NOT NULL,
      name        TEXT NOT NULL,
      description TEXT,
      readme      TEXT,
      json_blob   TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      UNIQUE (workspace, type, name)
    );
    CREATE INDEX IF NOT EXISTS idx_nodes_workspace ON nodes(workspace);
    CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(workspace, type);
    CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(workspace, name);

    CREATE TABLE IF NOT EXISTS node_aliases (
      alias    TEXT NOT NULL,
      node_id  INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      PRIMARY KEY (alias, node_id)
    );
    CREATE INDEX IF NOT EXISTS idx_node_aliases_alias ON node_aliases(alias);

    CREATE TABLE IF NOT EXISTS edges (
      source_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      target_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      relation  TEXT NOT NULL,
      PRIMARY KEY (source_id, target_id, relation)
    );
    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id, relation);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id, relation);
  `);
}

function migrateSchema(db: Database.Database): void {
  // 1. Enrichment columns (kept from v0.2 for backward-compat).
  ensureColumns(db, "nodes", [
    ["summary_ai", "TEXT"],
    ["keywords", "TEXT"],
    ["ticket_types", "TEXT"],
    ["provenance", "TEXT NOT NULL DEFAULT 'deterministic'"],
    ["enrichment_hash", "TEXT"],
  ]);

  // 2. v0.3 provenance columns (additive, all nullable). `repo` is the tenant
  // scope key and lives in the base schema (NOT NULL); the rest are origin metadata.
  ensureColumns(db, "nodes", [
    ["branch", "TEXT"],
    ["commit_sha", "TEXT"],
    ["source_kind", "TEXT"],
    ["source_file", "TEXT"],
    ["source_url", "TEXT"],
    ["ingest_run_id", "TEXT"],
    ["agent_id", "TEXT"],
  ]);

  // 3. FTS5 with extended columns (unchanged from v0.2).
  let ftsHasNewCols = false;
  try {
    const ftsCols = db
      .prepare("SELECT * FROM nodes_fts LIMIT 0")
      .columns()
      .map((c) => c.name);
    ftsHasNewCols =
      ftsCols.includes("summary_ai") && ftsCols.includes("keywords");
  } catch {
    ftsHasNewCols = false;
  }
  if (!ftsHasNewCols) {
    db.exec(`
      DROP TRIGGER IF EXISTS nodes_ai;
      DROP TRIGGER IF EXISTS nodes_au;
      DROP TRIGGER IF EXISTS nodes_ad;
      DROP TABLE IF EXISTS nodes_fts;

      CREATE VIRTUAL TABLE nodes_fts USING fts5(
        name, description, readme, summary_ai, keywords,
        content='nodes', content_rowid='id'
      );

      INSERT INTO nodes_fts(rowid, name, description, readme, summary_ai, keywords)
        SELECT id, name, description, readme, summary_ai, keywords FROM nodes;

      CREATE TRIGGER nodes_ai AFTER INSERT ON nodes BEGIN
        INSERT INTO nodes_fts(rowid, name, description, readme, summary_ai, keywords)
        VALUES (new.id, new.name, new.description, new.readme, new.summary_ai, new.keywords);
      END;

      CREATE TRIGGER nodes_ad AFTER DELETE ON nodes BEGIN
        INSERT INTO nodes_fts(nodes_fts, rowid, name, description, readme, summary_ai, keywords)
        VALUES ('delete', old.id, old.name, old.description, old.readme, old.summary_ai, old.keywords);
      END;

      CREATE TRIGGER nodes_au AFTER UPDATE ON nodes BEGIN
        INSERT INTO nodes_fts(nodes_fts, rowid, name, description, readme, summary_ai, keywords)
        VALUES ('delete', old.id, old.name, old.description, old.readme, old.summary_ai, old.keywords);
        INSERT INTO nodes_fts(rowid, name, description, readme, summary_ai, keywords)
        VALUES (new.id, new.name, new.description, new.readme, new.summary_ai, new.keywords);
      END;
    `);
  }

  // 4. Missed queries (v0.2).
  db.exec(`
    CREATE TABLE IF NOT EXISTS missed_queries (
      id          INTEGER PRIMARY KEY,
      workspace   TEXT NOT NULL DEFAULT '',
      query_text  TEXT NOT NULL,
      notes       TEXT,
      reported_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_missed_queries_reported ON missed_queries(workspace, reported_at);
  `);
  ensureColumns(db, "missed_queries", [["workspace", "TEXT NOT NULL DEFAULT ''"]]);

  // 5. Vector embeddings table (v0.2). Kept for back-compat, not used by v0.3.
  db.exec(`
    CREATE TABLE IF NOT EXISTS node_vectors (
      node_id     INTEGER PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
      vec         BLOB NOT NULL,
      dim         INTEGER NOT NULL,
      model       TEXT NOT NULL,
      embed_hash  TEXT NOT NULL,
      embedded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 6. v0.3: ingest_runs (bundle dedup + audit).
  db.exec(`
    CREATE TABLE IF NOT EXISTS ingest_runs (
      id            TEXT PRIMARY KEY,
      workspace     TEXT NOT NULL DEFAULT '',
      payload_hash  TEXT NOT NULL,
      source_kind   TEXT NOT NULL,
      source_file   TEXT,
      branch        TEXT,
      commit_sha    TEXT,
      nodes_count   INTEGER NOT NULL,
      edges_count   INTEGER NOT NULL,
      warnings      TEXT,
      ingested_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ingest_runs_at   ON ingest_runs(workspace, ingested_at);
    CREATE INDEX IF NOT EXISTS idx_ingest_runs_hash ON ingest_runs(workspace, payload_hash);
  `);
  ensureColumns(db, "ingest_runs", [["workspace", "TEXT NOT NULL DEFAULT ''"]]);
}

function ensureColumns(
  db: Database.Database,
  table: string,
  cols: Array<[string, string]>
): void {
  const existing = new Set(
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
      (c) => c.name
    )
  );
  for (const [name, type] of cols) {
    if (!existing.has(name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    }
  }
}

// Trim the missed_queries table for a given workspace to a max of `cap` rows (FIFO).
export function capMissedQueries(
  db: Database.Database,
  workspace: string,
  cap: number
): void {
  db.prepare(
    `DELETE FROM missed_queries
       WHERE id IN (
         SELECT id FROM missed_queries
          WHERE workspace = ?
          ORDER BY id ASC
          LIMIT MAX(0, (SELECT COUNT(*) FROM missed_queries WHERE workspace = ?) - ?)
       )`
  ).run(workspace, workspace, cap);
}
