import type Database from "better-sqlite3";
import { z } from "zod";
import { workspaceFilter } from "../dbPool.js";

const inputSchema = z.object({
  type: z.enum(["package", "area", "pr", "feature", "endpoint"]),
  name: z.string().min(1),
});

export type RemoveNodeResult = { removed: boolean; edges_cascaded: number };

export async function removeNode(
  db: Database.Database,
  rawInput: unknown,
  workspace?: string
): Promise<RemoveNodeResult> {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(
      `invalid_input: ${parsed.error.issues
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`
    );
  }
  const { type, name } = parsed.data;
  const wf = workspaceFilter(workspace);
  const node = db
    .prepare(
      `SELECT id FROM nodes WHERE type = ? AND name = ?${
        wf.clause ? ` AND ${wf.clause}` : ""
      }`
    )
    .get(type, name.toLowerCase(), ...wf.params) as { id: number } | undefined;
  if (!node) return { removed: false, edges_cascaded: 0 };

  const edgesCascaded = (
    db
      .prepare(
        "SELECT COUNT(*) AS c FROM edges WHERE source_id = ? OR target_id = ?"
      )
      .get(node.id, node.id) as { c: number }
  ).c;
  db.prepare("DELETE FROM nodes WHERE id = ?").run(node.id);
  return { removed: true, edges_cascaded: edgesCascaded };
}
