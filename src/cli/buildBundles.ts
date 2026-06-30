import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { Bundle, BundleNode } from "../shared/bundleSchema.js";
import { discoverPackageJsons } from "./discover.js";
import { extractPackageCard } from "./extract.js";
import { locateRepoMap, parseRepoMap } from "./repoMap.js";

export type BuildOptions = {
  monorepoRoot?: string;
  filesExtRoot?: string;
  branch?: string;
  commit_sha?: string;
};

export async function buildAllBundles(opts: BuildOptions): Promise<Bundle[]> {
  const bundles: Bundle[] = [];

  if (opts.monorepoRoot) {
    bundles.push(...(await buildPackageBundles(opts.monorepoRoot, opts)));
  }

  const searchRoots = [
    ...(opts.filesExtRoot ? [opts.filesExtRoot] : []),
    ...(opts.monorepoRoot ? [opts.monorepoRoot] : []),
  ];
  const repoMapDir = locateRepoMap(searchRoots);
  if (repoMapDir) {
    bundles.push(buildCartographerBundle(repoMapDir, opts));
  }

  return bundles;
}

async function buildPackageBundles(
  monorepoRoot: string,
  opts: BuildOptions
): Promise<Bundle[]> {
  const root = resolve(monorepoRoot);
  const pkgs = await discoverPackageJsons(root);
  const nodes: BundleNode[] = [];
  for (const pkgPath of pkgs) {
    const card = extractPackageCard(pkgPath, root);
    if (!card) continue;
    nodes.push({
      type: "package",
      name: card.name,
      title: card.name,
      summary: card.description,
      body_md: card.readme,
      aliases: card.aliases,
      keywords: dedupe([
        ...card.aliases,
        ...words(card.description),
        ...words(card.path.split("/").pop() ?? ""),
      ]),
      extra: {
        path: card.path,
        scripts: card.scripts,
        entry_points: card.entry_points,
      },
      links: card.dependencies.map((dep) => ({
        relation: "depends_on",
        target_type: "package" as const,
        target_name: dep,
      })),
    });
  }
  if (nodes.length === 0) return [];
  return [
    {
      schema_version: "1.0",
      bundle_id: `package_json/${new Date().toISOString()}/${randomUUID()}`,
      branch: opts.branch,
      commit_sha: opts.commit_sha,
      source_kind: "package_json",
      source_file: "packages/**/package.json",
      ingested_at: new Date().toISOString(),
      replace_edges: true,
      nodes,
    },
  ];
}

function buildCartographerBundle(repoMapDir: string, opts: BuildOptions): Bundle {
  const areas = parseRepoMap(repoMapDir);
  const nodes: BundleNode[] = areas.map((card) => {
    const aliases = new Set<string>();
    aliases.add(card.area_id);
    aliases.add(card.area_id.replace(/^\d+-/, ""));
    for (const w of titleWords(card.title)) aliases.add(w);

    const containsLinks = card.key_paths.map((kp) => {
      const trimmed = kp.replace(/\/$/, "");
      const pkgName = trimmed.split("/").pop() ?? trimmed;
      return {
        relation: "contains",
        target_type: "package" as const,
        target_name: pkgName,
      };
    });
    const dependsLinks = card.depends_on_areas.map((slug) => ({
      relation: "depends_on_area",
      target_type: "area" as const,
      target_name: slug,
    }));

    return {
      type: "area",
      name: card.area_id,
      title: card.title,
      summary: card.purpose,
      body_md: card.raw_md,
      aliases: Array.from(aliases),
      keywords: dedupe([
        ...aliases,
        ...words(card.purpose),
        ...card.key_paths.map((kp) => kp.replace(/\/$/, "").split("/").pop() ?? ""),
      ]),
      extra: {
        owned_by: card.owned_by,
        notes: card.notes,
        key_paths: card.key_paths,
        area_number: card.area_number,
      },
      links: [...containsLinks, ...dependsLinks],
    };
  });

  return {
    schema_version: "1.0",
    bundle_id: `cartographer/${new Date().toISOString()}/${randomUUID()}`,
    branch: opts.branch,
    commit_sha: opts.commit_sha,
    source_kind: "cartographer",
    source_file: "repo-map/",
    ingested_at: new Date().toISOString(),
    replace_edges: true,
    nodes,
  };
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "una", "che", "per",
  "del", "della", "dei", "delle", "con", "are", "was", "has", "have",
]);

// Significant lowercased word tokens from free text, for the FTS keywords column.
function words(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.filter((s) => s.length > 0)));
}

function titleWords(title: string): string[] {
  return Array.from(
    new Set(
      title
        .toLowerCase()
        .replace(/[()]/g, " ")
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && w !== "and")
    )
  );
}
