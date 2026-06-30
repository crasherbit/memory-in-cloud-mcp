import type Database from "better-sqlite3";
import { z } from "zod";
import { bundleNodeSchema } from "../../shared/bundleSchema.js";
import { canonicalizeEndpoint } from "../../shared/canonicalize.js";
import { _internal } from "./ingestBundle.js";

const upsertNodeInputSchema = bundleNodeSchema;

export type UpsertNodeContext = {
  workspace: string;
  agentId: string;
};

export type UpsertNodeResult = {
  node_id: number;
  created: boolean;
  warnings: string[];
};

export async function upsertNode(
  db: Database.Database,
  rawInput: unknown,
  ctx: UpsertNodeContext
): Promise<UpsertNodeResult> {
  const parsed = upsertNodeInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(
      `invalid_input: ${parsed.error.issues
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`
    );
  }
  let node = parsed.data;
  const warnings: string[] = [];

  if (node.type === "endpoint") {
    try {
      const canon = canonicalizeEndpoint(node.name);
      const extra = { ...(node.extra ?? {}) };
      extra.verb = canon.verb;
      extra.path = canon.path;
      extra.path_original = canon.path_original;
      extra.path_params = canon.path_params;
      // Keep the natural path searchable (name becomes the canonical signature).
      const keywords = Array.from(
        new Set([...(node.keywords ?? []), canon.path_original, canon.path])
      );
      node = { ...node, name: canon.signature, extra, keywords };
    } catch (err) {
      throw new Error(`invalid_endpoint: ${(err as Error).message}`);
    }
  }

  const existing = db
    .prepare("SELECT id FROM nodes WHERE workspace = ? AND type = ? AND name = ?")
    .get(ctx.workspace, node.type, node.name.toLowerCase()) as
    | { id: number }
    | undefined;
  const created = !existing;

  let nodeId = -1;
  const tx = db.transaction(() => {
    nodeId = _internal.upsertNodeRow(db, node, {
      workspace: ctx.workspace,
      branch: null,
      commit_sha: null,
      source_kind: "claude_runtime",
      source_file: null,
      ingest_run_id: `claude_runtime:${ctx.agentId}:${new Date().toISOString()}`,
      agent_id: ctx.agentId,
    });
    const aliases = computeRuntimeAliases(node);
    _internal.replaceAliases(db, nodeId, aliases);

    for (const link of node.links ?? []) {
      _internal.upsertEdge(db, ctx.workspace, nodeId, link, warnings);
    }
  });
  tx();

  return { node_id: nodeId, created, warnings };
}

function computeRuntimeAliases(node: z.infer<typeof bundleNodeSchema>): string[] {
  const set = new Set<string>();
  for (const a of node.aliases ?? []) set.add(a.toLowerCase());
  const extra = node.extra ?? {};
  const jiraKeys = (extra as Record<string, unknown>).jira_keys;
  if (Array.isArray(jiraKeys)) {
    for (const k of jiraKeys) {
      if (typeof k === "string") set.add(k.toLowerCase());
    }
  }
  return Array.from(set);
}
