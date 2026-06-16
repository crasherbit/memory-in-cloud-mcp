import type Database from "better-sqlite3";
import type { UpsertedNode } from "./store.js";

const RELATION = "depends_on";

export function rebuildDependsOnEdges(
  db: Database.Database,
  ingested: UpsertedNode[]
): number {
  const idByName = new Map<string, number>();
  for (const { id, card } of ingested) {
    idByName.set(card.name.toLowerCase(), id);
  }

  const deleteEdges = db.prepare(
    "DELETE FROM edges WHERE source_id = ? AND relation = ?"
  );
  const insertEdge = db.prepare(
    "INSERT OR IGNORE INTO edges (source_id, target_id, relation) VALUES (?, ?, ?)"
  );

  let inserted = 0;
  for (const { id, card } of ingested) {
    deleteEdges.run(id, RELATION);
    for (const dep of card.dependencies) {
      const targetId = idByName.get(dep.toLowerCase());
      if (targetId === undefined || targetId === id) continue;
      const res = insertEdge.run(id, targetId, RELATION);
      if (res.changes > 0) inserted++;
    }
  }
  return inserted;
}
