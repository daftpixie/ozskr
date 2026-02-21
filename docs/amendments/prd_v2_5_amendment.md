# ozskr.ai PRD v2.5 — Development Workflow Memory Amendment

**Purpose:** This document specifies the additions to PRD v2.4 to add persistent development workflow memory via Mem0 MCP server integration. Cross-session context persistence eliminates repeated discovery, preserves architectural decisions, and enables handoff continuity between sessions.

**Date:** February 21, 2026
**Status:** Approved — Implementation Complete
**Supersedes:** PRD v2.4 Amendment — adds Section 17 (Development Workflow Memory)
**Trigger:** Context window compaction causing loss of architectural decisions and patterns across sessions. Manual MEMORY.md files insufficient for semantic search and agent-specific context loading.

---

## Amendment 22: Add Section 17 — Development Workflow Memory

**Location:** After Section 16 (Agentic Commerce Layer)

### Section 17: Development Workflow Memory (Phase 7.D)

#### 17.1 Overview

The ozskr.ai development process uses Claude Code with 13+ specialized subagents orchestrated by Opus 4.6. Context window compaction and session boundaries cause loss of:

- Architectural decisions and their rationale
- Discovered patterns and anti-patterns
- Known bugs and their workarounds
- Dependency quirks (e.g., @solana/kit v2+ API order, Vitest 4 constructor mocks)
- Session state for handoff continuity

Mem0 provides semantic memory storage with vector search, enabling agents to retrieve relevant context by natural language query rather than scanning flat files.

#### 17.2 Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Claude Code CLI   │────▶│  mem0-mcp server  │────▶│  Mem0 Cloud │
│   (stdio transport) │◀────│  (tools/mem0-mcp) │◀────│   (API)     │
└─────────────────────┘     └──────────────────┘     └─────────────┘
         │                           │
         │  5 MCP tools              │  MemoryClient
         │  store_memory             │  user_id: "ozskr-dev"
         │  search_memory            │
         │  get_agent_context        │
         │  store_handoff            │
         │  delete_memory            │
```

**Transport:** stdio (MCP standard for CLI tools)
**Namespace:** `user_id: "ozskr-dev"` for all development workflow memory
**Isolation:** Production user memory uses `user_id: "ozskr-prod-{userId}"` (separate namespace in `src/lib/ai/`)

#### 17.3 Memory Categories

| Category | Purpose | Example |
|----------|---------|---------|
| `architecture-decision` | Design choices and rationale | "Chose Hono over tRPC for API layer because..." |
| `completed-task` | Milestone records | "Phase 7.M.9 complete: mainnet hardening" |
| `known-bug` | Bugs and workarounds | "Vitest 4 arrow functions can't be constructors" |
| `pattern` | Reusable code patterns | "@solana/kit pipe() arg order: value first, tx second" |
| `dependency` | Package quirks | "mem0ai v2.2+ requires pg peer dep" |
| `config` | Configuration notes | "JWT_SECRET must be available at edge for middleware" |
| `handoff-context` | Session continuity | "PR #42 merged. Next: Task #12 docs" |

#### 17.4 Agent Context Loading

Each subagent type has domain-specific memory focus:

| Agent | Memory Focus |
|-------|-------------|
| `solana-dev` | @solana/kit patterns, transaction pitfalls, RPC quirks |
| `frontend-dev` | Component patterns, Next.js App Router gotchas, design system |
| `ai-agent-dev` | Pipeline patterns, Mem0 integration, Claude API, prompt caching |
| `api-architect` | Hono patterns, Supabase schema, RLS, Zod schemas |
| `test-writer` | Mock patterns, test utilities, coverage gaps |
| `security-auditor` | Vulnerability patterns, audit findings |
| `code-reviewer` | Code quality patterns, naming conventions |

#### 17.5 Security

- `MEM0_API_KEY` stored in `.mcp.json` (gitignored via `*.json` rule)
- `.mcp.json.example` committed with placeholder for onboarding
- Development memory namespace isolated from production user memory
- No PII stored in development memory — only technical context
- Mem0 Cloud handles encryption at rest and in transit

#### 17.6 Implementation

| Component | Location | Status |
|-----------|----------|--------|
| MCP server | `tools/mem0-mcp/` | Complete |
| MCP config | `.mcp.json` | Template committed (`.mcp.json.example`) |
| CLAUDE.md section | Memory Protocol | Complete |
| PRD amendment | `docs/amendments/prd_v2_5_amendment.md` | This document |
| Master Plan amendment | `docs/amendments/master_plan_v3_4_amendment.md` | Complete |
| Protocol docs | `docs/development/memory-protocol.md` | Complete |

---

## Amendment 23: Update Phase Status Table

**Location:** Phase status section

**Add after Phase 7.M:**
```
- [x] Phase 7.D: Development Workflow Memory (Mem0 MCP integration)
```

---

## Amendment 24: Update Architecture Diagram

**Location:** Section 1 (Architecture Overview)

**Add to architecture tree:**
```
tools/                              # Development tooling (private)
└── mem0-mcp/                       # MCP server for persistent dev workflow memory via Mem0
```
