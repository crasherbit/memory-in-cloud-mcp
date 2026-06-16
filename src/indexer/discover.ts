import fastGlob from "fast-glob";

export async function discoverPackageJsons(repoRoot: string): Promise<string[]> {
  return fastGlob("**/package.json", {
    cwd: repoRoot,
    absolute: true,
    ignore: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/.git/**",
      "**/coverage/**",
    ],
    onlyFiles: true,
    suppressErrors: true,
    dot: false,
  });
}
