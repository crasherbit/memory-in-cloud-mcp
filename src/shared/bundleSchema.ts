import { z } from "zod";

export const SCHEMA_VERSION_CURRENT = "1.0";
export const SCHEMA_MAJOR_SUPPORTED = 1;
export const SCHEMA_MINOR_MIN_SUPPORTED = 0;

const nodeTypeSchema = z.enum(["package", "area", "pr", "feature", "endpoint"]);

const sourceKindSchema = z.enum([
  "package_json",
  "cartographer",
  "crawler",
  "manual",
  "claude_runtime",
]);

const linkSchema = z.object({
  relation: z.string().min(1),
  target_type: nodeTypeSchema,
  target_name: z.string().min(1),
});

export const bundleNodeSchema = z.object({
  type: nodeTypeSchema,
  name: z.string().min(1),
  title: z.string().optional(),
  summary: z.string().optional(),
  body_md: z.string().optional(),
  summary_ai: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  aliases: z.array(z.string()).optional(),
  extra: z.record(z.unknown()).optional(),
  source_url: z.string().url().optional(),
  links: z.array(linkSchema).optional(),
});

export const bundleSchema = z.object({
  schema_version: z.string().min(3),
  bundle_id: z.string().min(1),
  branch: z.string().optional(),
  commit_sha: z.string().optional(),
  source_kind: sourceKindSchema,
  source_file: z.string().optional(),
  ingested_at: z.string().datetime().optional(),
  replace_edges: z.boolean().default(true),
  nodes: z.array(bundleNodeSchema).min(1),
});

export type Bundle = z.infer<typeof bundleSchema>;
export type BundleNode = z.infer<typeof bundleNodeSchema>;
export type BundleLink = z.infer<typeof linkSchema>;
export type NodeTypeEnum = z.infer<typeof nodeTypeSchema>;
export type SourceKind = z.infer<typeof sourceKindSchema>;

export function validateSchemaVersion(version: string): {
  ok: boolean;
  reason?: string;
} {
  const m = version.match(/^(\d+)\.(\d+)$/);
  if (!m) return { ok: false, reason: `invalid format "${version}", expected MAJOR.MINOR` };
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (major !== SCHEMA_MAJOR_SUPPORTED) {
    return {
      ok: false,
      reason: `unsupported major ${major}, this server supports ${SCHEMA_MAJOR_SUPPORTED}.x`,
    };
  }
  if (minor < SCHEMA_MINOR_MIN_SUPPORTED) {
    return {
      ok: false,
      reason: `minor ${minor} below minimum ${SCHEMA_MINOR_MIN_SUPPORTED}`,
    };
  }
  return { ok: true };
}
