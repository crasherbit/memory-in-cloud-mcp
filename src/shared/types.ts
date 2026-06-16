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

export type NodeType = "package";

export type MatchReason = "exact_name" | "alias" | "fts";

export type LinkOut = {
  relation: string;
  target_name: string;
};

export type ContextMatch = {
  card: PackageCard;
  type: NodeType;
  reason: MatchReason;
  score: number;
  links_out: LinkOut[];
};

export type GetContextResult = {
  matches: ContextMatch[];
  total_indexed: number;
};
