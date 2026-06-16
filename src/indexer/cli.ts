#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { openDb } from "../shared/db.js";
import { discoverPackageJsons } from "./discover.js";
import { rebuildDependsOnEdges } from "./edges.js";
import { extractPackageCard } from "./extract.js";
import { upsertPackageNode, type UpsertedNode } from "./store.js";

async function main(): Promise<void> {
  const repoArg = process.argv[2];
  if (!repoArg) {
    console.error("Usage: npm run ingest -- <repo-path>");
    process.exit(2);
  }

  const repoRoot = resolve(repoArg);
  if (!existsSync(repoRoot) || !statSync(repoRoot).isDirectory()) {
    console.error(`Not a directory: ${repoRoot}`);
    process.exit(2);
  }

  console.log(`Indexing ${repoRoot}`);
  const db = openDb();

  console.log("Pass 1: discovering packages...");
  const pkgJsons = await discoverPackageJsons(repoRoot);
  console.log(`Found ${pkgJsons.length} package.json file(s).`);

  const ingested: UpsertedNode[] = [];
  const ingestNodes = db.transaction(() => {
    for (const pkgPath of pkgJsons) {
      const card = extractPackageCard(pkgPath, repoRoot);
      if (!card) continue;
      const node = upsertPackageNode(db, card);
      ingested.push(node);
      console.log(`  + ${card.name}  [${card.path}]`);
    }
  });
  ingestNodes();

  console.log("Pass 2: building depends_on edges...");
  const buildEdges = db.transaction(() => rebuildDependsOnEdges(db, ingested));
  const edgeCount = buildEdges();

  console.log(`\nDone: ${ingested.length} nodes, ${edgeCount} depends_on edges.`);
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
