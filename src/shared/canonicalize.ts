export type CanonicalEndpoint = {
  signature: string;
  verb: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  path_original: string;
  path_params: Record<string, number>;
};

const VALID_VERBS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH"]);

export function canonicalizeEndpoint(input: string): CanonicalEndpoint {
  const cleaned = input.trim().replace(/\s+/g, " ");
  const spaceAt = cleaned.indexOf(" ");
  if (spaceAt < 0) {
    throw new Error(
      `Invalid endpoint signature "${input}": expected "<VERB> <path>"`
    );
  }
  const rawVerb = cleaned.slice(0, spaceAt).toUpperCase();
  if (!VALID_VERBS.has(rawVerb)) {
    throw new Error(
      `Invalid endpoint verb "${rawVerb}": expected one of ${Array.from(VALID_VERBS).join(", ")}`
    );
  }
  const verb = rawVerb as CanonicalEndpoint["verb"];

  let rawPath = cleaned.slice(spaceAt + 1);
  // Strip query string and fragment.
  rawPath = rawPath.replace(/[?#].*$/, "");
  // Force leading slash.
  if (!rawPath.startsWith("/")) rawPath = "/" + rawPath;
  // Collapse double slashes.
  rawPath = rawPath.replace(/\/{2,}/g, "/");
  // Strip trailing slash, except root.
  if (rawPath.length > 1 && rawPath.endsWith("/")) {
    rawPath = rawPath.slice(0, -1);
  }
  const pathOriginal = rawPath;

  // Normalise :param → {param}.
  const colonReplaced = pathOriginal.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "{$1}");

  // Walk and rename {name} → {1}, {2}, ... preserving order.
  const pathParams: Record<string, number> = {};
  let counter = 0;
  const canonical = colonReplaced.replace(/\{([^}]+)\}/g, (_match, name) => {
    counter++;
    pathParams[name] = counter;
    return `{${counter}}`;
  });

  return {
    signature: `${verb} ${canonical}`,
    verb,
    path: canonical,
    path_original: pathOriginal,
    path_params: pathParams,
  };
}
