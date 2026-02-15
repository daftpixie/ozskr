# ozskr.ai Master Plan v3.3 — @ozskr/x402-facilitator Build Amendment

**Date:** February 15, 2026
**Author:** Technical Architecture Review (Opus 4.6) + Matt (Strategic Direction)
**Context:** Stage 3 MCP integration testing completed (13/13 passed, 7 bugs identified). Deep analysis of facilitator architecture confirmed Option 3 (Coinbase @x402/svm reference + custom Hono governance service) as optimal build path. Matt approved immediate build as parallel priority alongside npm publication of MCP server and agent-wallet-sdk. Attorney consultation in progress — formal opinion expected within days.
**Supersedes:** Master Plan v3.2 Amendment — extends Phase 7.M, adds facilitator build track, realigns agent assignments

---

## Part 18: Phase 7.M Extension — @ozskr/x402-facilitator Build Track

### Why the Facilitator Moves Into 7.M

The v3.2 amendment placed facilitator selection at Phase 8.6 with three options (Coinbase CDP, PayAI, self-hosted Kora). Stage 3 testing on February 14-15, 2026 eliminated all three:

1. **Coinbase CDP cannot handle devnet test tokens or $HOPE.** Every Stage 3 test required a local facilitator because production facilitators reject non-mainnet tokens.
2. **PayAI's facilitator is a third-party dependency with unclear compliance posture** and uses deprecated @solana/web3.js.
3. **Kora is a Rust binary.** Wrong language for a TypeScript-first agent team. Abstracts signing in a way that prevents governance interception before co-signing.
4. **Bug 7 (payment settles before verification) requires an architectural fix at the facilitator layer** — simulate-before-submit. No existing facilitator implements this.
5. **No existing facilitator implements governance hooks** — OFAC screening, delegation validation, budget enforcement, circuit breaker. These are table stakes for autonomous agent commerce.

The facilitator is not Phase 8 infrastructure. It is the completion of the payment pipeline started in 7.M. Without it, the MCP server points at either a local test stub or a third-party service that doesn't support the token, the governance model, or the network.

### Updated Sprint Structure (7.M Expanded)

The facilitator build runs parallel to the bug fix + republish + announcement track. It does not block npm publication of the MCP server or agent-wallet-sdk.

```
═══════════════════════════════════════════════════════════════
TRACK A: BUG FIX + REPUBLISH + ANNOUNCE (Days 1-5)
═══════════════════════════════════════════════════════════════

Day 1-2: Bug Fixes (Bugs 1-4, 7)
├── Bug 1 (Critical): Scrypt param mismatch — store params in keypair file
├── Bug 2 (Critical): 402 body parsing stubbed — make async, add body parsing
├── Bug 3 (Medium): paymentPayload.accepted undefined for V1
├── Bug 4 (Medium): Recipient verification toString() on objects
├── Bug 7 (Critical): Simulate-before-submit guard in x402-client
├── Re-run Stage 1 smoke tests against fixes
└── Bump versions: agent-wallet-sdk 0.1.1-beta, x402-solana-mcp 0.2.0-beta

Day 3: Stage 2-3 Regression
├── Re-run Stage 2 delegation lifecycle (confirm Bug 1 fix)
├── Re-run Stage 3 tests 7-9 (payment flow with Bug 7 fix)
├── Verify: no fund loss on verification failure (Bug 7 resolved)
└── Record demo: screen recording of Claude Code paying on Solana devnet

Day 4: Publication + Directory Submission
├── npm publish 0.2.0-beta (both packages)
├── Submit to MCP directories: mcp.so, PulseMCP, LobeHub
├── Submit to x402.org/ecosystem
└── Submit to Anthropic MCP showcase

Day 5: Announcement
├── X/Twitter thread: lead with screen recording + Explorer links
├── Solana developer forum post
├── GitHub discussion: "RFC: SPL delegation pattern for agent wallets"
└── Respond to engagement

═══════════════════════════════════════════════════════════════
TRACK B: FACILITATOR BUILD (Days 1-10, parallel)
═══════════════════════════════════════════════════════════════

Day 1-2: Facilitator Scaffolding
├── packages/x402-facilitator/ workspace initialization
├── Hono app with 3 route stubs (/verify, /settle, /supported)
├── Zod schemas for all x402 request/response types
├── Configuration system (env vars: RPC URL, fee payer keypair path,
│   supported tokens, supported networks)
├── Fee payer keypair management (load, validate SOL balance)
└── Unit tests for schema validation

Day 3-4: Verification Pipeline
├── Wire @x402/svm reference verification into POST /verify
│   ├── Signature validation
│   ├── Amount matching
│   ├── Replay detection (in-memory Set + TTL)
│   └── Expiry checking
├── Define clean internal VerificationResult interface
│   (this is the Option 5 seam — @x402/svm sits behind this interface,
│    replaceable with native @solana/kit verification later)
├── GET /supported implementation (tokens, networks, fee payer address)
└── Unit tests for verification edge cases

Day 5-6: Governance Layer
├── governance/ofac-screening.ts
│   ├── Static OFAC SDN blocklist check (JSON file, updated weekly)
│   ├── Interface for Chainalysis API (implemented later, stubbed now)
│   └── Fail-open vs fail-closed configuration
├── governance/delegation-check.ts
│   ├── On-chain delegation status query (@solana/kit)
│   ├── Remaining budget validation
│   └── Delegation expiry detection
├── governance/budget-enforce.ts
│   ├── Independent budget cap enforcement (belt-and-suspenders with SDK)
│   └── Budget tracking per agent-owner pair
├── governance/circuit-breaker.ts
│   ├── Per-agent spending velocity tracking
│   ├── Configurable thresholds ($ per hour, $ per day)
│   └── Pause-and-alert on breach
└── Unit tests for all governance modules

Day 7-8: Settlement Pipeline
├── settlement/simulate.ts
│   ├── @solana/kit simulateTransaction before submit
│   ├── Verify recipient address matches payment requirements
│   ├── Verify amount matches payment requirements
│   ├── Verify token mint matches payment requirements
│   └── This is the Bug 7 fix at the architectural level
├── settlement/submit.ts
│   ├── Co-sign transaction (add fee payer signature)
│   ├── Submit to Solana RPC (Helius)
│   ├── Confirm with configurable commitment level
│   └── Return transaction hash
├── settlement/gas-manager.ts
│   ├── SOL balance monitoring for fee payer
│   ├── Low-balance alerting threshold
│   └── Auto-top-up interface (stubbed, manual for now)
├── audit/logger.ts
│   ├── Structured JSON logging per transaction
│   ├── Fields: agent_id, owner_id, payer, recipient, amount, token,
│   │   delegation_status, ofac_result, budget_remaining, tx_signature, timestamp
│   └── Supabase insert for persistent audit trail
└── Integration tests: full verify → settle cycle on devnet

Day 9-10: Integration + Documentation
├── Wire facilitator into MCP server
│   ├── Update x402-solana-mcp to accept FACILITATOR_URL env var
│   ├── Test MCP → facilitator → devnet end-to-end
│   └── Confirm Bug 7 resolved: failed verification = no settlement
├── Update Stage 3 test suite to use @ozskr/x402-facilitator
├── README.md for facilitator package
├── ARCHITECTURE.md documenting governance pipeline
├── Docker configuration for self-hosting
└── npm publish preparation (package.json, .npmrc)
```

### Agent Team Assignments (v3.3 — Realigned)

The v3.2 amendment stated "Not involved: frontend-dev, api-architect." This changes. The facilitator is a Hono HTTP service — `api-architect` owns the service scaffolding. `solana-dev` owns the settlement pipeline and governance delegation checks. `security-auditor` scope expands to OFAC screening review and payment flow security.

**Track A (Bug Fix + Publish + Announce):**

| Task | Agent | Rationale |
|------|-------|-----------|
| Bug 1-4 fixes (agent-wallet-sdk, x402-client) | `solana-dev` | SPL delegation, transaction handling |
| Bug 7 fix (simulate-before-submit in x402-client) | `solana-dev` | Transaction simulation is core Solana |
| Stage 2-3 regression testing | `test-writer` | Test infrastructure owner |
| npm publish + directory submissions | `ai-agent-dev` | Package management, documentation |
| X/Twitter thread + announcement | Matt | Strategic narrative, public voice |

**Track B (Facilitator Build):**

| Task | Agent | Rationale |
|------|-------|-----------|
| Hono app scaffolding, routes, Zod schemas | `api-architect` | Hono service layer is core domain |
| @x402/svm verification wiring | `solana-dev` + `api-architect` | Cross-domain: crypto verification + HTTP service |
| Governance: delegation-check, budget-enforce | `solana-dev` | SPL delegation is Solana domain |
| Governance: ofac-screening | `security-auditor` + `api-architect` | Security domain + HTTP integration |
| Governance: circuit-breaker | `api-architect` | Rate limiting / anomaly detection is API domain |
| Settlement: simulate, submit, gas-manager | `solana-dev` | Transaction simulation, signing, RPC |
| Audit: logger, alerts | `api-architect` | Supabase integration, structured logging |
| Testing (unit + integration + e2e devnet) | `test-writer` | Comprehensive coverage |
| Security review (full facilitator audit) | `security-auditor` | Payment flow security, OFAC compliance |
| Code review (all PRs) | `code-reviewer` | Quality gate |
| Documentation (README, ARCHITECTURE) | `ai-agent-dev` | README-first development |

**Key change from v3.2:** `api-architect` is promoted from "Not involved" to co-lead on the facilitator. The facilitator IS a Hono API service — it would be architecturally incoherent to build it without the agent whose entire domain is Hono services.

### Build Configuration

```yaml
# packages/x402-facilitator/package.json
{
  "name": "@ozskr/x402-facilitator",
  "version": "0.1.0-beta",
  "description": "Governance-aware x402 payment facilitator for Solana — OFAC screening, delegation validation, budget enforcement, simulate-before-submit",
  "license": "MIT",
  "bin": {
    "x402-facilitator": "./dist/cli.js"
  },
  "keywords": [
    "x402", "solana", "facilitator", "payments", "governance",
    "ofac", "delegation", "mcp", "ai-agent"
  ],
  "engines": { "node": ">=20" },
  "dependencies": {
    "@solana/kit": "^2.1.0",
    "@x402/svm": "^0.3.0",
    "@x402/core": "^0.3.0",
    "hono": "^4.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "typescript": "^5.7.0"
  }
}
```

```yaml
# Updated pnpm-workspace.yaml
packages:
  - 'packages/*'
  # Now includes: agent-wallet-sdk, x402-solana-mcp, x402-facilitator
```

---

## Part 19: Updated Phase Map (v3.3)

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
      - Attorney questions (9+3) added to pending review      ← UPDATED: was 9+2
      - Phase 8/9 in CLAUDE.md

  >>> 7.M: MCP + Facilitator Build (parallel tracks):        ← UPDATED
      Track A — Bug Fix + Republish + Announce (5 days):
      - Bugs 1-4, 7 fixes across agent-wallet-sdk + x402-solana-mcp
      - Stage 2-3 regression testing
      - npm publish 0.2.0-beta
      - MCP directory submissions + ecosystem announcements
      - X/Twitter thread + Solana forum + Anthropic showcase
      
      Track B — @ozskr/x402-facilitator (10 days, parallel): ← NEW
      - Hono service scaffolding (3 x402 endpoints)
      - @x402/svm reference verification wiring
      - Governance layer: OFAC, delegation, budget, circuit breaker
      - Settlement pipeline: simulate-before-submit, co-sign, confirm
      - Audit trail: structured logging, Supabase persistence
      - Integration with MCP server (FACILITATOR_URL env var)
      - Documentation + npm publication preparation
      - Attorney review (3 scoped questions)

FUTURE (Activation-Gated):
- [ ] Phase 8: Agentic Commerce Layer (6-9 weeks)           ← REDUCED from 7-11
  Requires: 100+ users, attorney sign-off, x402 recovery, Ayrshare migration
  - [ ] 8.1: Attorney sign-off on platform delegation model
  - [ ] 8.2: Platform integration of agent-wallet-sdk (already built in 7.M)
  - [ ] 8.3: x402 server middleware (@x402/hono on platform API endpoints)
  - [ ] 8.4: Agent wallet delegation UX (approve, revoke, dashboard)
  - [ ] 8.5: Platform outbound x402 client (agents pay for fal.ai, data APIs)
  - [ ] 8.6: REDUCED — Jupiter auto-swap for $HOPE → USDC at payment time
          (facilitator already built in 7.M, $HOPE already supported)
  - [ ] 8.7: REMOVED — absorbed into 7.M (v3.2)
  - [ ] 8.8: ZK compliance attestation MVP (@ozskr/zk-agent-attestation)
  - [ ] 8.9: OFAC screening upgrade — Chainalysis API (static blocklist in 7.M)
  - [ ] 8.10: Security audit of platform agent wallet + key management
  - [ ] 8.11: Open-source zk-agent-attestation publication
  - [ ] 8.12: Facilitator public deployment (internal → public)        ← NEW

- [ ] Phase 9: Agent Marketplace (10-15 weeks + audit)
  Requires: Phase 8 stable 3+ months, 500+ agents, ecosystem maturation
  - [ ] 9.1-9.9: Unchanged from v3.1

DEFERRED (Unchanged):
- [ ] Auto-Stake Smart Contract
- [ ] Instagram/TikTok/LinkedIn direct API migration
```

### Phase 8 Impact Analysis (Updated)

Moving both the MCP server AND facilitator to 7.M further reduces Phase 8:
- Phase 8.2 = "integrate already-built SDK" (from v3.2)
- Phase 8.6 = "add Jupiter auto-swap" only (facilitator already running)
- Phase 8.7 = eliminated (from v3.2)
- Phase 8.9 = "upgrade OFAC from static list to Chainalysis API" (facilitator already screening)
- Phase 8.12 = new: flip facilitator from internal to public (attorney-gated)

Net effect: Phase 8 estimated timeline reduces from 7-11 weeks (v3.2) to **6-9 weeks**.

When Phase 8 activation gates are met, the platform has three production-tested open-source packages, a running facilitator with governance hooks, and real-world usage data. Integration becomes wiring, not building.

---

## Part 20: Updated Risk Register (v3.3 Additions)

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Facilitator build delays Track A announcement | Medium | Low | Separate parallel tracks with independent deliverables. Track A ships regardless of Track B progress. |
| Attorney flags facilitator operation as money transmission | High — blocks public deployment | Low-Medium | Phase deployment: internal-only until confirmed. Building the code carries zero regulatory risk. Only public operation is gated. |
| @x402/svm reference implementation has undocumented assumptions | Medium — debugging time | Medium | Wrap @x402/svm behind clean internal interface. Bugs in reference implementation become backlog items for Option 5 replacement. |
| Fee payer SOL balance depleted on devnet/mainnet | Low — settlement halts | Medium | Gas manager monitors balance, alerts at threshold. Devnet: airdrop automation. Mainnet: manual top-up with monitoring. |
| OFAC SDN list stale (static JSON file) | Low — compliance gap | Low | Weekly automated refresh from OFAC API. Upgrade to Chainalysis in Phase 8.9. Static list covers 99%+ of screening needs. |
| Governance layer adds unacceptable latency to settlement | Medium — UX degradation | Low | Delegation check + OFAC screening are async-parallelizable. Budget check is in-memory. Target: <50ms governance overhead on top of ~400ms settlement. |

---

## Part 21: Mainnet Deployment Sequence (Hard Blockers Resolved)

Stage 3 testing identified 4 hard blockers for mainnet. The facilitator build resolves 2 directly and enables the remaining 2:

| Blocker | Resolution | Status |
|---------|-----------|--------|
| Attorney sign-off (3 questions) | Consultation in progress. 1-hour call scoped. | In Progress |
| Bug 7 (payment settles before verification) | Facilitator's simulate-before-submit pipeline. Architectural fix, not patch. | **Resolved by Track B** |
| Facilitator for mainnet tokens | @ozskr/x402-facilitator with USDC + $HOPE support. | **Resolved by Track B** |
| OFAC screening integration | Facilitator's governance/ofac-screening.ts with static SDN list. | **Resolved by Track B** |

After attorney confirmation and facilitator build completion, the only remaining mainnet gate is funding the fee payer wallet with SOL for gas sponsorship.

---

## Part 22: Immediate Actions (v3.3 Update)

### Matt (This Week)

*All previous items from v3.2 unchanged, plus:*

15. **Approve Phase 7.M facilitator track (Track B) start** ← THIS DOCUMENT
16. Schedule attorney call with 3 scoped questions (updated from 2)
17. Brief agent hive on facilitator build activation (update CLAUDE.md + agent profiles)
18. Allocate fee payer devnet wallet for facilitator testing (separate from Stage 3 agent keypair)

### Claude Code (Track A — Bug Fix + Publish + Announce)

1. Fix Bugs 1-4, 7 in agent-wallet-sdk and x402-solana-mcp
2. Re-run Stage 1-3 regression tests
3. npm publish 0.2.0-beta
4. Record demo screen recording
5. Submit to MCP directories and x402 ecosystem
6. Draft and post X/Twitter announcement thread

### Claude Code (Track B — Facilitator Build)

1. Initialize packages/x402-facilitator with TypeScript config
2. Scaffold Hono app with /verify, /settle, /supported routes
3. Wire @x402/svm reference verification behind clean interface
4. Implement governance layer (OFAC, delegation, budget, circuit breaker)
5. Implement settlement pipeline (simulate, co-sign, submit, confirm)
6. Implement audit logging (structured JSON, Supabase persistence)
7. Write comprehensive test suite (unit + devnet integration)
8. Integrate with MCP server (FACILITATOR_URL configuration)
9. Security review of full payment flow
10. Documentation (README, ARCHITECTURE.md)
11. npm publication preparation

### Claude Code (Phase 7 — Unchanged)

*Items 1-14 from v3.1 continue in parallel on main branch*

---

## Part 23: The Three-Package Ecosystem

With v3.3, ozskr.ai ships a coherent open-source ecosystem for autonomous AI agent payments on Solana:

```
┌─────────────────────────────────────────────────────────────┐
│                    @ozskr ecosystem                         │
│                                                             │
│  ┌──────────────────────┐   ┌────────────────────────────┐ │
│  │ @ozskr/agent-wallet  │   │ @ozskr/x402-solana-mcp     │ │
│  │       -sdk           │   │                            │ │
│  │                      │   │ MCP server exposing 8      │ │
│  │ SPL delegation,      │◄──│ tools for any AI agent to  │ │
│  │ budget enforcement,  │   │ make x402 payments using   │ │
│  │ encrypted keypair    │   │ SPL delegation             │ │
│  │ management           │   │                            │ │
│  └──────────┬───────────┘   └──────────┬─────────────────┘ │
│             │                          │                    │
│             │    ┌─────────────────────▼──────────────┐     │
│             │    │ @ozskr/x402-facilitator            │     │
│             │    │                                    │     │
│             └───►│ Governance-aware payment           │     │
│                  │ settlement:                        │     │
│                  │ • OFAC screening                   │     │
│                  │ • Delegation validation             │     │
│                  │ • Budget enforcement               │     │
│                  │ • Simulate-before-submit           │     │
│                  │ • Circuit breaker                  │     │
│                  │ • Audit trail                      │     │
│                  │                                    │     │
│                  └──────────────┬─────────────────────┘     │
│                                │                            │
└────────────────────────────────┼────────────────────────────┘
                                 │
                                 ▼
                          Solana Blockchain
                     (devnet → mainnet-beta)
```

Each package is independently useful. The SDK works without the MCP server (for programmatic integrations). The MCP server works with any facilitator (Coinbase, PayAI, or ours). The facilitator works with any x402 client (not just our MCP server). Together, they form the most complete autonomous agent payment stack on Solana.

**The narrative evolves:** "A solo founder's AI agent hive didn't just build an MCP server for payments. They built the payment facilitator, the wallet SDK, AND the MCP server — the complete infrastructure stack for AI agents to transact on Solana. And every commit was made by an AI agent, orchestrated by AI, building tools for AI."

---

*"The agents didn't just build payment rails — they built the governance checkpoint, the settlement engine, and the compliance layer. The entire stack. Autonomously."*

**ozskr.ai — Your agents speak. Your agents transact. Your agents govern. You remain unseen.**
