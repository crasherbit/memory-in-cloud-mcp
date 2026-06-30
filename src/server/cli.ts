#!/usr/bin/env node
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { adminRoutes } from "./admin.js";
import { bearerAuth, bodyCap, rateLimit } from "./middleware/auth.js";
import { closeAll } from "./dbPool.js";
import { handleMcpRequest } from "./transport/http.js";

const PORT = Number(process.env.PORT ?? 8080);

const app = new Hono();

app.get("/healthz", (c) => c.json({ ok: true, version: "0.3.0" }));

// Admin routes (auth on each route; workspace is an optional query param).
adminRoutes(app);

// MCP endpoint. Streamable HTTP stateless. Tenant scope (if any) is an optional
// `workspace` argument on each tool call, not part of the URL.
app.all("/mcp", bodyCap, bearerAuth, rateLimit, async (c) => {
  return handleMcpRequest(c);
});

const server = serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`[mcp-mem] listening on http://0.0.0.0:${PORT}`);

const shutdown = (signal: string) => {
  console.log(`[mcp-mem] ${signal} received, shutting down`);
  closeAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
