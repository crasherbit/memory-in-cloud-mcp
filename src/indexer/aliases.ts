const PREFIXES = ["interop-be", "interop-fe", "pagopa-be", "pagopa-fe"] as const;

const ROLE_SUFFIXES = new Set([
  "checker",
  "worker",
  "consumer",
  "producer",
  "bff",
  "api",
  "service",
]);

export function computeAliases(packageName: string): string[] {
  const out = new Set<string>();
  const lower = packageName.toLowerCase();
  out.add(lower);

  // Strip "@scope/" prefix if present (npm scoped packages).
  const bare = lower.replace(/^@[^/]+\//, "");
  if (bare !== lower) out.add(bare);

  const segments = bare.split("-").filter(Boolean);

  // Prefix-stripped alias.
  for (const prefix of PREFIXES) {
    if (bare.startsWith(prefix + "-")) {
      const remainder = bare.slice(prefix.length + 1);
      if (remainder.length >= 2) out.add(remainder);
      break;
    }
  }

  // Role suffix alone.
  const last = segments[segments.length - 1];
  if (last && ROLE_SUFFIXES.has(last)) out.add(last);

  // Acronym from segments of length >= 2.
  const longSegments = segments.filter((s) => s.length >= 2);
  if (longSegments.length >= 2) {
    const acronym = longSegments.map((s) => s[0]).join("");
    if (acronym.length >= 2 && acronym.length <= 6) out.add(acronym);
  }

  return Array.from(out);
}
