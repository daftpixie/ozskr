# Anthropic MCP Showcase Submission

**Submission for:** Anthropic MCP Community Showcase
**Package:** @ozskr/x402-solana-mcp
**Category:** Payments / Web3

---

## What It Is

`@ozskr/x402-solana-mcp` is an MCP server that enables AI agents to autonomously pay for x402-enabled APIs using Solana blockchain tokens. It's the first implementation combining the x402 HTTP payment protocol with Solana's SPL token delegation, creating a non-custodial payment system for AI agents.

AI agents running in Claude Code, Cursor, or Windsurf can detect when an API requires payment (HTTP 402 response), execute the payment using delegated tokens, and receive the API response — all without human intervention and without holding the user's private keys.

---

## Why It Matters

### The Agent Payments Problem

AI agents need to access premium APIs, AI models, data feeds, and digital services on behalf of users. Current solutions force a choice between:

- **Custodial wallets** (agent holds keys) — security risk
- **Manual approval** (user confirms each payment) — breaks autonomy
- **API keys** (centralized, no auditability) — vendor lock-in

This MCP server solves all three constraints using blockchain delegation primitives.

### The Solution: Delegated Authority

Users grant agents bounded spending authority via Solana's SPL Token Program:

1. **User approves** agent to spend up to 100 USDC (one transaction)
2. **Agent autonomously pays** for APIs as needed (no per-tx approval)
3. **On-chain enforcement** caps spending at approved amount
4. **User can revoke** delegation anytime (instant)

Result: Agents gain autonomy without custody. Users maintain control without friction.

### First-Mover Advantage

This is the first MCP server to combine:
- **x402 protocol** (HTTP 402 payment standard)
- **Solana blockchain** (sub-second finality, <$0.001 fees)
- **SPL delegation** (non-custodial bounded authority)
- **MCP integration** (universal AI agent compatibility)

Other x402 implementations exist for Ethereum L2s, but none support Solana. Other Solana payment tools exist, but none implement x402 or MCP. This is the intersection point.

---

## Technical Details

### 8 MCP Tools

**Setup & Management:**
1. **x402_setup_agent** — Generate encrypted agent keypair (scrypt + AES-256-GCM)
2. **x402_check_delegation** — Query on-chain delegation status and remaining budget
3. **x402_check_balance** — View agent SOL + token balances
4. **x402_revoke_delegation** — Instructions for owner to cancel agent authority

**Payment Operations:**
5. **x402_pay** — Full payment flow: detect 402 → pay via facilitator → retry with proof
6. **x402_estimate_cost** — Check payment requirements without spending
7. **x402_transaction_history** — Query agent's on-chain payment history
8. **x402_discover_services** — Find x402-enabled APIs and service registries

### Security Model

**3-Layer Budget Enforcement:**

1. **Per-request cap:** `maxAmount` parameter rejects payments exceeding limit
2. **Session budget:** Local tracker combines on-chain state with spend history
3. **On-chain cap:** SPL Token Program enforces hard limit (cannot be bypassed)

**Encrypted Keypair Storage:**

- Agent keypair encrypted at rest (scrypt KDF N=2^20, AES-256-GCM)
- File permissions 0600 (owner read/write only)
- Passphrase minimum 12 characters
- Decrypted bytes zeroed after use

**Transaction Validation:**

- All transfers use `transferChecked` (validates mint + decimals)
- Simulation required before submission (fails fast)
- Facilitator fallback (CDP → PayAI) for resilience

### Architecture

```
┌─────────────────────────────────────────────────────┐
│ AI Agent (Claude, Cursor, Windsurf)                │
└─────────────────────┬───────────────────────────────┘
                      │ MCP Tools
┌─────────────────────▼───────────────────────────────┐
│ @ozskr/x402-solana-mcp (MCP Server)                 │
│ ├─ x402 detection (HTTP 402 parser)                 │
│ ├─ Facilitator client (CDP / PayAI)                 │
│ └─ Budget tracker (on-chain + local)                │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│ @ozskr/agent-wallet-sdk (Delegation primitives)     │
│ ├─ createDelegation (SPL approveChecked)            │
│ ├─ transferAsDelegate (SPL transferChecked)         │
│ ├─ checkDelegation (RPC account query)              │
│ └─ revokeDelegation (SPL revoke)                    │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│ Solana (SPL Token Program)                          │
│ ├─ On-chain delegation state                        │
│ ├─ Transaction validation                           │
│ └─ Sub-second finality                              │
└─────────────────────────────────────────────────────┘
```

---

## Installation (Claude Code)

### Step 1: Install MCP Server

```bash
claude mcp add x402-solana -- npx @ozskr/x402-solana-mcp
```

### Step 2: Configure Environment

Add to shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
export SOLANA_RPC_URL="https://api.devnet.solana.com"
export AGENT_KEYPAIR_PATH="$HOME/.x402-agent/keypair.json"
export SOLANA_NETWORK="devnet"
```

Restart shell or reload profile.

### Step 3: Generate Agent Keypair

In Claude Code:

```
Use x402_setup_agent with passphrase "your-secure-passphrase-min-12-chars"
```

Example output:

```json
{
  "status": "success",
  "agentAddress": "HkqT7w...",
  "keypairPath": "/home/user/.x402-agent/keypair.json",
  "message": "Agent keypair generated. Fund this address with SOL for fees, then delegate tokens."
}
```

### Step 4: Fund Agent & Delegate Tokens

**Option A: Via Phantom/Solflare Wallet**

Use `@ozskr/agent-wallet-sdk` in a script:

```typescript
import { createDelegation } from '@ozskr/agent-wallet-sdk';
import { address } from '@solana/kit';

const delegationTx = await createDelegation({
  ownerTokenAccount: address('YOUR_USDC_ACCOUNT'),
  ownerSigner: walletSigner,
  delegateAddress: address('HkqT7w...'),  // Agent from Step 3
  tokenMint: address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  maxAmount: 100_000_000n,  // 100 USDC
  decimals: 6,
}, { endpoint: 'https://api.devnet.solana.com' });

// Sign and submit via wallet
```

**Option B: Via CLI (devnet only)**

Send SOL to agent address:
```bash
solana transfer HkqT7w... 0.1 --url devnet
```

### Step 5: Agent Makes Payments

In Claude Code:

```
Use x402_pay with:
- url: "https://api.example.com/premium-data"
- passphrase: "your-passphrase"
- tokenAccount: "YOUR_USDC_ACCOUNT"
- maxAmount: "1000000"
```

Agent autonomously handles 402 detection → payment → retry.

---

## Example Use Cases

### 1. Premium API Access

Agent autonomously pays for weather data, stock prices, news feeds without interrupting workflow.

```
User: "What's the premium weather forecast for Tokyo next week?"
Agent: [Detects paywall] → [Pays 0.50 USDC] → [Returns forecast]
```

### 2. AI Model Access

Agent pays for fal.ai image generation, Replicate video models, Pinecone vector search.

```
User: "Generate a product mockup image"
Agent: [Calls fal.ai] → [402 detected] → [Pays 0.10 USDC] → [Returns image]
```

### 3. Content Licensing

Agent tips creators, pays for stock photos, licenses music tracks.

```
User: "Find a licensed background track for my video"
Agent: [Searches registry] → [Pays creator 2 USDC] → [Downloads track]
```

### 4. Data Purchases

Agent buys datasets, research papers, analytics reports on-demand.

```
User: "Get the latest DeFi protocol TVL data"
Agent: [Pays Dune Analytics 1 USDC] → [Fetches CSV] → [Analyzes]
```

---

## Links

- **GitHub Repository:** https://github.com/daftpixie/ozskr
- **npm Package:** https://www.npmjs.com/package/@ozskr/x402-solana-mcp
- **Companion SDK:** https://www.npmjs.com/package/@ozskr/agent-wallet-sdk
- **Documentation:** See README in repo (packages/x402-solana-mcp/)
- **License:** MIT

---

## Project Context

This MCP server was built by ozskr.ai, a platform for creating AI content agents on Solana. The development process itself is notable: a hive of AI development agents (orchestrated via Claude Code) built the tool that AI agents will use to make payments. The agents built their own payment infrastructure.

Every line of code, every test, every security review was coordinated by AI agents working in parallel. The project demonstrates not just the utility of MCP for payments, but the viability of AI-native development workflows.

**Built with Claude Code. Built by agents, for agents.**

---

## Community

- **Discussions:** https://github.com/daftpixie/ozskr/discussions
- **Issues:** https://github.com/daftpixie/ozskr/issues
- **PRs Welcome:** MIT licensed, open contribution
- **Twitter:** @ozskrai (announcements)

---

## Stats

- **Tests:** 147 passing (unit + integration + e2e)
- **Dependencies:** Minimal (15 total, all audited)
- **Bundle Size:** ~2MB (includes Solana SDK)
- **Networks Supported:** Devnet, testnet, mainnet-beta
- **Facilitators:** CDP (Coinbase), PayAI (fallback)
- **Token Support:** Any SPL token (USDC, SOL-wrapped, custom)

---

## Future Roadmap

- **v0.2:** Multi-token delegation (USDC + SOL in single session)
- **v0.3:** Time-based delegation expiry
- **v0.4:** Webhook notifications for spend events
- **v0.5:** Dashboard for delegation management (web UI)
- **v1.0:** Production audit + mainnet recommendation

---

*Submitted February 2026*
