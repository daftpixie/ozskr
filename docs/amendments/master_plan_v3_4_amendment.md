# ozskr.ai Master Plan v3.4 — Development Workflow Memory Amendment

**Date:** February 21, 2026
**Author:** Technical Architecture Review (Opus 4.6) + Matt (Strategic Direction)
**Context:** Cross-session context loss identified as recurring friction point. Architectural decisions, dependency quirks, and session state lost to context window compaction. Mem0 MCP server provides semantic memory with vector search for development workflow persistence.
**Supersedes:** Master Plan v3.3 Amendment — adds Phase 7.D (Development Workflow Memory)

---

## Part 20: Phase 7.D — Development Workflow Memory

### Problem Statement

The ozskr.ai development process relies on Claude Code sessions that frequently hit context window limits. When context is compacted or a new session starts:

1. **Architectural decisions are re-discovered** — agents re-learn patterns like `@solana/kit` argument ordering, Vitest 4 mock patterns, Hono route typing
2. **Session state is lost** — task progress, blockers, and next steps must be manually re-communicated
3. **Manual MEMORY.md is insufficient** — flat file cannot be semantically searched, has no category filtering, and grows linearly

### Solution

A Mem0-backed MCP server (`tools/mem0-mcp/`) provides:

- **Semantic search** — agents query by natural language, not file scanning
- **Category filtering** — 7 categories (architecture-decision, pattern, known-bug, etc.)
- **Agent-scoped context** — `get_agent_context` loads domain-specific memories at session start
- **Handoff persistence** — `store_handoff` captures session state for continuity
- **Deletion** — `delete_memory` removes outdated or incorrect memories

### Implementation (Sprint 7.D.1 — Single Sprint)

| Step | Task | Status |
|------|------|--------|
| 1 | Create `tools/mem0-mcp/` package (TypeScript, MCP SDK, Mem0 client) | Complete |
| 2 | Implement 5 MCP tools (store, search, get_agent_context, handoff, delete) | Complete |
| 3 | Configure `.mcp.json` for Claude Code | Complete |
| 4 | Update `CLAUDE.md` with Memory Protocol section | Complete |
| 5 | Add agent-specific memory guidance to CLAUDE.md | Complete |
| 6 | Create PRD v2.5 amendment | Complete |
| 7 | Create Master Plan v3.4 amendment | This document |
| 8 | Create memory protocol documentation | Complete |

### Agent Ownership

| Task | Agent |
|------|-------|
| MCP server implementation | `ai-agent-dev` |
| CLAUDE.md updates | Orchestrator (Opus) |
| Documentation | `content-writer` |
| Security review | `security-auditor` |

### Success Criteria

1. MCP server builds cleanly (`pnpm build` in `tools/mem0-mcp/`)
2. 5 tools registered and callable via Claude Code
3. Memories persist across sessions
4. Agent context loading returns domain-relevant memories
5. Handoff context enables session continuity without manual re-communication
6. No secrets in committed files (`.mcp.json` gitignored, `.mcp.json.example` committed)

### Relationship to Existing Memory

| System | Scope | Mechanism |
|--------|-------|-----------|
| `MEMORY.md` (auto memory) | Session-local patterns | Flat file, auto-loaded into system prompt |
| `CLAUDE.md` | Project-wide instructions | Manual, version-controlled |
| Mem0 MCP (this) | Cross-session semantic memory | Vector search, category filtering, API-backed |
| Mem0 Production (`src/lib/ai/`) | Per-user agent personality memory | Isolated namespaces, user-facing |

The development workflow memory (Mem0 MCP) complements — not replaces — `MEMORY.md` and `CLAUDE.md`. Auto memory captures immediate session patterns. CLAUDE.md captures durable project rules. Mem0 MCP captures the middle layer: decisions, patterns, and context that are too detailed for CLAUDE.md but too important to lose at session boundaries.

---

## Part 21: Updated Phase Status

**Add to phase tracking:**

```
- [x] Phase 7.D: Development Workflow Memory (Mem0 MCP — single sprint, complete)
  - [x] 7.D.1: MCP server + configuration + documentation
```

**Updated package count:**
- 292 package tests (76 SDK + 88 MCP + 128 facilitator) + mem0-mcp (0 tests — private tool, not published)
- 659 app tests
- 1 new private package (`@ozskr/mem0-mcp`)
