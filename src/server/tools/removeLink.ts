import type Database from "better-sqlite3";
import { z } from "zod";
import { workspaceFilter } from "../dbPool.js";

const inputSchema = z.object({
  source_type: z.enum(["package", "area", "pr", "feature", "endpoint"]),
  source_name: z.string().min(1),
  target_type: z.enum(["package", "area", "pr", "feature", "endpoint"]),
  target_name: z.string().min(1),
  relation: z.string().min(1),
});

export type RemoveLinkResult = { removed: boolean };

export async function removeLink(
  db: Database.Database,
  rawInput: unknown,
  workspace?: string
): Promise<RemoveLinkResult> {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(
      `invalid_input: ${parsed.error.issues
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`
    );
  }
  const { source_type, source_name, target_type, target_name, relation } =
    parsed.data;

  const wf = workspaceFilter(workspace);
  const sql = `SELECT id FROM nodes WHERE type = ? AND name = ?${
    wf.clause ? ` AND ${wf.clause}` : ""
  }`;
  const source = db
    .prepare(sql)
    .get(source_type, source_name.toLowerCase(), ...wf.params) as
    | { id: number }
    | undefined;
  const target = db
    .prepare(sql)
    .get(target_type, target_name.toLowerCase(), ...wf.params) as
    | { id: number }
    | undefined;
  if (!source || !target) return { removed: false };
  const res = db
    .prepare(
      "DELETE FROM edges WHERE source_id = ? AND target_id = ? AND relation = ?"
    )
    .run(source.id, target.id, relation);
  return { removed: res.changes > 0 };
}
