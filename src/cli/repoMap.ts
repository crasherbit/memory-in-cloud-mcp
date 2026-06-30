import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { AreaCard } from "../shared/types.js";

const AREA_FILE_RE = /^(\d{2})-([a-z0-9-]+)\.md$/;

export function locateRepoMap(searchRoots: string[]): string | null {
  for (const root of searchRoots) {
    const candidate = join(root, "repo-map");
    if (isDir(candidate)) return candidate;
  }
  return null;
}

export function parseRepoMap(repoMapDir: string): AreaCard[] {
  const out: AreaCard[] = [];
  for (const entry of readdirSync(repoMapDir)) {
    const m = entry.match(AREA_FILE_RE);
    if (!m) continue;
    const number = m[1];
    const slug = m[2];
    const full = join(repoMapDir, entry);
    const raw = readFileSync(full, "utf8");
    const card = parseAreaMd(`${number}-${slug}`, number, raw);
    if (card) out.push(card);
  }
  return out;
}

// No raw_md truncation: server-level body cap enforces total size.
export function parseAreaMd(
  areaId: string,
  areaNumber: string,
  raw: string
): AreaCard | null {
  const title = matchFirst(raw, /^#\s+(.+)$/m) ?? areaId;
  const purpose = matchSection(raw, "Purpose")?.trim() ?? "";
  const ownedBy = matchSection(raw, "Owned By")?.trim();
  const notes = matchSection(raw, "Notes")?.trim();

  const keyPathsBlock = matchSection(raw, "Key Paths") ?? "";
  const key_paths = extractBulletPaths(keyPathsBlock);

  const dependsBlock = matchSection(raw, "Depends On") ?? "";
  const depends_on_areas = extractBulletPaths(dependsBlock).map(stripPrefix);

  return {
    area_id: areaId,
    area_number: areaNumber,
    title,
    purpose,
    key_paths,
    owned_by: ownedBy,
    depends_on_areas,
    notes,
    raw_md: raw,
    updated_at: new Date().toISOString(),
  };
}

function matchFirst(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

function matchSection(text: string, section: string): string | null {
  const re = new RegExp(
    String.raw`\*\*${escapeRegex(section)}:\*\*\s*([\s\S]*?)(?=\n\s*\*\*[A-Z][^*]*\*\*|$)`
  );
  const m = text.match(re);
  return m ? m[1] : null;
}

function extractBulletPaths(block: string): string[] {
  const out: string[] = [];
  const lines = block.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*-\s+(?:`([^`]+)`|([^\s—-][^\n]*?))(?:\s*[—-]\s*.*)?$/);
    if (m) {
      const v = (m[1] ?? m[2] ?? "").trim();
      if (v) out.push(v);
    }
  }
  return out;
}

function stripPrefix(s: string): string {
  return s.replace(/^\d+-/, "").trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}
