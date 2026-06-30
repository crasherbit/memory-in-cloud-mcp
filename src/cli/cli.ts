#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { bundleSchema, type Bundle } from "../shared/bundleSchema.js";
import { buildAllBundles } from "./buildBundles.js";

type Flags = {
  workspace?: string;
  url?: string;
  apiKey?: string;
  agentId?: string;
  monorepoRoot?: string;
  filesExtRoot?: string;
  bundlesDir?: string;
  branch?: string;
  commit_sha?: string;
};

function parseArgs(argv: string[]): Flags {
  const f: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--workspace") (f.workspace = next), i++;
    else if (a === "--url") (f.url = next), i++;
    else if (a === "--api-key") (f.apiKey = next), i++;
    else if (a === "--agent-id") (f.agentId = next), i++;
    else if (a === "--monorepo") (f.monorepoRoot = next), i++;
    else if (a === "--filesExt") (f.filesExtRoot = next), i++;
    else if (a === "--bundles") (f.bundlesDir = next), i++;
    else if (a === "--branch") (f.branch = next), i++;
    else if (a === "--commit") (f.commit_sha = next), i++;
    else if (a === "--help" || a === "-h") {
      printHelpAndExit(0);
    } else if (a.startsWith("--")) {
      console.error(`Unknown flag: ${a}`);
      printHelpAndExit(2);
    }
  }
  return f;
}

function printHelpAndExit(code: number): never {
  console.error(
    [
      "Usage: tsx src/cli/cli.ts [--workspace <id>] <inputs> [options]",
      "",
      "Reads filesExt/ and/or a monorepo path on disk, builds canonical",
      "ingest bundles, and POSTs them to a running MCP-MEM server via MCP.",
      "",
      "Scope:",
      "  --workspace <id>       Optional tenant scope to tag ingested nodes with",
      "                         ([a-z0-9-]). Omit → nodes are global (visible to all).",
      "",
      "Inputs (at least one):",
      "  --monorepo <abs path>  Repo root to scan package.json from",
      "  --filesExt <abs path>  Folder with repo-map/ (cartographer) etc.",
      "  --bundles <abs path>   Folder of pre-built bundle .json files (e.g. emitted",
      "                         by the mem-ingest agent from comments.md / Jira / PRs)",
      "",
      "Server:",
      "  --url <url>            MCP server URL  (default: env MCP_MEM_URL or http://localhost:8080)",
      "  --api-key <key>        Bearer token    (default: env MCP_MEM_KEY)",
      "  --agent-id <id>        Agent identity  (default: env USER or 'ingest-cli')",
      "",
      "Optional provenance:",
      "  --branch <name>",
      "  --commit <sha>",
    ].join("\n")
  );
  process.exit(code);
}

// Load pre-built bundle .json files (validated against the canonical schema).
// These are typically produced by the mem-ingest agent from comments.md, Jira
// exports, GitHub PRs etc. — content the deterministic builders can't derive.
function loadBundlesFromDir(dir: string): Bundle[] {
  let entries: string[];
  try {
    if (!statSync(dir).isDirectory()) {
      console.error(`[ingest-cli] --bundles "${dir}" is not a directory`);
      process.exit(2);
    }
    entries = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    console.error(`[ingest-cli] cannot read --bundles dir "${dir}"`);
    process.exit(2);
  }
  const out: Bundle[] = [];
  for (const file of entries.sort()) {
    const full = join(dir, file);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(full, "utf8"));
    } catch (err) {
      console.error(`[ingest-cli] skip ${file}: invalid JSON (${(err as Error).message})`);
      continue;
    }
    const parsed = bundleSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `[ingest-cli] skip ${file}: schema errors → ${parsed.error.issues
          .map((i) => `${i.path.join(".")} ${i.message}`)
          .join("; ")}`
      );
      continue;
    }
    out.push(parsed.data);
  }
  return out;
}

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));
  if (!flags.monorepoRoot && !flags.filesExtRoot && !flags.bundlesDir) {
    console.error("Provide at least one of --monorepo / --filesExt / --bundles");
    printHelpAndExit(2);
  }

  const baseUrl =
    flags.url ?? process.env.MCP_MEM_URL ?? "http://localhost:8080";
  const apiKey = flags.apiKey ?? process.env.MCP_MEM_KEY ?? "";
  if (!apiKey) {
    console.error("Missing --api-key (or set env MCP_MEM_KEY)");
    process.exit(2);
  }
  const agentId =
    flags.agentId ?? process.env.USER ?? "ingest-cli";

  const mcpUrl = `${baseUrl.replace(/\/$/, "")}/mcp`;
  const workspace = flags.workspace?.trim().toLowerCase() || undefined;
  console.log(
    `[ingest-cli] target: ${mcpUrl}${workspace ? ` (workspace: ${workspace})` : " (global)"}`
  );

  const bundles = await buildAllBundles({
    monorepoRoot: flags.monorepoRoot ? resolve(flags.monorepoRoot) : undefined,
    filesExtRoot: flags.filesExtRoot ? resolve(flags.filesExtRoot) : undefined,
    branch: flags.branch,
    commit_sha: flags.commit_sha,
  });
  if (flags.bundlesDir) {
    const loaded = loadBundlesFromDir(resolve(flags.bundlesDir));
    console.log(`[ingest-cli] loaded ${loaded.length} pre-built bundle(s) from ${flags.bundlesDir}`);
    bundles.push(...loaded);
  }
  console.log(`[ingest-cli] ${bundles.length} bundle(s) total to send`);

  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Agent-Id": agentId,
      },
    },
  });

  const client = new Client(
    { name: "mcp-mem-ingest-cli", version: "0.3.0" },
    { capabilities: {} }
  );
  await client.connect(transport);

  try {
    for (const bundle of bundles) {
      console.log(
        `[ingest-cli] sending ${bundle.source_kind} bundle (${bundle.nodes.length} nodes)…`
      );
      const res = await client.callTool({
        name: "ingest_bundle",
        arguments: {
          ...(bundle as unknown as Record<string, unknown>),
          ...(workspace ? { workspace } : {}),
        },
      });
      const text =
        Array.isArray(res.content) && res.content[0]?.type === "text"
          ? res.content[0].text
          : JSON.stringify(res);
      console.log(`[ingest-cli] response:\n${text}`);
    }
  } finally {
    await client.close().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error("[ingest-cli] error:", err);
  process.exit(1);
});
