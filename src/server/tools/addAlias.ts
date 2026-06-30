import type Database from "better-sqlite3";
import { z } from "zod";
import { workspaceFilter } from "../dbPool.js";

const inputSchema = z.object({
  node_type: z.enum(["package", "area", "pr", "feature", "endpoint"]),
  node_name: z.string().min(1),
  alias: z.string().min(1),
});

export type AddAliasResult = {
  created: boolean;
  warnings: string[];
};

export async function addAlias(
  db: Database.Database,
  rawInput: unknown,
  workspace?: string
): Promise<AddAliasResult> {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(
      `invalid_input: ${parsed.error.issues
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`
    );
  }
  const { node_type, node_name, alias } = parsed.data;
  const warnings: string[] = [];

  const wf = workspaceFilter(workspace);
  const node = db
    .prepare(
      `SELECT id FROM nodes WHERE type = ? AND name = ?${
        wf.clause ? ` AND ${wf.clause}` : ""
      }`
    )
    .get(node_type, node_name.toLowerCase(), ...wf.params) as
    | { id: number }
    | undefined;
  if (!node) {
    warnings.push(`node ${node_type}/${node_name} not found`);
    return { created: false, warnings };
  }
  const res = db
    .prepare(
      "INSERT OR IGNORE INTO node_aliases (alias, node_id) VALUES (?, ?)"
    )
    .run(alias.toLowerCase(), node.id);
  return { created: res.changes > 0, warnings };
}
