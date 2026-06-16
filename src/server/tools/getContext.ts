import type Database from "better-sqlite3";
import type {
  ContextMatch,
  GetContextResult,
  LinkOut,
  MatchReason,
  PackageCard,
} from "../../shared/types.js";
import { tokenize } from "../tokenize.js";

const MAX_RESULTS = 5;
const SCORE_EXACT = 1.0;
const SCORE_ALIAS = 0.8;
const SCORE_FTS_MAX = 0.6;
const FTS_LIMIT = 20;

type NodeRow = {
  id: number;
  type: string;
  name: string;
  json_blob: string;
};

type FtsRow = NodeRow & { bm: number };

type Hit = { node: NodeRow; reason: MatchReason; score: number };

export function getContext(
  db: Database.Database,
  text: string
): GetContextResult {
  const tokens = tokenize(text);
  const totalIndexed = (
    db.prepare("SELECT COUNT(*) AS c FROM nodes").get() as { c: number }
  ).c;

  const hits = new Map<number, Hit>();

  const stmtExact = db.prepare(`
    SELECT id, type, name, json_blob FROM nodes
    WHERE type = 'package' AND name = ?
  `);
  const stmtAlias = db.prepare(`
    SELECT n.id, n.type, n.name, n.json_blob FROM nodes n
    JOIN node_aliases a ON a.node_id = n.id
    WHERE a.alias = ?
  `);

  for (const token of tokens) {
    const exact = stmtExact.get(token) as NodeRow | undefined;
    if (exact) {
      upsertHit(hits, exact, "exact_name", SCORE_EXACT);
      continue;
    }
    const aliasRows = stmtAlias.all(token) as NodeRow[];
    for (const row of aliasRows) {
      upsertHit(hits, row, "alias", SCORE_ALIAS);
    }
  }

  const ftsQuery = buildFtsQuery(tokens);
  if (ftsQuery) {
    try {
      const stmtFts = db.prepare(`
        SELECT n.id, n.type, n.name, n.json_blob, bm25(nodes_fts) AS bm
        FROM nodes_fts
        JOIN nodes n ON n.id = nodes_fts.rowid
        WHERE nodes_fts MATCH ?
        ORDER BY bm
        LIMIT ?
      `);
      const rows = stmtFts.all(ftsQuery, FTS_LIMIT) as FtsRow[];
      if (rows.length > 0) {
        const bestBm = rows[0].bm;
        for (const row of rows) {
          const score = normalizeBm25(bestBm, row.bm);
          upsertHit(hits, row, "fts", score);
        }
      }
    } catch {
      // FTS query may fail on weird input; ignore.
    }
  }

  const sorted = Array.from(hits.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  const stmtEdges = db.prepare(`
    SELECT e.relation AS relation, t.name AS target_name
    FROM edges e
    JOIN nodes t ON t.id = e.target_id
    WHERE e.source_id = ?
  `);

  const matches: ContextMatch[] = sorted.map((hit) => {
    const links = stmtEdges.all(hit.node.id) as LinkOut[];
    return {
      card: JSON.parse(hit.node.json_blob) as PackageCard,
      type: "package",
      reason: hit.reason,
      score: round3(hit.score),
      links_out: links,
    };
  });

  return { matches, total_indexed: totalIndexed };
}

function upsertHit(
  hits: Map<number, Hit>,
  node: NodeRow,
  reason: MatchReason,
  score: number
): void {
  const existing = hits.get(node.id);
  if (!existing || score > existing.score) {
    hits.set(node.id, { node, reason, score });
  }
}

function buildFtsQuery(tokens: string[]): string {
  // Quote each token to neutralize FTS5 syntax (especially '-').
  const safe = tokens.filter((t) => /^[a-z0-9_-]+$/.test(t)).slice(0, 20);
  if (safe.length === 0) return "";
  return safe.map((t) => `"${t}"`).join(" OR ");
}

function normalizeBm25(bestBm: number, bm: number): number {
  // FTS5 bm25() returns lower (more negative) for better matches.
  // Map so the best row gets ~SCORE_FTS_MAX, worse rows scale down.
  if (bm === 0 || bestBm === 0) return SCORE_FTS_MAX;
  const ratio = bestBm / bm;
  if (!Number.isFinite(ratio) || ratio < 0) return 0;
  return Math.max(0, Math.min(SCORE_FTS_MAX, SCORE_FTS_MAX * ratio));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
