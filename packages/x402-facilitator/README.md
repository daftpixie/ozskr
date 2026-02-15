# @ozskr/x402-facilitator

Self-hosted x402 payment facilitator for Solana with governance hooks. Co-signs transactions as fee payer while enforcing OFAC screening, delegation validation, budget caps, and circuit breaker protection.

**Status**: Beta
**License**: MIT
**Requires**: Node.js 20+, Solana RPC endpoint, encrypted agent keypair

## Quick Start

```bash
# Install
npm install @ozskr/x402-facilitator

# Configure (create .env)
cat > .env <<EOF
SOLANA_RPC_URL=https://api.devnet.solana.com
FACILITATOR_KEYPAIR_PATH=/path/to/agent-keypair.json
FACILITATOR_PASSPHRASE=your-passphrase-here
SOLANA_NETWORK=devnet
PORT=4020
EOF

# Run
npx x402-facilitator
```

Server runs on `http://localhost:4020` by default. Point your MCP client to this URL.

## Features

The facilitator enforces 8 governance hooks before co-signing any transaction:

1. **OFAC Screening**: Validates payer and recipient against OFAC SDN blocklist
2. **Delegation Validation**: Ensures valid SPL token delegation exists on-chain
3. **Budget Enforcement**: Enforces spending caps from delegation state
4. **Circuit Breaker**: Blocks settlement after consecutive failures (prompt injection defense)
5. **Blockhash Validation**: Rejects stale or expired blockhashes
6. **Simulate-before-Submit**: Simulates every transaction before submission
7. **Gas Manager**: Monitors fee payer balance and alerts when low
8. **Audit Logging**: Logs every settlement attempt (success and failure) with transaction signatures

All hooks are configurable via environment variables (disabled by default for devnet).

### OFAC Screening

This package includes a baseline OFAC/SDN screening implementation using a static
blocklist. Production operators SHOULD supplement this with a real-time blockchain
analytics service (Chainalysis, Elliptic, or TRM Labs) by implementing the
`ScreeningProvider` interface. The static list is refreshed weekly but may not
reflect the most recent OFAC additions. OFAC operates under strict liability —
consult legal counsel for your compliance obligations.

## Configuration

Create a `.env` file in your facilitator directory:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SOLANA_RPC_URL` | Yes | - | Solana RPC endpoint (e.g. `https://api.devnet.solana.com`) |
| `FACILITATOR_KEYPAIR_PATH` | Yes | - | Path to encrypted keypair file (from `@ozskr/agent-wallet-sdk`) |
| `FACILITATOR_PASSPHRASE` | Yes | - | Keypair decryption passphrase (minimum 12 characters) |
| `SOLANA_NETWORK` | No | `devnet` | Network identifier: `devnet`, `mainnet-beta`, or `testnet` |
| `PORT` | No | `4020` | Server port |
| `HOST` | No | `0.0.0.0` | Bind address |
| `OFAC_ENABLED` | No | `false` | Enable OFAC SDN screening |
| `OFAC_FAIL_CLOSED` | No | `true` | Block transactions if OFAC screening service is unavailable |
| `OFAC_BLOCKLIST_PATH` | No | - | Path to OFAC blocklist JSON file (required if `OFAC_ENABLED=true`) |
| `CIRCUIT_BREAKER_ENABLED` | No | `false` | Enable circuit breaker (blocks after 5 consecutive failures) |
| `DELEGATION_CHECK_ENABLED` | No | `false` | Enable on-chain delegation validation |
| `BUDGET_ENFORCE_ENABLED` | No | `false` | Enable budget cap enforcement |
| `SIMULATE_BEFORE_SUBMIT` | No | `false` | Enable transaction simulation before submission |
| `BLOCKHASH_VALIDATION_ENABLED` | No | `false` | Enable blockhash freshness validation |
| `GAS_ALERT_THRESHOLD_SOL` | No | `0.1` | Fee payer balance threshold for alerts (in SOL) |
| `MAX_SETTLEMENT_AMOUNT` | No | - | Maximum settlement amount in base units (e.g. `1000000` for 1 USDC) |
| `ALLOWED_TOKENS` | No | - | Comma-separated list of allowed token mints (e.g. `EPjFWdd5Au...`) |
| `ALLOWED_RECIPIENTS` | No | - | Comma-separated list of allowed recipient addresses |
| `RATE_LIMIT_PER_MINUTE` | No | `60` | Maximum settlements per minute (global limit) |

**Mainnet recommendations**: Enable `OFAC_ENABLED`, `CIRCUIT_BREAKER_ENABLED`, `DELEGATION_CHECK_ENABLED`, `BUDGET_ENFORCE_ENABLED`, `SIMULATE_BEFORE_SUBMIT`, and `BLOCKHASH_VALIDATION_ENABLED`.

## API Reference

### POST /verify

Validates a payment request against governance rules without submitting a transaction.

**Request:**
```json
{
  "paymentPayload": {
    "transaction": "base64-encoded-transaction",
    "signers": ["facilitator-address"]
  },
  "paymentRequirements": {
    "payee": "recipient-address",
    "amount": 1000000,
    "currency": "USDC"
  }
}
```

**Response (200 OK):**
```json
{
  "isValid": true,
  "payer": "payer-address"
}
```

**Response (400 Bad Request):**
```json
{
  "isValid": false,
  "invalidReason": "OFAC: payer address is on SDN blocklist"
}
```

### POST /settle

Validates, co-signs, simulates, and submits a payment transaction.

**Request:**
```json
{
  "paymentPayload": {
    "transaction": "base64-encoded-transaction",
    "signers": ["facilitator-address"]
  },
  "paymentRequirements": {
    "payee": "recipient-address",
    "amount": 1000000,
    "currency": "USDC"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "transaction": "base64-encoded-signed-transaction"
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "errorReason": "Circuit breaker active: 5 consecutive failures (cooldown: 60s)"
}
```

### GET /supported

Returns facilitator capabilities.

**Response:**
```json
{
  "kinds": ["solana"],
  "extensions": ["governance", "ofac", "delegation"],
  "signers": ["facilitator-public-key"]
}
```

### GET /health

Returns facilitator health status and governance state.

**Response:**
```json
{
  "status": "ok",
  "version": "0.1.0-beta",
  "network": "devnet",
  "uptime": 3600,
  "replayGuardSize": 42,
  "governance": {
    "ofacEnabled": false,
    "circuitBreakerEnabled": false,
    "delegationCheckEnabled": false,
    "budgetEnforceEnabled": false,
    "simulateBeforeSubmit": false,
    "blockhashValidationEnabled": false
  },
  "gasStatus": {
    "feePayerBalance": "1.5 SOL",
    "alertThreshold": "0.1 SOL",
    "isLow": false
  }
}
```

## Governance Pipeline

Every settlement request flows through the governance pipeline in this order:

```
1. Fast Local Checks
   - Rate limit validation
   - Payload schema validation
   - Replay guard (duplicate transaction detection)

2. OFAC Screening (if enabled)
   - Payer address check against SDN blocklist
   - Recipient address check against SDN blocklist
   - Fail-closed mode: block if screening service unavailable

3. Delegation Validation (if enabled)
   - On-chain delegation status check
   - Delegate authority verification
   - Expiry validation

4. Budget Enforcement (if enabled)
   - Settlement amount vs. remaining delegation
   - Global MAX_SETTLEMENT_AMOUNT check
   - Token mint allowlist check

5. Circuit Breaker (if enabled)
   - Consecutive failure count check
   - Cooldown period enforcement (60s after 5 failures)

6. Blockhash Validation (if enabled)
   - Blockhash freshness check (max 150 slots old)
   - Recent blockhash availability

7. Transaction Simulation (if enabled)
   - Full simulation against RPC
   - Error detection before submission
   - Prevents Bug 7 fund loss

8. Settlement
   - Co-sign transaction with facilitator keypair
   - Submit to RPC
   - Record transaction signature

9. Audit Logging
   - Log all settlement attempts (success and failure)
   - Include transaction signature, payer, payee, amount, timestamp
   - Enable compliance and debugging
```

**Defense-in-depth**: Most checks are disabled by default for devnet testing. Enable all checks for mainnet production use.

## Integration with @ozskr/x402-solana-mcp

The x402-solana-mcp package is designed to work with this facilitator. Configure the MCP server to point to your facilitator instance:

```bash
# In your MCP server .env
X402_FACILITATOR_URL=http://localhost:4020
```

The MCP server will call the facilitator's `/verify` and `/settle` endpoints for all x402 payment operations.

## Security Model

### Non-Custodial Architecture

The facilitator is **non-custodial**:

- **Co-signs as fee payer only**: The facilitator never has spending authority over user funds
- **Delegation-based**: All payments use SPL token delegation (`transferChecked` with delegate authority)
- **User retains custody**: The agent holds the delegate keypair, the user holds the owner keypair
- **Revocable**: Users can revoke delegation at any time via SPL `revoke` instruction

### Simulate-Before-Submit

When `SIMULATE_BEFORE_SUBMIT=true`, every transaction is simulated against the RPC before submission. This prevents:

- **Bug 7 fund loss**: Malformed transactions that would fail on-chain
- **Prompt injection attacks**: Adversarially crafted transactions designed to drain funds
- **Gas waste**: Failed transactions that consume fees without effect

### Three Enforcement Layers

The facilitator provides defense-in-depth via three layers:

1. **SDK Layer** (`@ozskr/agent-wallet-sdk`): Client-side budget tracking and delegation validation
2. **Facilitator Layer** (this package): Server-side governance hooks (OFAC, circuit breaker, delegation, budget, simulation)
3. **Chain Layer**: On-chain SPL token delegation enforced by the Solana Token Program

An adversary must compromise all three layers to execute an unauthorized payment.

## In-Memory State

The facilitator uses in-memory state for:

- **Replay guard**: Tracks transaction signatures to prevent double-submission
- **Circuit breaker**: Counts consecutive failures to trigger cooldown
- **Budget enforcer**: Tracks spent amounts within current session

**Important**: All in-memory state resets on facilitator restart. The on-chain `delegatedAmount` from SPL token accounts is the source of truth for budget caps.

**Production recommendation**: Upgrade to Redis for multi-instance deployments. Shared state ensures replay guard and circuit breaker work across multiple facilitator processes.

## Example: Full Facilitator Setup

```bash
# 1. Generate agent keypair (using @ozskr/agent-wallet-sdk)
cat > generate-keypair.js <<'EOF'
import { generateAgentKeypair, storeEncryptedKeypair } from '@ozskr/agent-wallet-sdk';

const { signer, keypairBytes } = await generateAgentKeypair();
console.log(`Agent public key: ${signer.address}`);

await storeEncryptedKeypair(
  keypairBytes,
  process.env.PASSPHRASE,
  './facilitator-keypair.json',
);
keypairBytes.fill(0);
console.log('Keypair stored at ./facilitator-keypair.json');
EOF

export PASSPHRASE="my-secure-passphrase-123"
node generate-keypair.js

# 2. Configure facilitator
cat > .env <<'EOF'
SOLANA_RPC_URL=https://api.devnet.solana.com
FACILITATOR_KEYPAIR_PATH=./facilitator-keypair.json
FACILITATOR_PASSPHRASE=my-secure-passphrase-123
SOLANA_NETWORK=devnet
PORT=4020

# Enable governance hooks for production
OFAC_ENABLED=false
CIRCUIT_BREAKER_ENABLED=false
DELEGATION_CHECK_ENABLED=false
BUDGET_ENFORCE_ENABLED=false
SIMULATE_BEFORE_SUBMIT=false
BLOCKHASH_VALIDATION_ENABLED=false
EOF

# 3. Run facilitator
npx x402-facilitator

# 4. Test health endpoint
curl http://localhost:4020/health

# 5. Configure MCP server to use facilitator
cat >> ../x402-solana-mcp/.env <<'EOF'
X402_FACILITATOR_URL=http://localhost:4020
EOF
```

## Production Checklist

Before deploying to mainnet:

- [ ] Enable all governance hooks in `.env`
- [ ] Set `OFAC_ENABLED=true` and provide `OFAC_BLOCKLIST_PATH`
- [ ] Set `CIRCUIT_BREAKER_ENABLED=true`
- [ ] Set `DELEGATION_CHECK_ENABLED=true`
- [ ] Set `BUDGET_ENFORCE_ENABLED=true`
- [ ] Set `SIMULATE_BEFORE_SUBMIT=true`
- [ ] Set `BLOCKHASH_VALIDATION_ENABLED=true`
- [ ] Configure `MAX_SETTLEMENT_AMOUNT` to cap single transactions
- [ ] Configure `ALLOWED_TOKENS` to allowlist supported mints
- [ ] Configure `ALLOWED_RECIPIENTS` if applicable
- [ ] Fund facilitator keypair with sufficient SOL for transaction fees (recommend 1+ SOL)
- [ ] Monitor `GAS_ALERT_THRESHOLD_SOL` alerts
- [ ] Set up centralized logging for audit trail
- [ ] Consider Redis upgrade for multi-instance deployment
- [ ] Run security audit on facilitator deployment

## Legal & Compliance

This software is provided "as-is" without warranty. Operators are responsible for:

- **OFAC compliance**: The included SDN screening uses a static blocklist that may not reflect the most recent OFAC additions. OFAC operates under strict liability — supplement with a real-time screening service (Chainalysis, Elliptic, or TRM Labs) for production use. Consult legal counsel for your specific compliance obligations.
- **Money transmission**: Operating a payment facilitator may constitute money transmission depending on jurisdiction — consult legal counsel before deploying
- **Settlement finality**: All transactions on Solana mainnet-beta are irreversible — enable all governance hooks before mainnet deployment
- **Key management**: The facilitator keypair (fee payer) must be secured appropriately — use encrypted storage with strong passphrases, restrict file permissions to 0600, and never commit keypair files to version control
- **Audit retention**: The built-in audit logger uses in-memory storage — implement persistent audit logging (Supabase, S3) for compliance retention requirements
- **Data protection**: Transaction logs may contain personal data (addresses linked to identities) — comply with applicable data protection regulations

This package does NOT provide legal, financial, or compliance advice. Consult qualified legal counsel before deploying in production.

## License

MIT -- Copyright (c) 2026 VT Infinite, Inc

ozskr.ai is developed and maintained by VT Infinite, Inc.
