// Token splitter for downstream uses (e.g. exact/alias lookup). No length or
// regex filter is applied: callers receive every non-empty word.
const SPLIT_RE = /[\s,;:!?(){}\[\]<>"`]+/u;

export function tokenize(text: string): string[] {
  const out = new Set<string>();
  for (const raw of text.split(SPLIT_RE)) {
    const t = raw.trim();
    if (t.length === 0) continue;
    out.add(t.toLowerCase());
  }
  return Array.from(out);
}
