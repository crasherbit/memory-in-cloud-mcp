import type Database from "better-sqlite3";
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { openDb } from "../shared/db.js";

const DATA_DIR = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : resolve(process.cwd(), "data");

const DB_PATH = join(DATA_DIR, "memory.db");

// Single shared SQLite database. Tenancy is optional, by the `workspace` column
// ("" = global, visible everywhere); there is no per-repo file.
let _db: Database.Database | null = null;
let inFlight = 0;

const NAME_RE = /^[a-z0-9-]+$/;

// Optional tenant key. Absent/empty → "" (global). When present it is validated
// and lowercased. A node tagged "" is visible from every workspace.
export function normalizeWorkspace(input?: string | null): string {
  if (input == null) return "";
  const w = String(input).trim().toLowerCase();
  if (w === "") return "";
  if (!NAME_RE.test(w)) {
    throw new Error(
      `Invalid workspace "${input}": only [a-z0-9-] allowed (lowercased)`
    );
  }
  return w;
}

export function dataDir(): string {
  return DATA_DIR;
}

export function dbPath(): string {
  return DB_PATH;
}

export function getDb(): Database.Database {
  if (!_db) _db = openDb(DB_PATH);
  return _db;
}

export function withDb<T>(
  fn: (db: Database.Database) => T | Promise<T>
): Promise<T> {
  const db = getDb();
  inFlight++;
  return Promise.resolve()
    .then(() => fn(db))
    .finally(() => {
      inFlight--;
    });
}

export function dbStats(): {
  path: string;
  size_bytes: number;
  in_flight: number;
} {
  let size = 0;
  if (existsSync(DB_PATH)) {
    try {
      size = statSync(DB_PATH).size;
    } catch {
      /* empty */
    }
  }
  return { path: DB_PATH, size_bytes: size, in_flight: inFlight };
}

// List the workspaces that currently have at least one node ("" = global).
export function listWorkspaces(db: Database.Database): Array<{
  workspace: string;
  nodes: number;
}> {
  return db
    .prepare(
      "SELECT workspace, COUNT(*) AS nodes FROM nodes GROUP BY workspace ORDER BY workspace"
    )
    .all() as Array<{ workspace: string; nodes: number }>;
}

// Delete every row belonging to a workspace, in one transaction.
export function dropWorkspace(
  db: Database.Database,
  workspace: string
): { deleted_nodes: number; deleted_missed: number; deleted_runs: number } {
  const tx = db.transaction(() => {
    const nodes = db
      .prepare("DELETE FROM nodes WHERE workspace = ?")
      .run(workspace).changes;
    const missed = db
      .prepare("DELETE FROM missed_queries WHERE workspace = ?")
      .run(workspace).changes;
    const runs = db
      .prepare("DELETE FROM ingest_runs WHERE workspace = ?")
      .run(workspace).changes;
    return { deleted_nodes: nodes, deleted_missed: missed, deleted_runs: runs };
  });
  return tx();
}

// SQL fragment + params for an optional workspace read filter. When a workspace
// is given, rows tagged with it OR global ("") match; when undefined, no filter.
export function workspaceFilter(workspace?: string): {
  clause: string;
  params: string[];
} {
  if (workspace == null || workspace === "") {
    return { clause: "", params: [] };
  }
  return { clause: "workspace IN (?, '')", params: [workspace] };
}

export function closeAll(): void {
  if (_db) {
    try {
      _db.close();
    } catch {
      /* empty */
    }
    _db = null;
  }
}
