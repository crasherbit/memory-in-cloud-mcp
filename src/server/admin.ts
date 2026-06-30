import type { Hono } from "hono";
import {
  dataDir,
  dbStats,
  dropWorkspace,
  listWorkspaces,
  normalizeWorkspace,
  withDb,
} from "./dbPool.js";
import { adminAuth, bearerAuth, rateLimit } from "./middleware/auth.js";
import { mcpCounters } from "./transport/http.js";

export function adminRoutes(app: Hono): void {
  // Global overview: db file + per-workspace node counts ("" = global).
  app.get("/stats", bearerAuth, rateLimit, async (c) => {
    const workspaces = await withDb((db) => listWorkspaces(db));
    return c.json({
      data_dir: dataDir(),
      db: dbStats(),
      workspaces,
      counters: mcpCounters.read(),
    });
  });

  // Per-workspace detail. `?workspace=` optional; omit for the global ("") bucket.
  app.get("/stats/workspace", bearerAuth, rateLimit, async (c) => {
    let workspace: string;
    try {
      workspace = normalizeWorkspace(c.req.query("workspace"));
    } catch (err) {
      return c.json({ error: "invalid_workspace", reason: (err as Error).message }, 400);
    }
    const stats = await withDb((db) => {
      const counts = db
        .prepare(
          "SELECT type, COUNT(*) AS c FROM nodes WHERE workspace = ? GROUP BY type"
        )
        .all(workspace) as Array<{ type: string; c: number }>;
      const lastIngest = db
        .prepare(
          "SELECT MAX(ingested_at) AS at FROM ingest_runs WHERE workspace = ?"
        )
        .get(workspace) as { at: string | null };
      const missCount = (
        db
          .prepare("SELECT COUNT(*) AS c FROM missed_queries WHERE workspace = ?")
          .get(workspace) as { c: number }
      ).c;
      const recentRuns = db
        .prepare(
          `SELECT id, source_kind, source_file, branch, commit_sha,
                  nodes_count, edges_count, ingested_at
             FROM ingest_runs WHERE workspace = ?
            ORDER BY ingested_at DESC LIMIT 10`
        )
        .all(workspace);
      return {
        counts_by_type: counts.reduce<Record<string, number>>((acc, r) => {
          acc[r.type] = r.c;
          return acc;
        }, {}),
        last_ingested_at: lastIngest.at,
        miss_count: missCount,
        ingest_runs_recent: recentRuns,
      };
    });
    return c.json({
      workspace,
      db: dbStats(),
      counters: mcpCounters.read(),
      ...stats,
    });
  });

  // Prune nodes by filter. At least one of workspace/source_kind/agent_id/older_than.
  app.post("/admin/prune", adminAuth, rateLimit, async (c) => {
    let workspace: string;
    try {
      workspace = normalizeWorkspace(c.req.query("workspace"));
    } catch (err) {
      return c.json({ error: "invalid_workspace", reason: (err as Error).message }, 400);
    }
    const hasWorkspace = c.req.query("workspace") != null && workspace !== "";
    const sourceKind = c.req.query("source_kind");
    const agentId = c.req.query("agent_id");
    const olderThan = c.req.query("older_than");
    if (!hasWorkspace && !sourceKind && !agentId && !olderThan) {
      return c.json(
        {
          error: "missing_filter",
          reason: "at least one of workspace/source_kind/agent_id/older_than",
        },
        400
      );
    }
    const olderThanIso = olderThan ? olderThanToIso(olderThan) : null;

    const result = await withDb((db) => {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (hasWorkspace) {
        conditions.push("workspace = ?");
        params.push(workspace);
      }
      if (sourceKind) {
        conditions.push("source_kind = ?");
        params.push(sourceKind);
      }
      if (agentId) {
        conditions.push("agent_id = ?");
        params.push(agentId);
      }
      if (olderThanIso) {
        conditions.push("updated_at < ?");
        params.push(olderThanIso);
      }
      const where = conditions.join(" AND ");
      const before = (
        db.prepare(`SELECT COUNT(*) AS c FROM nodes WHERE ${where}`).get(...params) as { c: number }
      ).c;
      db.prepare(`DELETE FROM nodes WHERE ${where}`).run(...params);
      return { deleted_nodes: before };
    });
    return c.json(result);
  });

  // Drop a whole workspace (nodes + missed_queries + ingest_runs).
  app.delete("/admin/workspace", adminAuth, rateLimit, async (c) => {
    let workspace: string;
    try {
      workspace = normalizeWorkspace(c.req.query("workspace"));
    } catch (err) {
      return c.json({ error: "invalid_workspace", reason: (err as Error).message }, 400);
    }
    const confirm = c.req.query("confirm");
    const expected = workspace === "" ? "global" : workspace;
    if (confirm !== expected) {
      return c.json(
        { error: "confirm_required", reason: `pass ?confirm=${expected}` },
        400
      );
    }
    const res = await withDb((db) => dropWorkspace(db, workspace));
    return c.json({ dropped: true, workspace, ...res });
  });
}

function olderThanToIso(spec: string): string | null {
  const m = spec.match(/^(\d+)([dh])$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2];
  const ms = unit === "d" ? n * 86400 * 1000 : n * 3600 * 1000;
  return new Date(Date.now() - ms).toISOString();
}
