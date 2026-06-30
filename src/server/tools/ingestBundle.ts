import type Database from "better-sqlite3";
import {
  bundleSchema,
  validateSchemaVersion,
  type Bundle,
  type BundleLink,
  type BundleNode,
  type NodeTypeEnum,
  type SourceKind,
} from "../../shared/bundleSchema.js";
import { canonicalizeEndpoint } from "../../shared/canonicalize.js";
import { payloadHash } from "../../shared/payloadHash.js";

export type IngestContext = {
  workspace: string;
  agentId: string;
};

export type IngestResult = {
  bundle_id: string;
  idempotent: boolean;
  duplicate_payload: boolean;
  nodes_upserted: number;
  nodes_unchanged: number;
  edges_upserted: number;
  edges_removed: number;
  warnings: string[];
};

export async function ingestBundle(
  db: Database.Database,
  rawInput: unknown,
  ctx: IngestContext
): Promise<IngestResult> {
  const parsed = bundleSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new Error(
      `invalid_bundle: ${parsed.error.issues
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`
    );
  }
  const bundle: Bundle = parsed.data;

  const versionCheck = validateSchemaVersion(bundle.schema_version);
  if (!versionCheck.ok) {
    throw new Error(`unsupported_schema_version: ${versionCheck.reason}`);
  }

  // Idempotency: same bundle_id already seen within this workspace → no-op.
  const existingRun = db
    .prepare(
      "SELECT payload_hash, nodes_count, edges_count FROM ingest_runs WHERE id = ? AND workspace = ?"
    )
    .get(bundle.bundle_id, ctx.workspace) as
    | { payload_hash: string; nodes_count: number; edges_count: number }
    | undefined;

  if (existingRun) {
    return {
      bundle_id: bundle.bundle_id,
      idempotent: true,
      duplicate_payload: false,
      nodes_upserted: 0,
      nodes_unchanged: existingRun.nodes_count,
      edges_upserted: 0,
      edges_removed: 0,
      warnings: [`bundle_id "${bundle.bundle_id}" already ingested (no-op)`],
    };
  }

  const hash = payloadHash({ nodes: bundle.nodes });
  const duplicatePayload = !!db
    .prepare(
      "SELECT 1 FROM ingest_runs WHERE payload_hash = ? AND workspace = ? LIMIT 1"
    )
    .get(hash, ctx.workspace);

  const ingestedAt = bundle.ingested_at ?? new Date().toISOString();
  const warnings: string[] = [];
  if (duplicatePayload) {
    warnings.push(
      `payload_hash already seen under a different bundle_id (possible accidental replay)`
    );
  }

  // Canonicalize endpoint names BEFORE upsert.
  const preparedNodes: BundleNode[] = bundle.nodes.map((n) => {
    if (n.type !== "endpoint") return n;
    try {
      const canon = canonicalizeEndpoint(n.name);
      const extra = { ...(n.extra ?? {}) };
      extra.verb = canon.verb;
      extra.path = canon.path;
      extra.path_original = canon.path_original;
      extra.path_params = canon.path_params;
      // The stored name is the canonical signature (params → {1}), so the
      // natural path is no longer matchable by name. Keep it searchable via FTS.
      const keywords = Array.from(
        new Set([...(n.keywords ?? []), canon.path_original, canon.path])
      );
      return { ...n, name: canon.signature, extra, keywords };
    } catch (err) {
      warnings.push(
        `endpoint "${n.name}" cannot be canonicalized: ${(err as Error).message}; skipped`
      );
      return n;
    }
  });

  let nodesUpserted = 0;
  let edgesUpserted = 0;
  let edgesRemoved = 0;

  const tx = db.transaction(() => {
    const idByTypeName = new Map<string, number>();

    for (const node of preparedNodes) {
      const id = upsertNodeRow(db, node, {
        workspace: ctx.workspace,
        branch: bundle.branch ?? null,
        commit_sha: bundle.commit_sha ?? null,
        source_kind: bundle.source_kind,
        source_file: bundle.source_file ?? null,
        ingest_run_id: bundle.bundle_id,
        agent_id: ctx.agentId,
      });
      idByTypeName.set(`${node.type}/${node.name.toLowerCase()}`, id);
      nodesUpserted++;
      replaceAliases(db, id, computeAliases(node));
    }

    if (bundle.replace_edges) {
      const delStmt = db.prepare(
        `DELETE FROM edges
           WHERE source_id = ?
             AND EXISTS (
               SELECT 1 FROM nodes n
                WHERE n.id = edges.source_id AND n.source_kind = ?
             )`
      );
      for (const id of idByTypeName.values()) {
        const res = delStmt.run(id, bundle.source_kind);
        edgesRemoved += res.changes;
      }
    }

    for (const node of preparedNodes) {
      const sourceId = idByTypeName.get(`${node.type}/${node.name.toLowerCase()}`);
      if (sourceId === undefined) continue;
      for (const link of node.links ?? []) {
        const inserted = upsertEdge(db, ctx.workspace, sourceId, link, warnings);
        if (inserted) edgesUpserted++;
      }
    }

    db.prepare(
      `INSERT INTO ingest_runs
         (id, workspace, payload_hash, source_kind, source_file, branch, commit_sha,
          nodes_count, edges_count, warnings, ingested_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      bundle.bundle_id,
      ctx.workspace,
      hash,
      bundle.source_kind,
      bundle.source_file ?? null,
      bundle.branch ?? null,
      bundle.commit_sha ?? null,
      preparedNodes.length,
      edgesUpserted,
      JSON.stringify(warnings),
      ingestedAt
    );
  });

  tx();

  return {
    bundle_id: bundle.bundle_id,
    idempotent: false,
    duplicate_payload: duplicatePayload,
    nodes_upserted: nodesUpserted,
    nodes_unchanged: 0,
    edges_upserted: edgesUpserted,
    edges_removed: edgesRemoved,
    warnings,
  };
}

function upsertNodeRow(
  db: Database.Database,
  node: BundleNode,
  prov: {
    workspace: string;
    branch: string | null;
    commit_sha: string | null;
    source_kind: SourceKind;
    source_file: string | null;
    ingest_run_id: string;
    agent_id: string;
  }
): number {
  const json = JSON.stringify({
    ...node,
    extra: node.extra ?? {},
    aliases: node.aliases ?? [],
  });
  const description = node.title ?? node.summary ?? null;
  const readme = composeReadme(node);

  const upsert = db.prepare(
    `INSERT INTO nodes
       (workspace, type, name, description, readme, summary_ai, keywords, source_url,
        json_blob, updated_at, provenance,
        branch, commit_sha, source_kind, source_file, ingest_run_id, agent_id)
     VALUES
       (@workspace, @type, @name, @description, @readme, @summary_ai, @keywords, @source_url,
        @json_blob, @updated_at, @provenance,
        @branch, @commit_sha, @source_kind, @source_file, @ingest_run_id, @agent_id)
     ON CONFLICT (workspace, type, name) DO UPDATE SET
       description    = excluded.description,
       readme         = excluded.readme,
       summary_ai     = excluded.summary_ai,
       keywords       = excluded.keywords,
       source_url     = excluded.source_url,
       json_blob      = excluded.json_blob,
       updated_at     = excluded.updated_at,
       provenance     = excluded.provenance,
       branch         = excluded.branch,
       commit_sha     = excluded.commit_sha,
       source_kind    = excluded.source_kind,
       source_file    = excluded.source_file,
       ingest_run_id  = excluded.ingest_run_id,
       agent_id       = excluded.agent_id
     RETURNING id`
  );

  const row = upsert.get({
    type: node.type,
    name: node.name.toLowerCase(),
    description,
    readme,
    summary_ai: node.summary_ai ?? null,
    keywords: node.keywords ? JSON.stringify(node.keywords) : null,
    source_url: node.source_url ?? null,
    json_blob: json,
    updated_at: new Date().toISOString(),
    provenance: legacyProvenanceFor(prov.source_kind),
    workspace: prov.workspace,
    branch: prov.branch,
    commit_sha: prov.commit_sha,
    source_kind: prov.source_kind,
    source_file: prov.source_file,
    ingest_run_id: prov.ingest_run_id,
    agent_id: prov.agent_id,
  }) as { id: number };

  return row.id;
}

function composeReadme(node: BundleNode): string | null {
  const parts = [node.summary, node.body_md].filter(
    (s): s is string => typeof s === "string" && s.length > 0
  );
  if (parts.length === 0) return null;
  return parts.join("\n\n");
}

function computeAliases(node: BundleNode): string[] {
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

function replaceAliases(
  db: Database.Database,
  nodeId: number,
  aliases: string[]
): void {
  db.prepare("DELETE FROM node_aliases WHERE node_id = ?").run(nodeId);
  const ins = db.prepare(
    "INSERT OR IGNORE INTO node_aliases (alias, node_id) VALUES (?, ?)"
  );
  for (const a of aliases) ins.run(a, nodeId);
}

function upsertEdge(
  db: Database.Database,
  workspace: string,
  sourceId: number,
  link: BundleLink,
  warnings: string[]
): boolean {
  const target = db
    .prepare(`SELECT id FROM nodes WHERE workspace = ? AND type = ? AND name = ?`)
    .get(workspace, link.target_type, link.target_name.toLowerCase()) as
    | { id: number }
    | undefined;
  if (!target) {
    warnings.push(
      `link "${link.relation}" → ${link.target_type}/${link.target_name}: target not found, skipped`
    );
    return false;
  }
  if (target.id === sourceId) return false;
  const res = db
    .prepare(
      "INSERT OR IGNORE INTO edges (source_id, target_id, relation) VALUES (?, ?, ?)"
    )
    .run(sourceId, target.id, link.relation);
  return res.changes > 0;
}

function legacyProvenanceFor(kind: SourceKind): string {
  switch (kind) {
    case "package_json":
      return "deterministic";
    case "cartographer":
      return "repo_map";
    case "crawler":
      return "crawler";
    case "manual":
      return "manual";
    case "claude_runtime":
      return "claude_runtime";
  }
}

// Re-exports for upsertNode tool (it reuses the same row helpers).
export const _internal = {
  upsertNodeRow,
  replaceAliases,
  upsertEdge,
  composeReadme,
  legacyProvenanceFor,
};

export type { NodeTypeEnum };
