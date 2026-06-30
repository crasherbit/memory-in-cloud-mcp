import type { EndpointCard, FeatureCard, PrCard } from "./nodeTypes.js";

export type PackageCard = {
  name: string;
  path: string;
  description?: string;
  readme?: string;
  dependencies: string[];
  scripts: Record<string, string>;
  aliases: string[];
  entry_points: string[];
  updated_at: string;
};

export type AreaCard = {
  area_id: string;
  area_number: string;
  title: string;
  purpose: string;
  key_paths: string[];
  owned_by?: string;
  depends_on_areas: string[];
  notes?: string;
  raw_md: string;
  updated_at: string;
};

export type NodeType = "package" | "area" | "pr" | "feature" | "endpoint";

export type AnyCard =
  | PackageCard
  | AreaCard
  | PrCard
  | FeatureCard
  | EndpointCard;

export type MatchReason = "exact_name" | "alias" | "fts";

export type LinkOut = {
  relation: string;
  target_name: string;
};

export type MatchSignals = {
  exact_name: boolean;
  alias_hits: string[];
  fts_bm25?: number;
  fts_hits: string[];
};

export type ContextMatch = {
  type: NodeType;
  card: AnyCard;
  reason: MatchReason;
  score: number;
  signals: MatchSignals;
  links_out: LinkOut[];
  links_in: LinkOut[];
};

export type GetContextResult = {
  matches: ContextMatch[];
  total_indexed: number;
};

export type EnrichmentResult = {
  summary_it: string;
  keywords: string[];
  ticket_types: string[];
};

export type { EndpointCard, FeatureCard, PrCard } from "./nodeTypes.js";
