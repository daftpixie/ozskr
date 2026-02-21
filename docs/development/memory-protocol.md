# Memory Protocol — Mem0 MCP Integration

This document describes how the ozskr.ai development workflow uses Mem0 for persistent cross-session memory.

## Quick Start

1. Get a Mem0 API key from [mem0.ai](https://mem0.ai)
2. Copy `.mcp.json.example` to `.mcp.json`
3. Add your API key to `.mcp.json`
4. Build the server: `cd tools/mem0-mcp && pnpm build`
5. Restart Claude Code — the MCP server auto-starts via `.mcp.json`

## Tools

### store_memory

Store a development memory with category and optional agent/tag metadata.

**Parameters:**
- `content` (required) — The memory text
- `category` (required) — One of: `architecture-decision`, `completed-task`, `known-bug`, `pattern`, `dependency`, `config`, `handoff-context`
- `agent` (optional) — Owning agent domain (e.g., `solana-dev`, `frontend-dev`)
- `tags` (optional) — Array of string tags for additional filtering

**Example:**
```
store_memory({
  content: "@solana/kit pipe() functions take the value as first arg, tx as second: setTransactionMessageFeePayer(address, tx)",
  category: "pattern",
  agent: "solana-dev",
  tags: ["@solana/kit", "transaction"]
})
```

### search_memory

Search memories by natural language query with optional filters.

**Parameters:**
- `query` (required) — Natural language search query
- `category` (optional) — Filter by category
- `agent` (optional) — Filter by agent domain
- `limit` (optional) — Max results, 1-50 (default 10)

**Example:**
```
search_memory({
  query: "Vitest mock constructor pattern",
  category: "pattern",
  limit: 5
})
```

### get_agent_context

Load all memories relevant to a specific agent domain. Call this at the start of an agent session.

**Parameters:**
- `agent` (required) — Agent domain to get context for
- `include_handoffs` (optional) — Include recent handoff context (default true)

**Example:**
```
get_agent_context({
  agent: "solana-dev",
  include_handoffs: true
})
```

### store_handoff

Store session handoff context for continuity. Call this at the end of a session or before context compaction.

**Parameters:**
- `context` (required) — Current state, pending work, blockers, next steps
- `agent` (optional) — Primary agent domain
- `session_summary` (optional) — Brief summary of session accomplishments

**Example:**
```
store_handoff({
  context: "PR #42 merged. Task #12 (docs) in progress. Next: typecheck + commit.",
  agent: "frontend-dev",
  session_summary: "Added OG metadata to all public pages, created convenience routes for legal pages"
})
```

### delete_memory

Remove an outdated or incorrect memory by ID. Use `search_memory` first to find the ID.

**Parameters:**
- `memory_id` (required) — The memory ID to delete

**Example:**
```
delete_memory({ memory_id: "mem_abc123" })
```

## Memory Categories

| Category | When to Use |
|----------|-------------|
| `architecture-decision` | Design choices with rationale — "chose X over Y because..." |
| `completed-task` | Milestone completions — "Phase 7.M.9 mainnet hardening complete" |
| `known-bug` | Bugs with workarounds — "Vitest 4 arrow fns can't be constructors" |
| `pattern` | Reusable code patterns — "@solana/kit arg order: value first, tx second" |
| `dependency` | Package quirks — "mem0ai v2.2+ has pg peer dep warning" |
| `config` | Configuration notes — "JWT_SECRET must be available at edge" |
| `handoff-context` | Session continuity — current state, next steps, blockers |

## Namespace Isolation

| Namespace | user_id | Purpose |
|-----------|---------|---------|
| Development | `ozskr-dev` | Shared dev workflow memory (all sessions) |
| Production | `ozskr-prod-{userId}` | Per-user agent personality memory (app) |

These namespaces are completely isolated in Mem0. Development memories are never accessible from production and vice versa.

## Best Practices

1. **Be specific** — "pipe() takes instruction first, tx second" is better than "be careful with pipe()"
2. **Include rationale** — "chose Hono over tRPC because edge runtime support" is better than "using Hono"
3. **Tag with agent** — always set the `agent` field so `get_agent_context` returns relevant results
4. **Clean up** — delete memories that are no longer accurate
5. **Handoff early** — store handoff context before you think the session might end
6. **Don't duplicate CLAUDE.md** — memory is for discoveries, CLAUDE.md is for rules

## Architecture

```
tools/mem0-mcp/
├── package.json          # @ozskr/mem0-mcp (private)
├── tsconfig.json         # ES2022, Node16 modules
├── src/
│   └── index.ts          # MCP server with 5 tools
└── dist/                 # Built output (gitignored)
    └── index.js          # Entry point for .mcp.json
```

The server uses `@modelcontextprotocol/sdk` with `StdioServerTransport` for Claude Code integration. It creates a `MemoryClient` from `mem0ai` on each tool call (no persistent connection needed — Mem0 is REST-backed).
