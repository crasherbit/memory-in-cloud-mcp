import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { PackageCard } from "../shared/types.js";
import { computeAliases } from "./aliases.js";

const README_MAX = 2000;
const README_CANDIDATES = ["README.md", "readme.md", "Readme.md", "README.MD"];

export function extractPackageCard(
  pkgJsonPath: string,
  repoRoot: string
): PackageCard | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  } catch {
    return null;
  }
  if (!isObject(parsed)) return null;
  const name = parsed.name;
  if (typeof name !== "string" || name.length === 0) return null;

  const dir = join(pkgJsonPath, "..");
  const path = toPosix(relative(repoRoot, dir)) || ".";

  const description =
    typeof parsed.description === "string" ? parsed.description : undefined;

  const readme = readReadme(dir);

  const dependencies = [
    ...keys(parsed.dependencies),
    ...keys(parsed.devDependencies),
  ];

  const scripts: Record<string, string> = {};
  if (isObject(parsed.scripts)) {
    for (const [k, v] of Object.entries(parsed.scripts)) {
      if (typeof v === "string") scripts[k] = v;
    }
  }

  const entry_points = listSrcEntryPoints(join(dir, "src"));

  return {
    name,
    path,
    description,
    readme,
    dependencies,
    scripts,
    aliases: computeAliases(name),
    entry_points,
    updated_at: new Date().toISOString(),
  };
}

function readReadme(dir: string): string | undefined {
  for (const candidate of README_CANDIDATES) {
    const p = join(dir, candidate);
    if (existsSync(p)) {
      const content = readFileSync(p, "utf8");
      return content.length > README_MAX ? content.slice(0, README_MAX) : content;
    }
  }
  return undefined;
}

function listSrcEntryPoints(srcDir: string): string[] {
  if (!existsSync(srcDir)) return [];
  try {
    if (!statSync(srcDir).isDirectory()) return [];
    return readdirSync(srcDir).filter((name) => {
      try {
        return statSync(join(srcDir, name)).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

function keys(obj: unknown): string[] {
  return isObject(obj) ? Object.keys(obj) : [];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toPosix(p: string): string {
  return p.split(sep).join("/");
}
