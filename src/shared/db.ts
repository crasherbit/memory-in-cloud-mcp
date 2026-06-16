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
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id          INTEGER PRIMARY KEY,
      type        TEXT NOT NULL,
      name        TEXT NOT NULL,
      description TEXT,
      readme      TEXT,
      json_blob   TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      UNIQUE (type, name)
    );
    CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
    CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(name);

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

    CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
      name, description, readme,
      content='nodes', content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS nodes_ai AFTER INSERT ON nodes BEGIN
      INSERT INTO nodes_fts(rowid, name, description, readme)
      VALUES (new.id, new.name, new.description, new.readme);
    END;

    CREATE TRIGGER IF NOT EXISTS nodes_ad AFTER DELETE ON nodes BEGIN
      INSERT INTO nodes_fts(nodes_fts, rowid, name, description, readme)
      VALUES ('delete', old.id, old.name, old.description, old.readme);
    END;

    CREATE TRIGGER IF NOT EXISTS nodes_au AFTER UPDATE ON nodes BEGIN
      INSERT INTO nodes_fts(nodes_fts, rowid, name, description, readme)
      VALUES ('delete', old.id, old.name, old.description, old.readme);
      INSERT INTO nodes_fts(rowid, name, description, readme)
      VALUES (new.id, new.name, new.description, new.readme);
    END;
  `);
}
