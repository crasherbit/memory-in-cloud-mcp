import type { Context } from "hono";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { withDb, normalizeWorkspace } from "../dbPool.js";
import { getAgentId, capForTool } from "../middleware/auth.js";
import { addAlias } from "../tools/addAlias.js";
import { addLink } from "../tools/addLink.js";
import { getContext, type GetContextInput } from "../tools/getContext.js";
import { ingestBundle } from "../tools/ingestBundle.js";
import { removeLink } from "../tools/removeLink.js";
import { removeNode } from "../tools/removeNode.js";
import { reportMiss } from "../tools/reportMiss.js";
import { upsertNode } from "../tools/upsertNode.js";

type ToolHandler = (
  args: unknown,
  ctx: { agentId: string }
) => Promise<unknown>;

// Every tool accepts an optional `workspace` (tenant scope). Absent → global.
function wsOf(args: unknown): string {
  return normalizeWorkspace((args as { workspace?: string } | null)?.workspace);
}

const WORKSPACE_PROP = {
  workspace: {
    type: "string",
    description:
      "Optional tenant scope (e.g. a product/knowledge-base id). Omit for global. On read, filters to this workspace plus global items.",
  },
} as const;

const TOOLS: Array<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler;
}> = [
  {
    name: "get_context",
    description:
      "Retrieve pre-computed cards (package/area/pr/feature/endpoint) from the indexed monorepo relevant to the given text. Call at the start of any task that mentions a service, package, PR, feature, endpoint or area.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
        types_filter: {
          type: "array",
          items: { type: "string", enum: ["package", "area", "pr", "feature", "endpoint"] },
        },
        min_score: { type: "number", minimum: 0, maximum: 1 },
        ...WORKSPACE_PROP,
      },
      required: ["text"],
      additionalProperties: false,
    },
    handler: async (args) =>
      withDb((db) => getContext(db, args as GetContextInput, wsOf(args))),
  },
  {
    name: "report_miss",
    description:
      "Log that get_context did not return useful results for the given query. Only after a genuine miss (matches:[] or all unrelated).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        notes: { type: "string" },
        ...WORKSPACE_PROP,
      },
      required: ["query"],
      additionalProperties: false,
    },
    handler: async (args) =>
      withDb((db) => {
        const a = args as { query: string; notes?: string };
        return reportMiss(db, wsOf(args), a.query, a.notes);
      }),
  },
  {
    name: "upsert_node",
    description:
      "Create or update a node (package, area, pr, feature, endpoint) with optional links. Use this at runtime to add/correct nodes found during a task.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["package", "area", "pr", "feature", "endpoint"] },
        name: { type: "string" },
        title: { type: "string" },
        summary: { type: "string" },
        body_md: { type: "string" },
        summary_ai: { type: "string" },
        keywords: { type: "array", items: { type: "string" } },
        aliases: { type: "array", items: { type: "string" } },
        extra: { type: "object" },
        source_url: { type: "string" },
        links: {
          type: "array",
          items: {
            type: "object",
            properties: {
              relation: { type: "string" },
              target_type: {
                type: "string",
                enum: ["package", "area", "pr", "feature", "endpoint"],
              },
              target_name: { type: "string" },
            },
            required: ["relation", "target_type", "target_name"],
          },
        },
        ...WORKSPACE_PROP,
      },
      required: ["type", "name"],
    },
    handler: async (args, ctx) =>
      withDb((db) =>
        upsertNode(db, args, { workspace: wsOf(args), agentId: ctx.agentId })
      ),
  },
  {
    name: "add_link",
    description: "Add a directed edge between two existing nodes. Idempotent.",
    inputSchema: {
      type: "object",
      properties: {
        source_type: { type: "string" },
        source_name: { type: "string" },
        target_type: { type: "string" },
        target_name: { type: "string" },
        relation: { type: "string" },
        ...WORKSPACE_PROP,
      },
      required: ["source_type", "source_name", "target_type", "target_name", "relation"],
      additionalProperties: false,
    },
    handler: async (args) => withDb((db) => addLink(db, args, wsOf(args))),
  },
  {
    name: "add_alias",
    description: "Add an alias to an existing node. Idempotent.",
    inputSchema: {
      type: "object",
      properties: {
        node_type: { type: "string" },
        node_name: { type: "string" },
        alias: { type: "string" },
        ...WORKSPACE_PROP,
      },
      required: ["node_type", "node_name", "alias"],
      additionalProperties: false,
    },
    handler: async (args) => withDb((db) => addAlias(db, args, wsOf(args))),
  },
  {
    name: "remove_link",
    description: "Remove a specific directed edge. Idempotent.",
    inputSchema: {
      type: "object",
      properties: {
        source_type: { type: "string" },
        source_name: { type: "string" },
        target_type: { type: "string" },
        target_name: { type: "string" },
        relation: { type: "string" },
        ...WORKSPACE_PROP,
      },
      required: ["source_type", "source_name", "target_type", "target_name", "relation"],
      additionalProperties: false,
    },
    handler: async (args) => withDb((db) => removeLink(db, args, wsOf(args))),
  },
  {
    name: "remove_node",
    description: "Remove a node by (type, name). Cascades to its edges.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string" },
        name: { type: "string" },
        ...WORKSPACE_PROP,
      },
      required: ["type", "name"],
      additionalProperties: false,
    },
    handler: async (args) => withDb((db) => removeNode(db, args, wsOf(args))),
  },
  {
    name: "ingest_bundle",
    description:
      "Bulk-ingest a canonical bundle of nodes + edges. Used by offline ingest agents. See spec/ingest-bundle.schema.json.",
    inputSchema: {
      type: "object",
      properties: {
        schema_version: { type: "string" },
        bundle_id: { type: "string" },
        branch: { type: "string" },
        commit_sha: { type: "string" },
        source_kind: {
          type: "string",
          enum: ["package_json", "cartographer", "crawler", "manual", "claude_runtime"],
        },
        source_file: { type: "string" },
        ingested_at: { type: "string" },
        replace_edges: { type: "boolean" },
        nodes: { type: "array" },
        ...WORKSPACE_PROP,
      },
      required: ["schema_version", "bundle_id", "source_kind", "nodes"],
    },
    handler: async (args, ctx) =>
      withDb((db) =>
        ingestBundle(db, args, {
          workspace: wsOf(args),
          agentId: ctx.agentId,
        })
      ),
  },
];

const counters = {
  get_context_hits: 0,
  get_context_misses: 0,
  tool_calls: new Map<string, number>(),
};

export const mcpCounters = {
  read(): { get_context_hits: number; get_context_misses: number; tool_calls: Record<string, number> } {
    return {
      get_context_hits: counters.get_context_hits,
      get_context_misses: counters.get_context_misses,
      tool_calls: Object.fromEntries(counters.tool_calls),
    };
  },
};

function newServer(agentId: string): Server {
  const server = new Server(
    { name: "mcp-mem", version: "0.3.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = TOOLS.find((t) => t.name === req.params.name);
    if (!tool) throw new Error(`unknown_tool: ${req.params.name}`);

    const args = (req.params.arguments ?? {}) as unknown;
    const cap = capForTool(req.params.name);
    const size = Buffer.byteLength(JSON.stringify(args ?? {}), "utf8");
    if (size > cap) {
      throw new Error(
        `payload_too_large_for_tool: ${req.params.name} got ${size}B, cap ${cap}B`
      );
    }

    counters.tool_calls.set(
      req.params.name,
      (counters.tool_calls.get(req.params.name) ?? 0) + 1
    );

    const result = await tool.handler(args, { agentId });

    if (req.params.name === "get_context") {
      const r = result as { matches: unknown[] };
      if (r.matches.length > 0) counters.get_context_hits++;
      else counters.get_context_misses++;
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });

  return server;
}

export async function handleMcpRequest(c: Context): Promise<Response> {
  const agentId = getAgentId(c);
  const env = c.env as { incoming?: IncomingMessage; outgoing?: ServerResponse };
  const incoming = env.incoming;
  const outgoing = env.outgoing;
  if (!incoming || !outgoing) {
    return c.json(
      {
        error: "transport_unavailable",
        reason: "Node http req/res not exposed by adapter",
      },
      500
    );
  }

  const body = await c.req.json().catch(() => undefined);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = newServer(agentId);
  await server.connect(transport);

  await transport.handleRequest(incoming, outgoing, body);

  outgoing.on("close", () => {
    transport.close().catch(() => undefined);
    server.close().catch(() => undefined);
  });

  // Adapter has already written to `outgoing`; signal Hono that the response
  // is handled out-of-band by returning a no-op Response.
  return new Response(null, { status: 200 });
}
