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

export type AddLinkResult = {
  created: boolean;
  warnings: string[];
};

export async function addLink(
  db: Database.Database,
  rawInput: unknown,
  workspace?: string
): Promise<AddLinkResult> {
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

  const warnings: string[] = [];
  const wf = workspaceFilter(workspace);
  const sql = `SELECT id FROM nodes WHERE type = ? AND name = ?${
    wf.clause ? ` AND ${wf.clause}` : ""
  }`;
  const source = db
    .prepare(sql)
    .get(source_type, source_name.toLowerCase(), ...wf.params) as
    | { id: number }
    | undefined;
  if (!source) {
    warnings.push(`source ${source_type}/${source_name} not found`);
    return { created: false, warnings };
  }
  const target = db
    .prepare(sql)
    .get(target_type, target_name.toLowerCase(), ...wf.params) as
    | { id: number }
    | undefined;
  if (!target) {
    warnings.push(`target ${target_type}/${target_name} not found`);
    return { created: false, warnings };
  }
  if (source.id === target.id) {
    warnings.push("self-edge skipped");
    return { created: false, warnings };
  }
  const res = db
    .prepare(
      "INSERT OR IGNORE INTO edges (source_id, target_id, relation) VALUES (?, ?, ?)"
    )
    .run(source.id, target.id, relation);
  return { created: res.changes > 0, warnings };
}
