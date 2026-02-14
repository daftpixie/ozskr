# Solana Developer Forum Post

**Title:** [RELEASE] First MCP server for AI agent x402 payments on Solana with non-custodial SPL delegation

---

## Introduction

We're releasing two open-source npm packages that enable AI agents to pay for x402-enabled APIs on Solana using delegated SPL tokens:

- **@ozskr/agent-wallet-sdk** — Non-custodial AI agent wallets with SPL delegation and budget enforcement
- **@ozskr/x402-solana-mcp** — MCP server for x402 payment flow on Solana

Both packages are MIT licensed, production-ready (147 tests passing), and available on npm with beta tags.

**GitHub:** https://github.com/daftpixie/ozskr (packages/ directory)
**npm:** `@ozskr/x402-solana-mcp` and `@ozskr/agent-wallet-sdk`

---

## What Problem Does This Solve?

AI agents need to autonomously pay for API access, but payment infrastructure for agents is fragmented. Most solutions are either:

1. **Custodial** (agent holds private keys) — unacceptable security risk
2. **Multi-sig** (requires owner approval per tx) — breaks agent autonomy
3. **Off-chain** (credit cards, API keys) — no on-chain auditability

This implementation uses **SPL token delegation** to solve all three:

- **Non-custodial:** Owner retains private keys, agent receives bounded spending authority via `approveChecked`
- **Autonomous:** Agent can spend up to delegated amount without per-tx approval
- **Auditable:** All transactions on-chain, revocable anytime by owner

Combined with x402 (HTTP 402 Payment Required standard) and MCP (Anthropic's Model Context Protocol), AI agents running in Claude Code, Cursor, or Windsurf can discover, pay for, and access premium APIs without human intervention.

---

## Architecture Overview

### @ozskr/agent-wallet-sdk

Core SPL delegation primitives:

```typescript
// 1. Owner creates delegation (10 USDC spending cap)
const delegationTx = await createDelegation(
  {
    ownerTokenAccount: address('...'),
    ownerSigner: walletSigner,
    delegateAddress: agentPublicKey,
    tokenMint: address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // USDC
    maxAmount: 10_000_000n,
    decimals: 6,
  },
  { endpoint: 'https://api.devnet.solana.com' },
);

// 2. Agent spends on owner's behalf
const signature = await transferAsDelegate(
  {
    delegateSigner: agentKeypairSigner,
    sourceTokenAccount: address('...'),
    destinationTokenAccount: address('...'),
    amount: 1_000_000n, // 1 USDC
    decimals: 6,
    tokenMint: address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
    feePayer: agentKeypairSigner,
  },
  { endpoint: 'https://api.devnet.solana.com' },
);
```

**Features:**
- Uses `@solana/kit` (modern @solana/web3.js v2.0 patterns)
- `approveChecked` / `transferChecked` for mint + decimal validation
- Client-side budget tracker (defense-in-depth)
- Encrypted keypair storage (scrypt KDF + AES-256-GCM)
- Secure file permissions enforcement (0600)

### @ozskr/x402-solana-mcp

MCP server exposing 8 tools for AI agents:

1. **x402_setup_agent** — Generate encrypted agent keypair
2. **x402_check_delegation** — Query on-chain delegation status
3. **x402_check_balance** — Check agent SOL + token balances
4. **x402_revoke_delegation** — Owner revokes delegation (returns instructions)
5. **x402_pay** — Full x402 payment flow (detect 402 → pay → retry with proof)
6. **x402_transaction_history** — Query agent's payment history
7. **x402_discover_services** — Find x402-enabled APIs
8. **x402_estimate_cost** — Check payment requirements without spending

**x402 Payment Flow:**

```
1. Agent makes HTTP request to API endpoint
2. Receives 402 Payment Required with payment details
3. Validates requirement (network, amount, token, recipient)
4. Checks delegation status + budget
5. Builds SPL transferChecked transaction as delegate
6. Submits to x402 facilitator (CDP or PayAI)
7. Receives payment proof
8. Retries original request with proof
9. Returns API response to agent
```

**Security:**
- 3-layer budget enforcement (per-request maxAmount, session tracker, on-chain cap)
- Transaction simulation before every payment
- Facilitator fallback (CDP → PayAI)
- Passphrase-encrypted agent keypairs
- Local transaction history (audit trail)

---

## Quickstart

### Installation (Claude Code)

```bash
claude mcp add x402-solana -- npx @ozskr/x402-solana-mcp
```

Set environment variables:

```bash
export SOLANA_RPC_URL="https://api.devnet.solana.com"
export AGENT_KEYPAIR_PATH="$HOME/.x402-agent/keypair.json"
export SOLANA_NETWORK="devnet"
```

### Usage Example

```
# Step 1: Generate agent keypair
Use x402_setup_agent with passphrase "my-secure-passphrase-min-12-chars"

# Step 2: Fund agent address with SOL for fees (output from Step 1)
# Step 3: Delegate tokens to agent using @ozskr/agent-wallet-sdk

# Step 4: Agent pays for API access
Use x402_pay with url "https://api.example.com/premium", passphrase "...", tokenAccount "...", maxAmount "1000000"
```

Agent autonomously handles 402 detection, payment, and retry.

---

## Why Solana?

We chose Solana over Ethereum L2s / Base for agent payments because:

1. **Sub-second finality** — agents don't wait 12+ seconds for payment confirmation
2. **Low fees** — 0.000005 SOL per tx (~$0.001) vs. $0.10+ on L2s
3. **SPL delegation primitives** — built into Token Program, no custom contracts
4. **High throughput** — agents can execute 1000s of concurrent payments without congestion

For AI agents making micropayments at scale, Solana is the only production-ready option.

---

## Technical Decisions

### Why SPL delegation over PDAs?

**PDA approach** requires deploying a custom program with:
- Init agent PDA (1 tx)
- Fund PDA (1 tx)
- Agent signs instruction to trigger PDA transfer (1 tx per payment)
- Close PDA when done (1 tx)

**SPL delegation** requires:
- Owner calls `approveChecked` (1 tx)
- Agent signs `transferChecked` directly (1 tx per payment)
- Owner calls `revoke` if needed (1 tx)

Delegation is simpler, gas-efficient, and uses battle-tested SPL Token Program code. No custom contract risk.

### Why @solana/kit over web3.js v1?

`@solana/kit` is the modern Solana SDK with:
- Functional composition via `pipe()`
- Immutable transaction message builders
- Type-safe address handling
- Better TypeScript inference

web3.js v1 patterns (`new PublicKey()`, mutable `Transaction`) are deprecated. For new projects targeting Solana in 2026, `@solana/kit` is the recommended path.

### Why MCP?

MCP is Anthropic's standard for AI tool integration. By building an MCP server, we get:

- **Universal compatibility** — works with Claude Code, Cursor, Windsurf, any MCP host
- **Declarative tools** — agents discover capabilities via JSON-RPC introspection
- **Separation of concerns** — payment logic isolated from agent reasoning
- **Ecosystem alignment** — integrates with 200+ existing MCP servers

An agent with this MCP server can combine x402 payments with file system access, git operations, web search, etc. — all via the same protocol.

---

## What's Next

We're submitting this to:

- **MCP server directory** (mcp.so, PulseMCP, LobeHub)
- **x402 ecosystem** (x402.org/ecosystem)
- **Solana developer showcase**
- **Anthropic MCP community showcase**

The packages are already integrated into ozskr.ai's agent platform (launching soon). Open-source first, platform integration second.

---

## Call for Feedback

This is a beta release. We're looking for:

1. **Security review** — especially around keypair encryption, transaction simulation, delegation validation
2. **Alternative facilitators** — currently using CDP + PayAI, open to others
3. **Edge case testing** — concurrent payments, delegation expiry, network errors
4. **x402 service providers** — if you run an x402 API, we want to test against it
5. **Feature requests** — what tools would make this more useful?

Open issues on GitHub or reply here.

---

## Credits

Built with Claude Code. Every line of code, every test, every security review — orchestrated by AI agents building tools for AI agents.

**Repository:** https://github.com/daftpixie/ozskr
**Packages:** https://www.npmjs.com/package/@ozskr/x402-solana-mcp
**License:** MIT
**Built by:** ozskr.ai team

---

Questions? Drop them below or open a GitHub discussion.
