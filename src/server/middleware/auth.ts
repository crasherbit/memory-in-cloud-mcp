import type { Context, MiddlewareHandler } from "hono";

const API_KEY = process.env.API_KEY ?? "";
const API_KEY_PREVIOUS = process.env.API_KEY_PREVIOUS ?? "";
// Separate token for destructive admin ops (prune / drop repo). If unset, falls
// back to API_KEY so the server still works out of the box — but a shared
// deployment SHOULD set a distinct ADMIN_KEY so a leaked read/write token can't
// wipe data.
const ADMIN_KEY = process.env.ADMIN_KEY ?? "";

if (!API_KEY) {
  console.error(
    "[mcp-mem] WARNING: API_KEY env var is empty. All requests will be rejected."
  );
}
if (!ADMIN_KEY) {
  console.error(
    "[mcp-mem] WARNING: ADMIN_KEY env var is empty. Destructive admin routes fall back to API_KEY."
  );
}

function extractBearer(header: string): string {
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

export const bearerAuth: MiddlewareHandler = async (c, next) => {
  const token = extractBearer(c.req.header("authorization") ?? "");
  if (!token || (token !== API_KEY && token !== API_KEY_PREVIOUS) || !API_KEY) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
};

// Guards destructive admin routes. Accepts ADMIN_KEY when set; otherwise falls
// back to the same check as bearerAuth.
export const adminAuth: MiddlewareHandler = async (c, next) => {
  const token = extractBearer(c.req.header("authorization") ?? "");
  const expected = ADMIN_KEY || API_KEY;
  if (!token || !expected || token !== expected) {
    return c.json({ error: "unauthorized", scope: "admin" }, 401);
  }
  await next();
};

const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 1000;
const MAX_REQ_PER_WINDOW = 60;

let lastSweep = 0;
// Drop expired buckets so the map can't grow unbounded with distinct client IPs
// (employees are on plain public IPs, no shared VPN egress).
function sweepBuckets(now: number): void {
  if (now - lastSweep < WINDOW_MS) return;
  lastSweep = now;
  for (const [ip, b] of buckets) {
    if (now > b.resetAt) buckets.delete(ip);
  }
}

export const rateLimit: MiddlewareHandler = async (c, next) => {
  // Behind nginx: the real client IP must arrive via X-Forwarded-For / X-Real-IP
  // (configure `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`).
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown";
  const now = Date.now();
  sweepBuckets(now);
  let b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(ip, b);
  }
  b.count++;
  if (b.count > MAX_REQ_PER_WINDOW) {
    return c.json({ error: "rate_limited" }, 429);
  }
  await next();
};

export type BodyCaps = {
  default: number;
  upsertNode: number;
  ingestBundle: number;
};

export const DEFAULT_BODY_CAPS: BodyCaps = {
  default: 16 * 1024,
  upsertNode: 512 * 1024,
  ingestBundle: 5 * 1024 * 1024,
};

export function capForTool(toolName: string, caps: BodyCaps = DEFAULT_BODY_CAPS): number {
  if (toolName === "ingest_bundle") return caps.ingestBundle;
  if (toolName === "upsert_node") return caps.upsertNode;
  return caps.default;
}

// Hono-level body cap that uses content-length when available. The MCP transport
// reads the body itself; we apply the conservative `ingestBundle` cap at the
// HTTP boundary to avoid OOM on hostile clients. Per-tool cap is re-checked
// inside each tool handler.
export const bodyCap: MiddlewareHandler = async (c, next) => {
  const len = Number(c.req.header("content-length") ?? "0");
  if (Number.isFinite(len) && len > DEFAULT_BODY_CAPS.ingestBundle) {
    return c.json(
      { error: "payload_too_large", limit_bytes: DEFAULT_BODY_CAPS.ingestBundle },
      413
    );
  }
  await next();
};

export function getAgentId(c: Context): string {
  return c.req.header("x-agent-id") ?? "anonymous";
}
