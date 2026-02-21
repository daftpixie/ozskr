# @ozskr/mem0-mcp

> **Internal development tool** — not published to npm. Used by the ozskr.ai team to give Claude Code persistent memory across sessions via Mem0.

MCP server that provides 5 tools for storing and retrieving development workflow memories. Enables Claude Code agents to remember architectural decisions, discovered patterns, completed tasks, and known bugs across sessions — so you never start from scratch.

## What It Does

Without this server, Claude Code forgets everything between sessions. With it:

- Architecture decisions stay remembered: "we use Hono not Express, here's why"
- Discovered patterns persist: "Vitest 4 constructor mocks need `vi.fn(function(){})`"
- Completed milestones accumulate: "Phase 5 done, Phase 6 in progress"
- Blockers carry forward: "500 errors on agent creation, root cause TBD"
- Agent handoffs work: "solana-dev left off at step 3 of the delegation flow"

All memories are stored in Mem0 under `user_id: "ozskr-dev"` (shared across all dev sessions).

## Setup

### 1. Get a Mem0 API key

Sign up at [mem0.ai](https://mem0.ai) and create an API key.

### 2. Configure .mcp.json

Copy the example and add your API key:

```bash
cp .mcp.json.example .mcp.json
# Edit .mcp.json and set MEM0_API_KEY
```

Your `.mcp.json` should look like:

```json
{
  "mcpServers": {
    "mem0": {
      "command": "node",
      "args": ["tools/mem0-mcp/dist/index.js"],
      "env": {
        "MEM0_API_KEY": "your-mem0-api-key-here"
      }
    }
  }
}
```

`.mcp.json` is gitignored — never commit your API key.

### 3. Build the server

```bash
cd tools/mem0-mcp
pnpm install
pnpm build
```

### 4. Verify it works

Start a Claude Code session. The 5 tools should appear in the tool list. Run a quick test:

```
Use store_memory to store "test memory" with category "config"
Use search_memory to search for "test memory"
```

## Available Tools

### `store_memory`

Store a development workflow memory.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | `string` | Yes | The memory content |
| `category` | `enum` | Yes | See categories below |
| `agent` | `enum` | No | Owning agent domain (see agents below) |
| `tags` | `string[]` | No | Additional tags for filtering |

**Returns**: `{ success: true, memories: [...] }` with event IDs (async — memory available in ~30s)

---

### `search_memory`

Search memories by natural language query. Returns results ranked by semantic similarity.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `string` | Yes | Natural language search query |
| `category` | `enum` | No | Filter by category |
| `agent` | `enum` | No | Filter by agent domain |
| `limit` | `number` | No | Max results 1–50 (default: 10) |

**Returns**: `{ success: true, count: N, memories: [...] }` with IDs and relevance scores

---

### `get_agent_context`

Retrieve all memories relevant to a specific agent domain. Call this at the start of an agent session to load context.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agent` | `enum` | Yes | Agent domain to load context for |
| `include_handoffs` | `boolean` | No | Include handoff context (default: true) |

**Returns**: `{ success: true, agent, memories: [...], handoffs: [...] }`

---

### `store_handoff`

Store session handoff context for continuity across sessions. Include current state, pending work, blockers, and next steps.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `context` | `string` | Yes | Current state, pending work, blockers, next steps |
| `agent` | `enum` | No | Primary agent domain for this handoff |
| `session_summary` | `string` | No | Brief summary of what was accomplished |

**Returns**: `{ success: true, memories: [...] }`

---

### `delete_memory`

Delete an outdated or incorrect memory by its ID. Use `search_memory` first to find the ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `memory_id` | `string` | Yes | Memory ID from a `search_memory` result |

**Returns**: `{ success: true, message: "Memory deleted successfully!" }`

Note: `delete_memory` may return a transient network error on first attempt — retry once if this happens.

## Memory Categories

| Category | When to Use |
|----------|-------------|
| `architecture-decision` | Tech stack choices, structural decisions, pattern choices |
| `completed-task` | Finished phases, shipped features, milestones |
| `known-bug` | Discovered bugs, blockers, unresolved issues |
| `pattern` | Reusable code patterns, gotchas, conventions |
| `dependency` | Package decisions, version constraints, workspace setup |
| `config` | Environment variables, deployment config, current phase status |
| `handoff-context` | Session handoffs — automatically set by `store_handoff` |

## Agent Domains

Valid values for the `agent` parameter:

`solana-dev` · `frontend-dev` · `ai-agent-dev` · `api-architect` · `test-writer` · `security-auditor` · `code-reviewer` · `devops-infra` · `content-writer` · `social-integration-dev` · `glinda-cmo` · `toto-funding`

Memories stored without an `agent` are shared across all domains (visible to all searches).

## Namespace Strategy

| Namespace | `user_id` | Purpose |
|-----------|-----------|---------|
| Dev workflow | `ozskr-dev` | All memories from this server (hardcoded) |
| Prod user memory | `ozskr-prod-{userId}` | End-user agent memory in `src/lib/ai/memory.ts` |

**These namespaces must never overlap.** This server only ever writes to `ozskr-dev`.

## How Mem0 Processes Writes

`store_memory` and `store_handoff` return `{ status: "PENDING", event_id: "..." }` immediately — writes are processed asynchronously. The memory is searchable within ~30 seconds. Do not use the `event_id` as a `memory_id` for deletion — use the `id` field from a `search_memory` result.

## Usage Pattern (CLAUDE.md)

```
Session start:   get_agent_context(agent)       → load relevant context
During work:     search_memory(query)            → check prior decisions
After deciding:  store_memory(content, category) → persist the decision
Session end:     store_handoff(context, summary) → hand off to next session
```

## Development

```bash
cd tools/mem0-mcp

# Install dependencies
pnpm install

# Build (compiles TypeScript to dist/)
pnpm build

# Watch mode for development
pnpm dev

# Run the server manually (for testing)
MEM0_API_KEY=your-key node dist/index.js
```

The server uses stdio transport — it communicates via stdin/stdout with the MCP client. Don't run it directly in a terminal; use it via Claude Code's MCP integration.

## Files

```
tools/mem0-mcp/
├── src/
│   └── index.ts     # All 5 tools, server setup, stdio transport
├── dist/            # Compiled output (gitignored)
├── package.json     # private: true — never published to npm
└── tsconfig.json    # ES2022, Node16 module resolution
```

## This is a Private Tool

This package has `"private": true` in `package.json`. It is an internal development tool and is **never published to npm**. The Mem0 API key in `.mcp.json` must stay out of version control.

---

Part of the [ozskr.ai](https://ozskr.ai) project. See the [root README](../../README.md) for the full platform overview.
