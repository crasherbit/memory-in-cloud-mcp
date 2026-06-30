export type PrCard = {
  number: string;
  title: string;
  summary: string;
  body_md: string;
  source_url?: string;
  jira_keys: string[];
  author?: string;
  state?: "OPEN" | "MERGED" | "CLOSED";
  merged_at?: string;
  files_count?: number;
  touches: string[];
  updated_at: string;
};

export type FeatureCard = {
  slug: string;
  title: string;
  summary: string;
  body_md: string;
  jira_keys: string[];
  pr_numbers: string[];
  updated_at: string;
};

export type EndpointCard = {
  signature: string;
  verb: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  path_original?: string;
  path_params?: Record<string, number>;
  description: string;
  introduced_by_pr?: string;
  updated_at: string;
};
