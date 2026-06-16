#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { openDb } from "../shared/db.js";
import { getContext } from "./tools/getContext.js";

const TOOL_NAME = "get_context";

async function main(): Promise<void> {
  const db = openDb();

  const server = new Server(
    { name: "memory", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: TOOL_NAME,
        description:
          "Retrieve pre-computed context (nodes) from the indexed monorepo relevant to the given task/ticket text. Call at the start of a coding task that mentions a service, package, or codebase area.",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description:
                "Raw task/ticket text (no need to pre-summarize).",
            },
          },
          required: ["text"],
          additionalProperties: false,
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name !== TOOL_NAME) {
      throw new Error(`Unknown tool: ${req.params.name}`);
    }
    const args = req.params.arguments as { text?: unknown } | undefined;
    if (!args || typeof args.text !== "string") {
      throw new Error("Missing required argument: text (string)");
    }
    const result = getContext(db, args.text);
    return {
      content: [
        { type: "text", text: JSON.stringify(result, null, 2) },
      ],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
