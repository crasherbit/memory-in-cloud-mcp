import type Database from "better-sqlite3";
import { capMissedQueries } from "../../shared/db.js";

const MISSED_QUERIES_CAP = 1000;

export type ReportMissResult = {
  logged: true;
  id: number;
  total_misses: number;
};

export function reportMiss(
  db: Database.Database,
  workspace: string,
  query: string,
  notes?: string
): ReportMissResult {
  const res = db
    .prepare(
      "INSERT INTO missed_queries (workspace, query_text, notes) VALUES (?, ?, ?) RETURNING id"
    )
    .get(workspace, query, notes ?? null) as { id: number };

  capMissedQueries(db, workspace, MISSED_QUERIES_CAP);

  const total = (
    db
      .prepare("SELECT COUNT(*) AS c FROM missed_queries WHERE workspace = ?")
      .get(workspace) as {
      c: number;
    }
  ).c;

  return { logged: true, id: res.id, total_misses: total };
}
