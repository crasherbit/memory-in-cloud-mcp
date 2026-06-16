#!/usr/bin/env node
import { openDb } from "../src/shared/db.js";
import { getContext } from "../src/server/tools/getContext.js";

const text = process.argv[2];
if (!text) {
  console.error('Usage: tsx scripts/query.ts "<text>"');
  process.exit(2);
}

const db = openDb();
try {
  const result = getContext(db, text);
  console.log(JSON.stringify(result, null, 2));
} finally {
  db.close();
}
