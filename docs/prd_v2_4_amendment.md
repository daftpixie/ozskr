# ozskr.ai PRD v2.4 — Facilitator-First Amendment

**Purpose:** This document specifies the additions and modifications to PRD v2.3 to add `@ozskr/x402-facilitator` as a first-party governance-aware payment facilitator, optimized to the ozskr.ai stack. Stage 3 MCP integration testing (13/13 passed, 7 bugs found) confirmed that no production facilitator supports devnet test tokens, custom SPL tokens ($HOPE), or governance hooks (delegation checking, budget enforcement, OFAC screening). Building a facilitator is not optional infrastructure — it is the governance checkpoint through which every autonomous agent financial transaction flows.

**Date:** February 15, 2026
**Status:** Approved — Build Authorized (Parallel Priority with npm Publication)
**Supersedes:** PRD v2.3 Amendment — extends Section 16, adds facilitator package
**Trigger:** Stage 3 testing exposing Bug 6 (no local facilitator support), Bug 7 (failed payment still settles on-chain), facilitator architecture deep analysis confirming Option 3 (Coinbase reference + custom TypeScript) as optimal path with Option 5 (ground-up) plumbing built in from day one

---

## Amendment 17: Update Document Header

**Location:** Lines 6-9 (Version table)

**Replace:**
```
| Version | 2.3 |
| Date | February 13, 2026 |
| Status | Production-Ready — MCP-First Strategy Activated |
| Previous Version | 2.2 (February 13, 2026) |
```

**With:**
```
| Version | 2.4 |
| Date | February 15, 2026 |
| Status | Production-Ready — Facilitator-First Infrastructure Activated |
| Previous Version | 2.3 (February 13, 2026) |
```

---

## Amendment 18: Add Design Principle — GOVERN

**Location:** Section 1.1 Design Principles table, after FIRST

**Add row:**

```
| **GOVERN** | Autonomous agents require governance at every enforcement boundary — local SDK, settlement facilitator, and on-chain state must independently validate spending authority before funds move |
```

**Rationale:** Stage 3 testing exposed Bug 7: a payment can settle on-chain even when post-settlement verification fails, resulting in fund loss with no content delivery. This principle mandates that governance enforcement exists at three independent layers — the agent-wallet-sdk (local budget tracking), the facilitator (simulate-before-submit, delegation checking, OFAC screening), and the chain (SPL delegation mechanics). No single layer's failure can result in unauthorized fund movement.

---

## Amendment 19: Update Section 16.2 — Expand Package Architecture

**Location:** Section 16.2, after the MCP Tools table

**Add new subsection:**

```markdown
### 16.2.1 `@ozskr/x402-facilitator` — Governance-Aware Payment Settlement

> **NEW in v2.4** — First-party facilitator service optimized to the ozskr.ai stack. Built on Hono (same framework as the platform API layer), using @x402/svm for reference verification logic and @solana/kit for transaction settlement. Designed as a governance checkpoint, not a generic relay.

**What a facilitator does (x402 spec, 3 endpoints):**

| Endpoint | Function |
|----------|----------|
| `POST /verify` | Validate payment payload: signature correct, amount matches requirements, not replayed, not expired |
| `POST /settle` | Co-sign transaction (add fee payer signature), simulate, submit to Solana, confirm settlement, return tx hash |
| `GET /supported` | Return supported networks, tokens, payment schemes, and fee payer address |

**What THIS facilitator adds (governance layer):**

| Governance Hook | Description | Enforcement Point |
|----------------|-------------|-------------------|
| **OFAC Screening** | Check payer and recipient addresses against OFAC SDN blocklist before settlement | Pre-verify |
| **Delegation Validation** | Confirm payer has active SPL delegation with sufficient remaining budget | Pre-verify |
| **Budget Enforcement** | Independently validate payment amount against delegation cap (belt-and-suspenders with SDK) | Pre-verify |
| **Simulate-Before-Submit** | Full transaction simulation verifying recipient, amount, and token mint match before on-chain submission | Pre-settle (Bug 7 fix) |
| **Circuit Breaker** | Rate-based anomaly detection — pause settlement on spending velocity spikes pending owner review | Pre-settle |
| **Audit Trail** | Log every transaction with full context: agent ID, owner ID, delegation status, amount, token, timestamp, tx signature | Post-settle |

**Architecture Decision: Option 3 → Option 5 Evolution**

The facilitator uses `@x402/svm` reference verification logic (Coinbase's battle-tested signature verification, transaction deserialization, replay detection) wrapped in a governance-aware Hono service. This is Option 3: fastest path to production with proven crypto verification. The service is structured with clean internal interfaces so that `@x402/svm` internals can be progressively replaced with native `@solana/kit` implementations (Option 5) as the facilitator matures. No big-bang rewrite — progressive ownership.

**Why NOT fork Kora:**
- Kora is a Rust binary — wrong language for a TypeScript-first team
- Kora abstracts signing away, preventing governance interception before co-signing
- Gas sponsorship (Kora's primary value) is 3 lines of TypeScript with @solana/kit
- Solana Foundation association comes from building ON Solana, not running their specific binary

**Package structure:**
```
packages/x402-facilitator/
├── src/
│   ├── index.ts                 # Hono app entry point
│   ├── routes/
│   │   ├── verify.ts            # POST /verify
│   │   ├── settle.ts            # POST /settle
│   │   └── supported.ts         # GET /supported
│   ├── governance/
│   │   ├── ofac-screening.ts    # SDN blocklist check (static list → Chainalysis API later)
│   │   ├── delegation-check.ts  # On-chain delegation status validation
│   │   ├── budget-enforce.ts    # Independent budget cap enforcement
│   │   └── circuit-breaker.ts   # Anomaly detection and pause logic
│   ├── settlement/
│   │   ├── verify-payment.ts    # @x402/svm reference verification (Option 3)
│   │   ├── simulate.ts          # @solana/kit simulateTransaction pre-submit
│   │   ├── submit.ts            # Co-sign, submit, confirm
│   │   └── gas-manager.ts       # Fee payer keypair, SOL balance monitoring
│   ├── audit/
│   │   ├── logger.ts            # Structured transaction audit logging
│   │   └── alerts.ts            # Anomaly alerting (low balance, velocity spike)
│   ├── schemas/
│   │   └── x402.ts              # Zod schemas for all x402 request/response types
│   └── config.ts                # Environment configuration, supported tokens/networks
├── tests/
│   ├── verify.test.ts
│   ├── settle.test.ts
│   ├── governance.test.ts
│   └── integration.test.ts      # Devnet end-to-end with real transactions
├── package.json
├── tsconfig.json
└── README.md
```

**Deployment targets:**
- **Development:** Local process (same as Stage 3 local-facilitator.ts, but production-grade)
- **Staging:** Railway container or Cloudflare Workers (edge deployment)
- **Production Phase 1:** Internal only — serves ozskr.ai platform agent transactions
- **Production Phase 2:** Public infrastructure — other projects can point facilitatorUrl at our instance

**The facilitator is NOT coupled to the ozskr.ai platform.** It is a standalone service that any x402 client can use. ozskr.ai agents are the first consumers. The MCP server's `facilitatorUrl` environment variable points at this service.
```

---

## Amendment 20: Update Section 16.4 — Legal Guardrails (3 Attorney Questions)

**Location:** Section 16.6 Legal Guardrails

**Replace:**
```markdown
**Before publishing to npm, attorney must confirm:**

1. SPL token delegation preserves non-custodial status under FinCEN's four-factor test (the key question)
2. Publishing open-source payment tooling on Solana falls outside Tornado Cash fact pattern (transparent stablecoin transfers vs. anonymizing mixer)
```

**With:**
```markdown
**Before publishing to npm AND before deploying facilitator to production, attorney must confirm:**

1. **SPL token delegation preserves non-custodial status** under FinCEN's four-factor test. The key question: does delegating spending authority via SPL approveChecked constitute "acceptance" of funds, or is the user retaining custody with the agent acting as authorized spender?

2. **Publishing open-source payment tooling on Solana falls outside Tornado Cash fact pattern.** The distinction: transparent, auditable stablecoin transfers with user-controlled spending caps vs. anonymizing mixer processing $7B+ including sanctioned funds.

3. **Operating a facilitator that relays client-signed transactions constitutes or does not constitute money transmission** under FinCEN guidance and Florida § 560.103(24). The facilitator never takes custody — it receives a client-signed transaction, co-signs as fee payer (covering gas only), submits to Solana, and confirms settlement. Funds move peer-to-peer (buyer → seller). The facilitator cannot unilaterally execute (client must sign) and cannot indefinitely prevent (client can submit directly or use another facilitator).

**Regulatory analysis (conducted February 14, 2026):**

Question 3 is the newest and most nuanced. Key considerations:
- FinCEN defines money transmission as "acceptance" and "transmission" of value. The facilitator relays pre-signed instructions — analogous to a payment processor sending instructions between banks without being in the funds flow.
- Florida § 560.103(24) test: "ability to unilaterally execute or indefinitely prevent transaction." Facilitator submitting client-signed transactions cannot unilaterally execute (client must sign) and cannot indefinitely prevent (client can submit directly or use another facilitator).
- Coinbase operates a facilitator because it is already a licensed MSB with state-by-state BitLicenses. ozskr.ai does not have that shield.
- Blockchain Regulatory Certainty Act (Lummis-Wyden, January 12, 2026) protects entities without "unilateral control over assets" from money transmitter classification. Advanced through committee but not yet passed Senate.
- DCIA (January 29, 2026) explicitly states it "does not seek to turn software developers into regulated financial intermediaries simply because they write or maintain code."

**Risk level: Low for internal platform use, medium for public-facing facilitator service. Attorney call scoped to 1 hour — 3 questions, not multi-week investigation. Facilitator deployment phases accordingly: internal-only until attorney confirms, public after.**
```

---

## Amendment 21: Update Section 16.5 — Technology Dependencies

**Location:** Section 16.8 Technology Dependencies table

**Add to "Install NOW" table:**

```
| Package | Purpose | Status Change |
|---------|---------|--------------|
| `hono` | Facilitator HTTP service framework | Already in project (platform API) |
| `@x402/svm` | Reference verification logic for facilitator | Already added in v2.3 |
| `@solana/kit` | Transaction simulation, submission, confirmation | Already in project |
```

**Add new package to workspace:**

```yaml
# packages/x402-facilitator/package.json
{
  "name": "@ozskr/x402-facilitator",
  "version": "0.1.0-beta",
  "description": "Governance-aware x402 payment facilitator for Solana with OFAC screening, delegation validation, and budget enforcement",
  "license": "MIT",
  "keywords": ["x402", "solana", "facilitator", "payments", "governance", "ofac", "delegation"],
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

---

## Amendment 22: Update Section 16.7 — Success Metrics (Expanded)

**Location:** Section 16.7 Success Metrics table

**Add facilitator-specific rows:**

```
| Metric | 30 days | 90 days | 6 months |
|--------|---------|---------|----------|
| Facilitator uptime (internal) | 95%+ | 99%+ | 99.9%+ |
| Transactions settled (devnet) | 100+ | 1,000+ | N/A (mainnet by then) |
| Transactions settled (mainnet) | — | 100+ | 5,000+ |
| Average settlement latency | <15s | <10s | <5s (Alpenglow) |
| OFAC screening false positive rate | Measure baseline | <0.1% | <0.01% |
| Bug 7-class incidents (payment settles, verification fails) | 0 | 0 | 0 |
| External projects using facilitator | 0 (internal only) | 1-3 | 10+ |
```

---

## Amendment 23: Supersede Phase 8.6 Definition

**Location:** Phase 8 structure reference in Section 16

**Replace:**
```
8.6: $HOPE x402 facilitator (PayAI or custom + Jupiter auto-swap)
```

**With:**
```
8.6: ABSORBED INTO 7.M — @ozskr/x402-facilitator ships as standalone package with $HOPE support from day one. Phase 8.6 scope reduced to: Jupiter auto-swap integration for $HOPE → USDC conversion at payment time (requires facilitator already running).
```

---

## Amendment 24: Update Appendix D.4 — Open-Source Strategy (Add Facilitator)

**Location:** Appendix D.4, after `@ozskr/agent-wallet-sdk` description

**Add:**

```markdown
**`@ozskr/x402-facilitator`** ⚡ **PRIORITY BUILD — Governance Infrastructure** — Standalone x402 payment facilitator for Solana built on Hono, using @x402/svm reference verification with @solana/kit settlement. First facilitator anywhere to implement governance hooks: OFAC screening, SPL delegation validation, budget enforcement, simulate-before-submit (preventing Bug 7-class fund loss), circuit breaker logic, and full audit trail. Designed for progressive evolution from Option 3 (reference-backed) to Option 5 (fully native). Deploys as internal platform infrastructure first, public service after attorney confirmation.
```

---

## Amendment 25: Version 2.4 Change Summary

**Location:** After Version 2.3 Change Summary

**Add:**

```markdown
### Version 2.4 Change Summary

**Facilitator-First Infrastructure (Section 16.2.1) — MAJOR INFRASTRUCTURE ADDITION**

- `@ozskr/x402-facilitator` added as third open-source package in the @ozskr ecosystem
- Stage 3 testing (13/13 passed, 7 bugs found) confirmed no production facilitator supports governance hooks, devnet tokens, or custom SPL tokens
- Architecture decision: Option 3 (Coinbase @x402/svm reference + custom Hono service) with Option 5 plumbing (progressive replacement with native @solana/kit)
- Kora fork explicitly rejected: wrong language (Rust), wrong abstraction level (hides signing from governance layer), gas sponsorship trivially reimplemented in TypeScript
- Six governance hooks defined: OFAC screening, delegation validation, budget enforcement, simulate-before-submit, circuit breaker, audit trail
- Bug 7 (payment settles before verification) architecturally resolved by simulate-before-submit in facilitator settlement pipeline
- Facilitator scoped as governance checkpoint for all autonomous agent financial transactions — three independent enforcement layers (SDK → facilitator → chain)

**New Design Principle: GOVERN**

- Autonomous agents require governance at every enforcement boundary
- No single layer's failure can result in unauthorized fund movement

**Attorney Scope Expanded (2 → 3 Questions)**

- Question 3 added: Does operating a facilitator that relays client-signed transactions constitute money transmission under FinCEN + Florida § 560.103(24)?
- Risk assessment: low for internal platform use, medium for public service
- Deployment phases accordingly: internal-first, public after confirmation

**Phase 8 Impact**

- Phase 8.6 ($HOPE facilitator) absorbed into 7.M — reduces Phase 8 scope by additional 1-2 weeks
- Phase 8 estimated timeline reduces from 7-11 weeks (v3.2) to **6-9 weeks**

**Key principle:** The facilitator is not just plumbing — it is the governance checkpoint for the agentic company. Every dollar an autonomous agent spends flows through delegation → SDK → facilitator → chain. Three independent enforcement points. The digital twin's spending authority is validated at every boundary.
```

---

## Amendment 26: Update Document History

**Location:** Document History table

**Add row:**

```
| 2.4 | Feb 15, 2026 | Claude (Extended Thinking + Deep Research) + Matt (Strategic Decision) | Facilitator-first infrastructure: @ozskr/x402-facilitator added as governance-aware settlement service. Option 3→5 architecture. 3 attorney questions. GOVERN principle. |
```
