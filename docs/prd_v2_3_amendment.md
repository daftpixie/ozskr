# ozskr.ai PRD v2.3 — MCP-First Amendment

**Purpose:** This document specifies the exact additions and modifications to PRD v2.2 to promote `@ozskr/x402-solana-mcp` from a Phase 8 deferred item to an immediate build priority. Deep research conducted February 13, 2026 confirmed that **no existing MCP server combines x402 payments on Solana with SPL token delegation** — a clear first-mover opportunity across 13+ existing x402 MCP implementations and 10,000+ indexed MCP servers.

**Date:** February 13, 2026
**Status:** Approved — Build Authorized
**Supersedes:** PRD v2.2 Amendment (same date) — specifically overrides Phase 8 gating of MCP server
**Trigger:** Deep research findings confirming zero implementations at the intersection of x402 + MCP + Solana + SPL delegation

---

## Amendment 9: Update Document Header

**Location:** Lines 6-9 (Version table)

**Replace:**
```
| Version | 2.2 |
| Date | February 13, 2026 |
| Status | Production-Ready - Agentic Commerce Pathway Added |
| Previous Version | 2.1 (February 5, 2026) |
```

**With:**
```
| Version | 2.3 |
| Date | February 13, 2026 |
| Status | Production-Ready — MCP-First Strategy Activated |
| Previous Version | 2.2 (February 13, 2026) |
```

---

## Amendment 10: Add Design Principle — FIRST

**Location:** Section 1.1 Design Principles table, after SOVEREIGN

**Add row:**

```
| **FIRST** | When a genuine ecosystem gap exists and the window is closing, ship the primitive before the product — infrastructure outlives applications |
```

**Rationale:** This principle governs the decision to build `@ozskr/x402-solana-mcp` as a standalone open-source tool before integrating it into the ozskr.ai platform. The research showed a narrow timing window (Coinbase's Payments MCP is adding Solana wallet support imminently, Stripe is expanding multi-chain). First-mover advantage in infrastructure compounds differently than in applications — it creates adoption gravity, ecosystem dependency, and brand association that persists even if competitors eventually ship similar tools.

---

## Amendment 11: Add Section 16 — MCP-First Strategy

**Location:** After Section 15 (Agentic Commerce Readiness), before Appendices

**New content:**

```markdown
---

## 16. MCP-First Strategy: `@ozskr/x402-solana-mcp`

> **NEW in v2.3** — Promoted from Phase 8 deferred to immediate build priority based on deep research confirming zero existing implementations at this intersection. This is the single highest-leverage open-source artifact ozskr.ai can ship.

### 16.1 Strategic Rationale

Deep research conducted February 13, 2026 audited every x402 MCP server in existence:

**Existing x402 MCP servers (13+ implementations):**
- Coinbase official (EVM + Solana via @x402/svm, agent-holds-keypair model)
- MCPay (Base, Avalanche, IoTeX, Sei, Solana — agent-holds-keypair model)
- Vercel x402-mcp (Base only, npm published)
- @civic/x402-mcp (EVM only — Base, Ethereum, Optimism, Arbitrum, Polygon)
- MetaMask mcp-x402 (minimal EVM signing)
- mcp-go-x402 (Go, archived, EVM + Solana)
- P-Link MCP (Solana-native, hosted endpoint)
- tip-md-x402 (hackathon, Base + Solana tipping)
- rome-x402-mcp (bridges USDC to Algorand)
- kushalsrinivas/x402-mcp (Avalanche)
- FlowMCP middleware (Express-based)
- Thorium x402-mcp-extension (decorator pattern)
- Latinum wallet MCP (wallet/client side)

**Finding: Every Solana-supporting implementation uses the "agent holds its own funded keypair" model. Zero implementations use SPL token delegation (approveChecked/transferChecked/revokeChecked) for non-custodial, user-controlled agent spending authority.**

This gap exists because:
1. SPL delegation is a Solana-specific primitive — EVM-first teams don't think in these terms
2. MCP server developers typically aren't Solana developers
3. x402 SDK developers haven't focused on MCP server packaging
4. The non-custodial delegation pattern requires understanding both agent architecture AND Solana token mechanics

ozskr.ai's agent hive — a team of AI agents orchestrated via MCP building a platform for AI agents — is uniquely positioned to build this tool because the team IS the first customer.

### 16.2 What We're Building

`@ozskr/x402-solana-mcp` is an MCP server that gives any MCP-compatible AI agent (Claude Code, Cursor, Windsurf, OpenAI Codex, local LLMs) the ability to make x402 payments on Solana using SPL token delegation. The user approves a bounded spending cap; the agent spends autonomously within that cap; every transaction is on-chain, auditable, and user-revocable.

**Installation (target UX):**
```bash
# Claude Code
claude mcp add x402-solana https://registry.npmjs.org/@ozskr/x402-solana-mcp

# Or via .mcp.json in project root
{
  "mcpServers": {
    "x402-solana": {
      "command": "npx",
      "args": ["@ozskr/x402-solana-mcp"],
      "env": {
        "SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com",
        "AGENT_KEYPAIR_PATH": "~/.config/ozskr/agent-keypair.json"
      }
    }
  }
}
```

**MCP Tools Exposed:**

| Tool | Description | Requires Delegation |
|------|-------------|-------------------|
| `x402_setup_agent` | Generate agent keypair, display public key for delegation | No |
| `x402_check_delegation` | Check current delegated balance and spending cap | No |
| `x402_pay` | Make x402 payment as delegate (the core primitive) | Yes |
| `x402_check_balance` | Check agent's token balances (delegated + owned) | No |
| `x402_revoke_delegation` | Revoke agent's spending authority (owner-only) | Owner signs |
| `x402_transaction_history` | Query on-chain transaction history for the agent | No |
| `x402_discover_services` | Find x402-enabled endpoints (via registry or URL probing) | No |
| `x402_estimate_cost` | Estimate cost of an x402 request before paying | No |

**The Core Flow (x402_pay):**
1. Agent calls `x402_pay` with target URL
2. MCP tool handler makes HTTP request to URL
3. Server responds 402 with `X-PAYMENT-*` headers (amount, recipient, network, token)
4. Tool handler constructs SPL `TransferChecked` instruction as delegate
5. Agent keypair signs the transaction (no user interaction needed)
6. Transaction submitted to Solana, confirmed in 1-2 seconds
7. Payment proof (signature) sent in `X-PAYMENT-SIGNATURE` header on retry
8. Original response returned to the agent
9. Transaction logged to local history

**Total latency: 2-3 seconds.** Drops to <1 second after Solana's Alpenglow upgrade.

### 16.3 Dependency: `@ozskr/agent-wallet-sdk`

The MCP server depends on a lower-level SDK that handles the SPL delegation mechanics. This ships as a separate package for framework-agnostic use:

```typescript
// @ozskr/agent-wallet-sdk — core delegation primitives

interface DelegationConfig {
  ownerTokenAccount: Address;       // User's USDC/SPL token account
  delegateKeypair: CryptoKeyPair;   // Agent's keypair
  tokenMint: Address;               // USDC, $HOPE, etc.
  maxAmount: bigint;                // Spending cap in base units
  decimals: number;                 // Token decimals (6 for USDC)
}

interface DelegationStatus {
  isActive: boolean;
  delegate: Address;
  remainingAmount: bigint;
  originalAmount: bigint;
  tokenMint: Address;
  ownerTokenAccount: Address;
}

// Core functions
function createDelegation(config: DelegationConfig): Promise<TransactionSignature>;
function checkDelegation(tokenAccount: Address): Promise<DelegationStatus>;
function transferAsDelegate(params: {
  delegateKeypair: CryptoKeyPair;
  sourceTokenAccount: Address;
  destinationTokenAccount: Address;
  amount: bigint;
  decimals: number;
  tokenMint: Address;
}): Promise<TransactionSignature>;
function revokeDelegation(ownerKeypair: CryptoKeyPair, tokenAccount: Address): Promise<TransactionSignature>;
```

**This SDK is the building block.** The MCP server wraps it. ozskr.ai's platform wraps it differently. Other projects wrap it their own way. Clean separation.

### 16.4 What This Is NOT

To be precise about scope:

- **NOT a wallet.** The agent has a keypair, not a wallet. It can only spend tokens delegated to it by the user. It cannot receive, swap, stake, or do anything else.
- **NOT custodial.** The platform never holds keys, never intermediates funds, never has the ability to execute transactions. The user delegates directly to the agent keypair via an on-chain SPL instruction.
- **NOT a mixer or anonymizer.** Every transaction is a standard SPL token transfer, fully visible on Solana Explorer. The sender address, recipient address, amount, and timestamp are all public.
- **NOT a money transmitter (pending attorney confirmation).** The tool is a client-side payment handler analogous to a browser extension. It runs on the user's machine, signs with a locally-stored keypair, and makes direct peer-to-peer payments. The platform's role is publishing open-source code, not operating a financial service.

### 16.5 Competitive Window

The research identified specific closing vectors:

| Competitor | Current State | Risk Timeline |
|-----------|---------------|--------------|
| Coinbase Payments MCP | Solana wallet support "on roadmap Q4/Q1" | 1-3 months |
| MCPay | Supports Solana but no delegation model | Could add delegation anytime |
| SendAI Solana Agent Kit | 140K+ npm downloads, 60+ Solana ops, no x402 | Could wrap x402 in weeks |
| Stripe x402 | Launched Feb 10, 2026 on Base, multi-chain planned | 3-6 months for Solana |
| PayAI Network | Leading Solana x402 facilitator, no MCP server | Could ship MCP quickly |

**First-mover advantage in infrastructure is different from applications.** Once developers configure `@ozskr/x402-solana-mcp` in their `.mcp.json`, write code that calls `x402_pay`, and build workflows around it — switching costs are real. The tool becomes the reference implementation. Blog posts link to it. Tutorials reference it. Conference talks demo it.

**Target: publish to npm within 3 weeks of build start.**

### 16.6 Legal Guardrails

Building the code carries zero legal risk — it's TypeScript that calls standard Solana SPL instructions via an open-source protocol.

**Before publishing to npm, attorney must confirm:**

1. SPL token delegation preserves non-custodial status under FinCEN's four-factor test (the key question)
2. Publishing open-source payment tooling on Solana falls outside Tornado Cash fact pattern (transparent stablecoin transfers vs. anonymizing mixer)

**Risk assessment (from deep research):**
- Tornado Cash conviction (August 2025) was for operating an unlicensed money transmitting business — a mixer that anonymized $7B+ including $600M from North Korean hackers
- This MCP server produces transparent, on-chain USDC transfers with user-controlled spending caps
- DOJ April 2025 policy: "will not pursue litigation that superimposes regulatory frameworks on digital assets"
- CLARITY Act passed House July 2025, explicitly protects non-custodial developers from money transmitter classification
- Senate companion (DCIA) advanced January 29, 2026 — "does not seek to turn software developers into regulated financial intermediaries simply because they write or maintain code"
- Blockchain Regulatory Certainty Act (Lummis-Wyden, January 12, 2026) defines developers without "unilateral control over assets" as non-money transmitters

**Risk level: Low and declining monthly as legislation advances. Attorney review is a 1-hour confirmation, not a multi-week investigation.**

### 16.7 Success Metrics

| Metric | 30 days | 90 days | 6 months |
|--------|---------|---------|----------|
| npm weekly downloads | 50+ | 500+ | 2,000+ |
| GitHub stars | 100+ | 500+ | 1,500+ |
| Active MCP connections (if telemetry opted-in) | 20+ | 200+ | 1,000+ |
| External blog posts / tutorials referencing | 2+ | 10+ | 25+ |
| Grant applications strengthened | Solana Foundation | + Anthropic | + Coinbase x402 Foundation |
| ozskr.ai internal integration | Dev testing | Alpha users | All agents |

### 16.8 Technology Dependencies (Install NOW, Not Phase 8)

These packages are required for the MCP server build and should be added to the `packages/` workspace immediately:

| Package | Purpose | Status Change |
|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | MCP TypeScript SDK | Phase 8 → NOW |
| `@solana/kit` | Already in project | No change |
| `@x402/core` | x402 protocol types | Phase 8 → NOW |
| `@x402/svm` | Solana x402 verification | Phase 8 → NOW |

**Packages that remain Phase 8:**

| Package | Purpose | Why Deferred |
|---------|---------|-------------|
| `@x402/hono` | Server-side payment gating on ozskr.ai API | Platform integration, not MCP server |
| Polygon ID / Civic SDK | ZK compliance attestations | Phase 8 ZK work |

```

---

## Amendment 12: Update Section 15.5 — Scope Clarification

**Location:** Section 15.5 x402 Integration Architecture header

**Replace:**
```markdown
### 15.5 x402 Integration Architecture (Phase 8+ — Not Implemented in v1)
```

**With:**
```markdown
### 15.5 x402 Integration Architecture

> **Updated in v2.3:** The MCP server (Point 2 below) is promoted to immediate build as a standalone open-source package. Points 1 and 3 remain Phase 8+ gated.
```

---

## Amendment 13: Update Section 15.7 — Technology Dependencies Table

**Location:** Section 15.7 Technology Dependencies table

**Replace the row:**
```
| `@civic/x402-mcp` | MCP tool payment integration | 8 |
```

**With:**
```
| `@modelcontextprotocol/sdk` | MCP server TypeScript SDK | **NOW** (standalone package) |
| `@x402/core` | Protocol types and schemas | **NOW** (standalone package) |
| `@x402/svm` | Solana blockchain support | **NOW** (standalone package) |
```

---

## Amendment 14: Update Appendix D.4 — Open-Source Strategy Priority

**Location:** Appendix D.4, `@ozskr/x402-solana-mcp` description

**Replace:**
```markdown
**`@ozskr/x402-solana-mcp`** — MCP server enabling any AI agent (Claude, GPT, local models) to make x402-authenticated payments on Solana. Exposes tools: `x402_pay`, `x402_check_balance`, `x402_revoke_delegation`, `x402_transaction_history`.
```

**With:**
```markdown
**`@ozskr/x402-solana-mcp`** ⚡ **PRIORITY BUILD — First-to-market** — MCP server enabling any AI agent (Claude Code, Cursor, Windsurf, OpenAI Codex, local LLMs) to make x402 payments on Solana using SPL token delegation. The first MCP server anywhere to implement non-custodial, bounded, user-revocable agent spending authority on any blockchain. Exposes 8 tools: `x402_setup_agent`, `x402_check_delegation`, `x402_pay`, `x402_check_balance`, `x402_revoke_delegation`, `x402_transaction_history`, `x402_discover_services`, `x402_estimate_cost`. Target: npm publication within 3 weeks of build start.

**`@ozskr/agent-wallet-sdk`** ⚡ **PRIORITY BUILD — MCP server dependency** — TypeScript SDK for non-custodial agent wallets on Solana with SPL delegate pattern, budget enforcement, and x402 payment flow. Framework-agnostic. Required foundation for the MCP server. Ships simultaneously.
```

---

## Amendment 15: Update Version 2.3 Change Summary

**Location:** After Version 2.2 Change Summary

**Add:**

```markdown
### Version 2.3 Change Summary

**MCP-First Strategy (Section 16) — MAJOR STRATEGIC CHANGE**

- `@ozskr/x402-solana-mcp` promoted from Phase 8 deferred to immediate build priority
- `@ozskr/agent-wallet-sdk` promoted from Phase 8 deferred to immediate build (MCP server dependency)
- Deep research confirmed zero existing implementations combining x402 + MCP + Solana + SPL delegation
- 13+ existing x402 MCP servers audited — all use agent-holds-keypair model, none implement delegation
- Competitive window analysis: 1-3 months before Coinbase closes the gap
- Full tool specification (8 MCP tools), dependency architecture, legal guardrails, and success metrics defined
- Attorney review scoped to 2 specific questions (1-hour engagement, not multi-week)
- Target: npm publication within 3 weeks of build start

**New Design Principle: FIRST**

- When a genuine ecosystem gap exists and the window is closing, ship the primitive before the product
- Infrastructure outlives applications

**Technology Dependency Changes**

- `@modelcontextprotocol/sdk`, `@x402/core`, `@x402/svm` moved from Phase 8 → NOW
- `@x402/hono`, ZK SDKs remain Phase 8 gated

**Key principle:** The MCP server is a standalone open-source package that provides value to the entire Solana AI agent ecosystem. It is NOT coupled to the ozskr.ai platform. ozskr.ai is the first consumer, not the only consumer. This is infrastructure, not feature work.
```

---

## Amendment 16: Update Document History

**Location:** Document History table

**Add row:**

```
| 2.3 | Feb 13, 2026 | Claude (Deep Research) + Matt (Strategic Decision) | MCP-First strategy: x402-solana-mcp promoted to immediate build. First-to-market open-source play. |
```
