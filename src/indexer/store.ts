import type Database from "better-sqlite3";
import type { PackageCard } from "../shared/types.js";

export type UpsertedNode = {
  id: number;
  name: string;
  card: PackageCard;
};

export function upsertPackageNode(
  db: Database.Database,
  card: PackageCard
): UpsertedNode {
  const lowerName = card.name.toLowerCase();

  const upsert = db.prepare(`
    INSERT INTO nodes (type, name, description, readme, json_blob, updated_at)
    VALUES ('package', @name, @description, @readme, @json_blob, @updated_at)
    ON CONFLICT (type, name) DO UPDATE SET
      description = excluded.description,
      readme      = excluded.readme,
      json_blob   = excluded.json_blob,
      updated_at  = excluded.updated_at
    RETURNING id
  `);

  const row = upsert.get({
    name: lowerName,
    description: card.description ?? null,
    readme: card.readme ?? null,
    json_blob: JSON.stringify(card),
    updated_at: card.updated_at,
  }) as { id: number };

  db.prepare("DELETE FROM node_aliases WHERE node_id = ?").run(row.id);
  const insertAlias = db.prepare(
    "INSERT OR IGNORE INTO node_aliases (alias, node_id) VALUES (?, ?)"
  );
  for (const alias of card.aliases) {
    insertAlias.run(alias.toLowerCase(), row.id);
  }

  return { id: row.id, name: lowerName, card };
}
