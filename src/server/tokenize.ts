const MIN_LEN = 3;
const TOKEN_RE = /[A-Za-z0-9][A-Za-z0-9_-]*/g;

export function tokenize(text: string): string[] {
  const matches = text.match(TOKEN_RE) ?? [];
  const out = new Set<string>();
  for (const m of matches) {
    const lower = m.toLowerCase();
    if (lower.length >= MIN_LEN) out.add(lower);
  }
  return Array.from(out);
}
