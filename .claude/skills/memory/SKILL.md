---
name: memory
description: Use at the start of any coding task that references a service, package, endpoint, library, DB table, or domain entity from the indexed monorepo (typical inputs are Jira ticket texts, error logs, free-text task descriptions). The skill instructs Claude to call mcp__memory__get_context first so it can ground its work in pre-computed Package cards instead of exploring the codebase blind.
---

# Memory skill

Before starting a coding task that involves the indexed monorepo:

1. Call the MCP tool `mcp__memory__get_context` with the user's full task description (or pasted ticket text) as the `text` argument. **Do not pre-summarize** — pass the raw text; the server's tokenizer relies on the literal entity names the ticket mentions.
2. Read the returned `matches`. Each match contains:
   - `card`: the Package card (name, path, description, README excerpt, dependencies, scripts, aliases, entry points)
   - `type`: always `"package"` in the PoC
   - `reason`: how it matched (`exact_name` / `alias` / `fts`)
   - `score`: relevance (1.0 = exact name match, 0.8 = alias, ≤ 0.6 = FTS)
   - `links_out`: 1-hop neighbors via `depends_on` (other packages this one depends on, intra-monorepo only)
3. State in 1 short sentence which package(s) you've identified as relevant, citing them by name. Then continue with the task using that context.
4. If you need a neighbor's full card, call `get_context` again with the neighbor's name.

If `get_context` returns `matches: []`, proceed normally — do not block, but mention that you found no pre-indexed context.
