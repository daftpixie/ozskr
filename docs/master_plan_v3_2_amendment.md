# ozskr.ai Master Plan v3.2 — @ozskr/x402-solana-mcp Build Amendment

**Date:** February 13, 2026
**Author:** Technical Architecture Review (Opus 4.6) + Matt (Strategic Direction)
**Context:** Deep research confirmed zero existing MCP servers combine x402 + Solana + SPL token delegation. Matt approved immediate build. This amendment creates Phase 7.M, defines the 3-week sprint plan, updates agent assignments, and modifies the phase map.
**Supersedes:** Master Plan v3.1 Amendment, Phase 8.7 definition (x402-solana-mcp moves to 7.M)

---

## Part 13: Phase 7.M — @ozskr/x402-solana-mcp Build Sprint

### Why This Moves Up

The v3.1 amendment placed the MCP server at Phase 8.7 — gated behind 100+ beta users, attorney sign-off, and x402 ecosystem recovery. Deep research on February 13, 2026 revealed that:

1. **The gap is real and confirmed.** 13+ x402 MCP implementations surveyed. Zero combine Solana + SPL delegation.
2. **The window is closing.** Coinbase Payments MCP adding Solana wallet support imminently. Stripe expanding x402 beyond Base. MCPay already supports Solana without delegation.
3. **The MCP server is separable from the platform.** It's a standalone open-source tool that doesn't require ozskr.ai to be running. Building it doesn't compete with Phase 7 launch — it runs in parallel.
4. **The legal surface is narrow.** Publishing an open-source payment library is fundamentally different from operating a payment platform. 2 attorney questions, not 9.

The activation gates for Phase 8 (users, revenue, attorney) still apply to ozskr.ai's *platform* x402 integration. They do NOT apply to publishing an open-source MCP server.

### Sprint Structure (3 Weeks)

```
WEEK 1: Foundation
├── Day 1-2: agent-wallet-sdk scaffolding
│   ├── delegate.ts — SPL approveChecked/transferChecked/revokeChecked helpers
│   ├── budget.ts — Spending cap tracking and enforcement
│   ├── keypair.ts — Agent keypair generation + encrypted local storage
│   └── Unit tests for all delegation operations (devnet)
│
├── Day 3-4: MCP server scaffolding
│   ├── server.ts — MCP server definition using @modelcontextprotocol/sdk
│   ├── Tool stubs for all 6 tools (type-safe, not yet wired)
│   ├── Configuration schema (env vars, .mcp.json support)
│   └── stdio + HTTP transport setup
│
└── Day 5: Integration point
    ├── Wire x402_approve_delegation to delegate.ts
    ├── Wire x402_check_balance to budget.ts
    ├── Wire x402_revoke_delegation to delegate.ts
    └── Devnet integration test: approve → check → revoke lifecycle

WEEK 2: x402 Payment Flow
├── Day 1-2: Core payment tool
│   ├── x402_pay implementation:
│   │   1. Initial HTTP request to target URL
│   │   2. Parse 402 response (amount, recipient, network, token)
│   │   3. Construct SPL transferChecked as delegate
│   │   4. Submit payment proof to facilitator
│   │   5. Retry original request with payment signature
│   ├── Facilitator integration (Coinbase CDP primary, PayAI fallback)
│   └── Transaction simulation before every payment
│
├── Day 3: Supporting tools
│   ├── x402_transaction_history — query on-chain tx history for agent keypair
│   └── x402_discover_services — query known x402 service registries
│
├── Day 4-5: Testing
│   ├── End-to-end devnet test: approve delegation → pay x402 endpoint → verify on-chain
│   ├── Error handling: insufficient balance, expired delegation, failed facilitator
│   ├── Edge cases: double-spend prevention, concurrent tool calls, timeout handling
│   └── Claude Code integration test: install via `claude mcp add`, execute payment

WEEK 3: Ship
├── Day 1-2: Documentation
│   ├── README.md — Installation, quickstart, configuration, examples
│   ├── ARCHITECTURE.md — Technical design decisions, security model
│   ├── CONTRIBUTING.md — How to contribute, development setup
│   └── Example projects: basic payment, budget-capped agent, custom token
│
├── Day 3: Publication prep
│   ├── npm package configuration (@ozskr scope)
│   ├── GitHub repository setup (MIT license, CI/CD, issue templates)
│   ├── Package.json metadata (keywords: x402, solana, mcp, ai-agent, delegation)
│   └── Attorney review submission (2 scoped questions)
│
├── Day 4: Soft launch
│   ├── Publish to npm as v0.1.0-beta
│   ├── Submit to MCP server directories (mcp.so, PulseMCP, LobeHub)
│   ├── Submit to x402 ecosystem page (x402.org/ecosystem)
│   └── Register on Solana developer resources
│
└── Day 5: Announcement
    ├── Thread on X/Twitter from ozskr.ai account
    ├── Post on Solana developer forum
    ├── Submission to Anthropic MCP showcase
    └── GitHub discussion: "RFC: SPL delegation pattern for agent wallets"
```

### Agent Team Assignments

| Task | Agent | Rationale |
|------|-------|-----------|
| `agent-wallet-sdk` (delegate.ts, budget.ts) | `solana-dev` | SPL Token Program is core Solana domain |
| `agent-wallet-sdk` (keypair.ts) | `solana-dev` + `security-auditor` | Key management requires security review |
| MCP server scaffolding (server.ts, tools/) | `ai-agent-dev` | MCP SDK is agent infrastructure |
| x402 payment flow (x402_pay) | `solana-dev` + `ai-agent-dev` | Cross-domain: Solana tx + HTTP protocol |
| Testing (unit + integration) | `test-writer` | Comprehensive coverage required for OSS |
| Documentation | `ai-agent-dev` | README-first development |
| Security review | `security-auditor` | Pre-publication audit |
| Code review (all PRs) | `code-reviewer` | Quality gate before merge |

**Not involved:** `frontend-dev` (no UI), `api-architect` (no Hono routes — that's Phase 8)

### Build Configuration

```yaml
# packages/x402-solana-mcp/package.json
{
  "name": "@ozskr/x402-solana-mcp",
  "version": "0.1.0-beta",
  "description": "First MCP server for AI agent x402 payments on Solana with SPL delegation",
  "license": "MIT",
  "bin": {
    "x402-solana-mcp": "./dist/cli.js"
  },
  "keywords": ["mcp", "x402", "solana", "ai-agent", "delegation", "payments", "claude-code"],
  "engines": { "node": ">=20" },
  "dependencies": {
    "@solana/kit": "^2.1.0",
    "@x402/svm": "^0.3.0",
    "@x402/core": "^0.3.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@ozskr/agent-wallet-sdk": "workspace:*"
  },
  "peerDependencies": {},
  "devDependencies": {
    "vitest": "^3.0.0",
    "typescript": "^5.7.0"
  }
}
```

```yaml
# packages/agent-wallet-sdk/package.json
{
  "name": "@ozskr/agent-wallet-sdk",
  "version": "0.1.0-beta",
  "description": "Non-custodial AI agent wallets on Solana with SPL delegation and budget enforcement",
  "license": "MIT",
  "keywords": ["solana", "ai-agent", "wallet", "delegation", "spl-token", "non-custodial"],
  "engines": { "node": ">=20" },
  "dependencies": {
    "@solana/kit": "^2.1.0"
  }
}
```

### Workspace Configuration

```yaml
# pnpm-workspace.yaml (updated)
packages:
  - 'packages/*'
```

### What This Does NOT Change

- **Phase 7 launch timeline:** The MCP server build runs in parallel on a separate git worktree. It does not compete with launch operations work.
- **Phase 8 activation gates:** ozskr.ai's platform x402 integration still requires 100+ users, attorney sign-off on all 9 questions, x402 ecosystem recovery, and Ayrshare migration.
- **Phase 9 definition:** Agent marketplace remains ecosystem-dependent.
- **Consumer product scope:** The MCP server is an open-source developer tool. It does not appear in the ozskr.ai consumer UI until Phase 8.

---

## Part 14: Updated Phase Map (v3.2)

### Complete Phase Structure

```
COMPLETED:
- [x] Phase 1: Foundation
- [x] Phase 2: Agent Core
- [x] Phase 3: Trading
- [x] Phase 4: Hardening
- [x] Phase 5: Polish
- [x] Phase 6: Launch Operations (engineering complete)

CURRENT:
- [ ] Phase 7: Go-to-Market ← CURRENT
  - [ ] 7.1: AI compliance hardening
  - [ ] 7.2: Glinda activation (content, social, community)
  - [ ] 7.3: Toto activation (grants, pitch, revenue)
  - [ ] 7.4: Internal alpha testing (Matt + 5-10 users, devnet)
  - [ ] 7.5: Closed alpha (25-50 users, devnet)
  - [ ] 7.6: Private beta (100-250 users, devnet + mainnet read)
  - [ ] 7.7: Product Hunt launch
  - [ ] 7.8: Open beta (500+ users, mainnet safeguarded)
  
  >>> 7.P: Plumbing (~1 day, ships within Phase 7):
      - agent_service_usage schema + RLS
      - AgentServiceClient abstraction in content pipeline
      - Agent budget estimate in creation UX
      - Attorney questions (9+2) added to pending review
      - Phase 8/9 in CLAUDE.md

  >>> 7.M: MCP Server Build (3 weeks, parallel worktree): ← NEW
      - @ozskr/agent-wallet-sdk (SPL delegation, budget, keypair)
      - @ozskr/x402-solana-mcp (6 MCP tools, x402 payment flow)
      - Documentation, testing, npm publication
      - MCP directory submissions, ecosystem announcements
      - Attorney review (2 scoped questions for OSS publication)

FUTURE (Activation-Gated):
- [ ] Phase 8: Agentic Commerce Layer (10-14 weeks)
  Requires: 100+ users, attorney sign-off, x402 recovery, Ayrshare migration
  - [ ] 8.1: Attorney sign-off on platform delegation model
  - [ ] 8.2: Platform integration of agent-wallet-sdk (already built in 7.M)
  - [ ] 8.3: x402 server middleware (@x402/hono on platform API endpoints)
  - [ ] 8.4: Agent wallet delegation UX (approve, revoke, dashboard)
  - [ ] 8.5: Platform outbound x402 client (agents pay for fal.ai, data APIs)
  - [ ] 8.6: $HOPE x402 facilitator (PayAI or custom + Jupiter auto-swap)
  - [ ] 8.7: REMOVED — absorbed into 7.M
  - [ ] 8.8: ZK compliance attestation MVP (@ozskr/zk-agent-attestation)
  - [ ] 8.9: OFAC screening integration (Chainalysis or TRM Labs)
  - [ ] 8.10: Security audit of platform agent wallet + key management
  - [ ] 8.11: Open-source zk-agent-attestation publication

- [ ] Phase 9: Agent Marketplace (10-15 weeks + audit)
  Requires: Phase 8 stable 3+ months, 500+ agents, ecosystem maturation
  - [ ] 9.1-9.9: Unchanged from v3.1

DEFERRED (Unchanged):
- [ ] Auto-Stake Smart Contract
- [ ] Instagram/TikTok/LinkedIn direct API migration
```

### Phase 8 Impact Analysis

Moving the MCP server to 7.M reduces Phase 8 scope by approximately 2-3 weeks:
- Phase 8.2 becomes "integrate already-built SDK" rather than "build SDK from scratch"
- Phase 8.7 is eliminated entirely (absorbed into 7.M)
- Phase 8 estimated timeline reduces from 10-14 weeks to **7-11 weeks**

This means when Phase 8 activation gates are met, the platform can integrate x402 significantly faster because the core packages already exist, are tested, and have real-world usage data from the open-source community.

---

## Part 15: Updated Risk Register (v3.2 Additions)

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| MCP server build delays Phase 7 launch | Medium | Low | Separate git worktree, separate agent assignments, no shared dependencies |
| Competitor ships Solana x402 MCP first | High — loses first-mover claim | Medium | 3-week sprint is aggressive but achievable. MVP first, polish later. |
| Attorney flags OSS publication risk | Medium — delays npm publish | Low | 2 narrowly scoped questions. Expected answer: standard OSS liability applies. Build continues regardless; only publication gates on attorney. |
| x402 SDK breaking changes during build | Low — delays integration | Medium | Pin @x402/svm and @x402/core versions. Monitor coinbase/x402 releases. |
| Low adoption post-publication | Low — reputational only | Medium | Adoption is a bonus, not a requirement. Primary value is strategic positioning and ozskr.ai's own future use. |
| npm scope @ozskr not available | Low — naming issue | Low | Check availability immediately. Fallback: @ozskr-ai or ozskr-x402-solana-mcp |

---

## Part 16: Immediate Actions (v3.2 Update)

### Matt (This Week)

*All previous items from v3.1 unchanged, plus:*

11. **Approve Phase 7.M sprint start** ← THIS DOCUMENT
12. Verify npm scope `@ozskr` availability (`npm login` + `npm org create ozskr`)
13. Add 2 MCP-specific attorney questions to legal review package (Appendix D.4 scoped questions)
14. Brief agent hive on Phase 7.M activation (update CLAUDE.md with sprint plan)

### Claude Code (Phase 7.M Sprint — NEW)

1. Initialize `packages/` workspace in pnpm-workspace.yaml
2. Scaffold `packages/agent-wallet-sdk/` with TypeScript config
3. Scaffold `packages/x402-solana-mcp/` with TypeScript config
4. Implement SPL delegation helpers (delegate.ts) with devnet tests
5. Implement MCP server with 6 tool definitions
6. Wire x402 payment flow (402 → pay → retry cycle)
7. Write comprehensive test suite (unit + integration + e2e on devnet)
8. Write README-first documentation for both packages
9. Security review of key management and transaction signing
10. Prepare npm publication (package.json, .npmrc, CI/CD)

### Claude Code (Phase 7 — Unchanged)

*Items 1-14 from v3.1 continue in parallel on main branch*

---

## Part 17: The Narrative

The story writes itself, and it's the strongest positioning ozskr.ai has produced:

**A solo founder orchestrates a hive of eight AI development agents via Claude Code to build a platform where users create AI content agents. Those development agents — themselves running on MCP — build and publish the first MCP server that enables any AI agent on the internet to make autonomous payments on Solana. The tool they build becomes infrastructure for the entire ecosystem. The agents build the payment rails that agents will use.**

This isn't a pitch deck talking point. It's a provable, on-chain, open-source, git-historied fact. Every commit from the agent hive, every npm download of the package, every x402 transaction facilitated — it's all verifiable.

When the Solana Foundation, Anthropic, or Coinbase asks "what have you built?", the answer isn't "a content creation app." It's "the tool that gave AI agents wallets on Solana."

---

*"Pay no mind to the agents behind the emerald curtain — they're busy building the payment rails."*

**ozskr.ai — Your agents speak. Your agents transact. You remain unseen.**
