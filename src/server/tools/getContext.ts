import type Database from "better-sqlite3";
import type {
  AnyCard,
  ContextMatch,
  GetContextResult,
  LinkOut,
  MatchReason,
  MatchSignals,
  NodeType,
} from "../../shared/types.js";
import { tokenize } from "../tokenize.js";
import { workspaceFilter } from "../dbPool.js";

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 50;
const SCORE_EXACT = 1.0;
const SCORE_ALIAS = 0.8;
const SCORE_FTS_MAX = 0.6;
const FTS_LIMIT = 40;

export type GetContextInput = {
  text: string;
  limit?: number;
  types_filter?: NodeType[];
  min_score?: number;
};

type NodeRow = {
  id: number;
  type: string;
  name: string;
  json_blob: string;
};

type Hit = {
  node: NodeRow;
  reason: MatchReason;
  score: number;
  signals: MatchSignals;
};

export async function getContext(
  db: Database.Database,
  input: GetContextInput,
  workspace?: string
): Promise<GetContextResult> {
  // Optional tenant filter: when set, match the workspace plus global ("") rows.
  const wf = workspaceFilter(workspace);
  const andWf = wf.clause ? ` AND ${wf.clause}` : "";
  const limit = Math.min(
    Math.max(1, input.limit ?? DEFAULT_LIMIT),
    MAX_LIMIT
  );
  const minScore = input.min_score ?? 0;
  const typesFilter = input.types_filter
    ? new Set<string>(input.types_filter)
    : null;

  const tokens = tokenize(input.text);
  const totalIndexed = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM nodes${wf.clause ? ` WHERE ${wf.clause}` : ""}`
      )
      .get(...wf.params) as { c: number }
  ).c;

  const hits = new Map<number, Hit>();

  const stmtExact = db.prepare(
    `SELECT id, type, name, json_blob FROM nodes WHERE name = ?${andWf}`
  );
  const stmtAlias = db.prepare(
    `SELECT n.id, n.type, n.name, n.json_blob, a.alias AS matched_alias
       FROM nodes n
       JOIN node_aliases a ON a.node_id = n.id
      WHERE a.alias = ?${andWf ? ` AND ${wf.clause}` : ""}`
  );

  for (const token of tokens) {
    const exact = stmtExact.get(token, ...wf.params) as NodeRow | undefined;
    if (exact) {
      upsertHit(hits, exact, "exact_name", SCORE_EXACT, (s) => {
        s.exact_name = true;
      });
      continue;
    }
    const aliasRows = stmtAlias.all(token, ...wf.params) as Array<
      NodeRow & { matched_alias: string }
    >;
    for (const row of aliasRows) {
      upsertHit(hits, row, "alias", SCORE_ALIAS, (s) => {
        if (!s.alias_hits.includes(row.matched_alias)) {
          s.alias_hits.push(row.matched_alias);
        }
      });
    }
  }

  const ftsQuery = buildFtsQuery(input.text);
  if (ftsQuery) {
    try {
      const ftsWf = wf.clause ? ` AND n.${wf.clause}` : "";
      const stmtFts = db.prepare(`
        SELECT n.id, n.type, n.name, n.json_blob, bm25(nodes_fts) AS bm
          FROM nodes_fts
          JOIN nodes n ON n.id = nodes_fts.rowid
         WHERE nodes_fts MATCH ?${ftsWf}
         ORDER BY bm
         LIMIT ?
      `);
      const rows = stmtFts.all(ftsQuery, ...wf.params, FTS_LIMIT) as Array<
        NodeRow & { bm: number }
      >;
      if (rows.length > 0) {
        const bestBm = rows[0].bm;
        for (const row of rows) {
          const score = normalizeBm25(bestBm, row.bm);
          upsertHit(hits, row, "fts", score, (s) => {
            s.fts_bm25 = row.bm;
            for (const tok of tokens) {
              if (!s.fts_hits.includes(tok)) s.fts_hits.push(tok);
            }
          });
        }
      }
    } catch {
      // ignore malformed MATCH input
    }
  }

  let sorted = Array.from(hits.values()).sort((a, b) => b.score - a.score);
  sorted = sorted.filter((h) => h.score >= minScore);
  if (typesFilter) sorted = sorted.filter((h) => typesFilter.has(h.node.type));
  sorted = sorted.slice(0, limit);

  const stmtOut = db.prepare(`
    SELECT e.relation AS relation, t.name AS target_name
      FROM edges e
      JOIN nodes t ON t.id = e.target_id
     WHERE e.source_id = ?
  `);
  const stmtIn = db.prepare(`
    SELECT e.relation AS relation, s.name AS target_name
      FROM edges e
      JOIN nodes s ON s.id = e.source_id
     WHERE e.target_id = ?
  `);

  const matches: ContextMatch[] = sorted.map((hit) => {
    const links_out = stmtOut.all(hit.node.id) as LinkOut[];
    const links_in = stmtIn.all(hit.node.id) as LinkOut[];
    return {
      type: hit.node.type as NodeType,
      card: JSON.parse(hit.node.json_blob) as AnyCard,
      reason: hit.reason,
      score: round3(hit.score),
      signals: hit.signals,
      links_out,
      links_in,
    };
  });

  return { matches, total_indexed: totalIndexed };
}

function upsertHit(
  hits: Map<number, Hit>,
  node: NodeRow,
  reason: MatchReason,
  score: number,
  enrichSignals: (s: MatchSignals) => void
): void {
  const existing = hits.get(node.id);
  if (existing) {
    if (score > existing.score) {
      existing.score = score;
      existing.reason = reason;
    }
    enrichSignals(existing.signals);
    return;
  }
  const signals: MatchSignals = {
    exact_name: false,
    alias_hits: [],
    fts_hits: [],
  };
  enrichSignals(signals);
  hits.set(node.id, { node, reason, score, signals });
}

// Sanitize-only for FTS5 MATCH: quote every token, escape embedded double quotes,
// no length filter, no character-class filter. Tokens with unicode/punct that
// FTS5 can't index become "" inside quotes — harmless OR clause.
function buildFtsQuery(text: string): string {
  const SPLIT = /[\s,;:!?(){}\[\]<>]+/u;
  const tokens = text
    .split(SPLIT)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return "";
  const quoted = tokens.map((t) => `"${t.replace(/"/g, '""')}"`);
  return quoted.join(" OR ");
}

function normalizeBm25(bestBm: number, bm: number): number {
  if (bm === 0 || bestBm === 0) return SCORE_FTS_MAX;
  const ratio = bestBm / bm;
  if (!Number.isFinite(ratio) || ratio < 0) return 0;
  return Math.max(0, Math.min(SCORE_FTS_MAX, SCORE_FTS_MAX * ratio));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
