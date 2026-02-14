# @ozskr/x402-solana-mcp

MCP server that lets AI agents pay for x402-enabled APIs on Solana using delegated SPL tokens.

Built with Claude Code. MIT license.

## Why

AI agents need to pay for APIs autonomously. x402 is the HTTP payment protocol (RFC-style standard for HTTP 402 Payment Required). This server bridges x402 to Solana via the Model Context Protocol (MCP), enabling Claude and other AI agents to:

- Detect x402-enabled APIs automatically via HTTP 402 responses
- Pay for API access using delegated SPL tokens (non-custodial)
- Manage payment budgets with on-chain + session-level enforcement
- Query transaction history and discover x402 services

The agent never holds private keys directly — all transactions use delegated authority via SPL `approve()`.

## Installation

### Claude Code

Add to your Claude Code MCP configuration:

```bash
claude mcp add x402-solana -- npx @ozskr/x402-solana-mcp
```

Set environment variables in your shell profile or `.env`:

```bash
export SOLANA_RPC_URL="https://api.devnet.solana.com"
export AGENT_KEYPAIR_PATH="$HOME/.x402-agent/keypair.json"
export SOLANA_NETWORK="devnet"  # optional, defaults to devnet
export X402_FACILITATOR_URL=""   # optional, auto-detected if omitted
export LOG_LEVEL="info"          # optional, defaults to info
```

### Cursor / Windsurf

Add to `.cursor/mcp.json` or equivalent:

```json
{
  "mcpServers": {
    "x402-solana": {
      "command": "npx",
      "args": ["@ozskr/x402-solana-mcp"],
      "env": {
        "SOLANA_RPC_URL": "https://api.devnet.solana.com",
        "AGENT_KEYPAIR_PATH": "/home/user/.x402-agent/keypair.json",
        "SOLANA_NETWORK": "devnet"
      }
    }
  }
}
```

### Manual .mcp.json

```json
{
  "mcpServers": {
    "x402-solana": {
      "command": "npx",
      "args": ["-y", "@ozskr/x402-solana-mcp"],
      "env": {
        "SOLANA_RPC_URL": "https://api.devnet.solana.com",
        "AGENT_KEYPAIR_PATH": "/home/user/.x402-agent/keypair.json",
        "SOLANA_NETWORK": "devnet",
        "X402_FACILITATOR_URL": "https://x402.org/facilitator",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## 3-Step Quickstart

### Step 1: Run x402_setup_agent (generate encrypted keypair)

```
Use x402_setup_agent with passphrase "your-secure-passphrase-min-12-chars"
```

Example output:

```json
{
  "status": "success",
  "agentAddress": "AgentKeypairPublicKey1234567890123456789012345",
  "keypairPath": "/home/user/.x402-agent/keypair.json",
  "message": "Agent keypair generated and encrypted. Fund this address with SOL for transaction fees, then set up an SPL token delegation."
}
```

### Step 2: Fund agent + delegate tokens (owner runs approveChecked)

The agent address needs:
1. **SOL** for transaction fees (0.01 SOL minimum for devnet)
2. **Delegated SPL tokens** via `approveChecked()` from your wallet

Using `@ozskr/agent-wallet-sdk`:

```typescript
import { delegateTokens } from '@ozskr/agent-wallet-sdk';

// Owner wallet delegates 100 USDC to the agent
await delegateTokens(
  ownerSigner,               // Your Phantom/Solflare wallet signer
  'TokenAccountAddress...',  // Your USDC token account
  'AgentPublicKey...',       // Agent address from Step 1
  100_000_000n,              // 100 USDC (6 decimals)
  { endpoint: 'https://api.devnet.solana.com' }
);
```

Verify delegation:

```
Use x402_check_delegation with tokenAccount "YourTokenAccountAddress"
```

Example output:

```json
{
  "status": "success",
  "isActive": true,
  "delegate": "AgentKeypairPublicKey1234567890123456789012345",
  "remainingAmount": "100000000",
  "originalAmount": "100000000",
  "tokenMint": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "ownerTokenAccount": "YourTokenAccountAddress"
}
```

### Step 3: Agent can now x402_pay for any x402-enabled API

```
Use x402_pay with url "https://api.example.com/premium-data", passphrase "your-passphrase", tokenAccount "YourTokenAccountAddress", maxAmount "1000000"
```

Example output (payment required):

```json
{
  "status": "success",
  "paymentRequired": true,
  "content": "{\"data\": \"premium content here\"}",
  "transactionSignature": "5xG7h8K9...",
  "amountPaid": "500000",
  "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "facilitator": "cdp",
  "httpStatus": 200
}
```

Example output (no payment required):

```json
{
  "status": "success",
  "paymentRequired": false,
  "httpStatus": 200,
  "content": "{\"data\": \"free content here\"}",
  "message": "No payment required — resource is free."
}
```

## All 8 Tools

### x402_setup_agent

Generate an agent keypair and display the public key for delegation setup.

**Inputs:**

```typescript
{
  passphrase: string;      // Min 12 characters, encrypts keypair at rest
  outputPath?: string;     // Optional, defaults to AGENT_KEYPAIR_PATH env var
  force?: boolean;         // Overwrite existing keypair if present (default: false)
}
```

**Output:**

```json
{
  "status": "success",
  "agentAddress": "AgentPublicKey...",
  "keypairPath": "/home/user/.x402-agent/keypair.json",
  "message": "Agent keypair generated and encrypted. Fund this address with SOL for transaction fees, then set up an SPL token delegation."
}
```

---

### x402_check_delegation

Check current delegated balance and spending cap for the agent.

**Inputs:**

```typescript
{
  tokenAccount: string;  // Owner SPL token account address (min 32 chars)
}
```

**Output:**

```json
{
  "status": "success",
  "isActive": true,
  "delegate": "AgentPublicKey...",
  "remainingAmount": "100000000",
  "originalAmount": "100000000",
  "tokenMint": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "ownerTokenAccount": "TokenAccountAddress..."
}
```

---

### x402_check_balance

Check agent token balances including delegated and owned amounts.

**Inputs:**

```typescript
{
  passphrase: string;    // Min 12 characters, decrypts keypair
  tokenMint?: string;    // Optional, specific token mint to check (defaults to USDC)
}
```

**Output:**

```json
{
  "status": "success",
  "agentAddress": "AgentPublicKey...",
  "message": "Agent signer loaded. Full token balance queries will be available in a future release."
}
```

---

### x402_revoke_delegation

Revoke the agent spending authority on a token account (owner-only operation).

**Inputs:**

```typescript
{
  tokenAccount: string;  // Token account to revoke delegation from
}
```

**Output (active delegation):**

```json
{
  "status": "success",
  "isActive": true,
  "delegate": "AgentPublicKey...",
  "remainingAmount": "50000000",
  "message": "Active delegation found. The token account owner must sign a revoke transaction using their wallet. Use @ozskr/agent-wallet-sdk revokeDelegation() with the owner signer."
}
```

**Output (no delegation):**

```json
{
  "status": "success",
  "isActive": false,
  "message": "No active delegation found on this token account. Nothing to revoke."
}
```

---

### x402_pay

Make an x402 payment on Solana as a delegate. Sends HTTP request, detects 402, pays via facilitator, retries with proof.

**Inputs:**

```typescript
{
  url: string;               // x402-enabled endpoint URL
  method?: string;           // GET | POST | PUT | DELETE | PATCH (default: GET)
  headers?: Record<string, string>;  // Optional additional headers
  body?: string;             // Request body for POST/PUT/PATCH
  maxAmount?: string;        // Max payment in base units (rejects if cost exceeds)
  passphrase: string;        // Min 12 characters, decrypts keypair
  tokenAccount: string;      // Owner SPL token account (source of delegated funds)
}
```

**Output (payment required):**

```json
{
  "status": "success",
  "paymentRequired": true,
  "content": "{\"premium\": \"data\"}",
  "transactionSignature": "5xG7h8K9M3...",
  "amountPaid": "500000",
  "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "facilitator": "cdp",
  "httpStatus": 200
}
```

**Output (no payment required):**

```json
{
  "status": "success",
  "paymentRequired": false,
  "httpStatus": 200,
  "content": "{\"free\": \"data\"}",
  "message": "No payment required — resource is free."
}
```

**Error codes:**

- `NO_REQUIREMENTS`: Received 402 but could not parse payment requirements
- `INVALID_REQUIREMENT`: Payment requirement validation failed (unsupported network, invalid address, etc.)
- `AMOUNT_EXCEEDS_MAX`: Payment cost exceeds `maxAmount` parameter
- `BUDGET_EXCEEDED`: Payment exceeds remaining delegated balance
- `SETTLEMENT_FAILED`: Facilitator rejected payment
- `FACILITATOR_ERROR`: Facilitator communication failed
- `PAY_FAILED`: General payment error

---

### x402_transaction_history

Query x402 payment transaction history for this agent.

**Inputs:**

```typescript
{
  limit?: number;         // Max records to return (1-100, default: 10)
  before?: string;        // Transaction signature to paginate before
  url?: string;           // Filter by URL (partial match)
  afterDate?: string;     // Filter by date (ISO 8601, returns records after this date)
}
```

**Output:**

```json
{
  "status": "success",
  "count": 2,
  "transactions": [
    {
      "timestamp": "2025-02-14T12:34:56.789Z",
      "signature": "5xG7h8K9...",
      "url": "https://api.example.com/premium-data",
      "amount": "500000",
      "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      "payTo": "RecipientAddress...",
      "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      "facilitator": "cdp",
      "method": "GET"
    }
  ]
}
```

---

### x402_discover_services

Discover x402-enabled endpoints by probing a URL for 402 support or querying a service registry.

**Inputs:**

```typescript
{
  url?: string;       // URL to probe for x402 support (sends OPTIONS/GET)
  registry?: string;  // x402 service registry URL to query
}
```

**Output (probe single URL):**

```json
{
  "status": "success",
  "results": [
    {
      "url": "https://api.example.com/premium",
      "x402Enabled": true,
      "requirements": [
        {
          "scheme": "exact",
          "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
          "amount": "500000",
          "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
          "payTo": "RecipientAddress..."
        }
      ]
    }
  ]
}
```

**Output (query registry):**

```json
{
  "status": "success",
  "results": [
    {
      "registry": "https://x402.org/ecosystem",
      "services": [
        {"name": "Premium API", "url": "https://api.example.com"},
        {"name": "AI Model Access", "url": "https://ai.example.com"}
      ]
    }
  ]
}
```

**Output (no inputs):**

```json
{
  "status": "success",
  "message": "Provide a url to probe or a registry to query.",
  "knownRegistries": [
    "https://x402.org/ecosystem"
  ]
}
```

---

### x402_estimate_cost

Estimate the cost of an x402 request without making a payment.

**Inputs:**

```typescript
{
  url: string;      // x402-enabled endpoint URL
  method?: string;  // GET | POST | PUT | DELETE | PATCH (default: GET)
}
```

**Output (payment required):**

```json
{
  "status": "success",
  "url": "https://api.example.com/premium-data",
  "paymentRequired": true,
  "options": [
    {
      "scheme": "exact",
      "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      "amount": "500000",
      "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      "payTo": "RecipientAddress...",
      "maxTimeoutSeconds": 30,
      "version": 2
    }
  ]
}
```

**Output (no payment required):**

```json
{
  "status": "success",
  "url": "https://api.example.com/free-data",
  "paymentRequired": false,
  "httpStatus": 200,
  "message": "This endpoint does not require x402 payment."
}
```

---

## Configuration Reference

All configuration is via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SOLANA_RPC_URL` | Yes | - | Solana RPC endpoint URL (e.g., `https://api.devnet.solana.com`) |
| `AGENT_KEYPAIR_PATH` | Yes | - | Path to agent keypair JSON file (created by `x402_setup_agent`) |
| `SOLANA_NETWORK` | No | `devnet` | `devnet` \| `mainnet-beta` \| `testnet` |
| `X402_FACILITATOR_URL` | No | Auto-detected | x402 facilitator endpoint (uses CDP -> PayAI fallback if omitted) |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |

---

## Security Model

### Delegated Authority (Non-Custodial)

- Agent keypair is generated locally and encrypted at rest (scrypt KDF + AES-256-GCM)
- Agent never holds private keys for user funds — only receives delegated authority
- Owner wallet calls SPL `approve()` to grant the agent spending permission
- Owner can revoke delegation at any time via `revoke()` instruction

### Budget Enforcement (3 Layers)

1. **Per-Request Cap**: `maxAmount` parameter in `x402_pay` (rejects if cost exceeds limit)
2. **Session Budget**: `BudgetTracker` tracks cumulative spending vs. delegated cap
3. **On-Chain Cap**: SPL `approve()` sets hard limit — agent cannot spend beyond this amount

### Transaction Simulation

All payment transactions are simulated via facilitators before submission. Simulation failures short-circuit the payment flow.

### Encrypted Keypair Storage

Agent keypairs use passphrase-based encryption:
- **KDF**: scrypt (N=16384, r=8, p=1)
- **Cipher**: AES-256-GCM with random IV + auth tag
- **File Permissions**: Keypair files should be `0600` (owner read/write only)

### Facilitator Trust Model

Facilitators handle transaction building, signing, and submission. This server uses:
- **Primary**: CDP (`https://x402.org/facilitator`)
- **Fallback**: PayAI (`https://facilitator.payai.network`)

Facilitators cannot steal funds — they only build transactions using the agent's delegated authority. The delegation cap is enforced on-chain.

---

## FAQ

### What networks are supported?

Devnet, testnet, and mainnet-beta. Set via `SOLANA_NETWORK` env var.

### What tokens are supported?

Any SPL token. The agent uses the delegated token account — no token-specific logic required.

### What facilitators are supported?

CDP (primary) and PayAI (fallback). You can override with `X402_FACILITATOR_URL`.

### What happens if delegation expires?

SPL delegations don't expire by time — only by amount spent. Once the delegated balance is exhausted, `x402_pay` returns `BUDGET_EXCEEDED` error. The owner must call `approve()` again to top up.

### Can the agent spend more than the delegated amount?

No. Three enforcement layers prevent this:
1. `maxAmount` parameter per request
2. Session-level `BudgetTracker`
3. On-chain delegation cap (SPL `approve()` amount)

### How do I revoke delegation?

Use `x402_revoke_delegation` to check delegation status, then call `revokeDelegation()` from `@ozskr/agent-wallet-sdk` with the owner's wallet signer.

### What if a facilitator is down?

The server tries CDP first, then falls back to PayAI. If both fail, `x402_pay` returns `FACILITATOR_ERROR`.

### How is transaction history stored?

Locally in `.x402-history.json` (JSON file). Query via `x402_transaction_history`.

### Can I use this on mainnet?

Yes. Set `SOLANA_NETWORK=mainnet-beta` and use a mainnet RPC URL. Ensure you've audited the delegation amount — mainnet transactions are irreversible.

---

## License

MIT License. See [LICENSE](./LICENSE) for details.

Built with Claude Code. Part of the ozskr.ai ecosystem.

**Repository**: https://github.com/daftpixie/ozskr
**Package**: https://www.npmjs.com/package/@ozskr/x402-solana-mcp
**MCP Directory**: https://github.com/modelcontextprotocol/servers
