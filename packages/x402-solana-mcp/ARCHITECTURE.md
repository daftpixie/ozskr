# x402-solana-mcp Architecture

Technical architecture guide for the x402-solana-mcp MCP server.

---

## Payment Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Agent calls x402_pay(url, passphrase, tokenAccount, ...)    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             v
┌─────────────────────────────────────────────────────────────────┐
│ 2. Load agent keypair from encrypted file                      │
│    - Decrypt using passphrase (scrypt KDF + AES-256-GCM)       │
│    - Cache signer in closure for session                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             v
┌─────────────────────────────────────────────────────────────────┐
│ 3. Initialize BudgetTracker (if not already active)            │
│    - Query delegation via checkDelegation(tokenAccount)        │
│    - Create tracker with originalAmount as spending cap        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             v
┌─────────────────────────────────────────────────────────────────┐
│ 4. Send HTTP request to target URL                             │
│    - makeX402Request(url, method, headers, body)               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                v                         v
        ┌─────────────┐         ┌────────────────┐
        │ HTTP 200/OK │         │ HTTP 402 (x402)│
        └──────┬──────┘         └────────┬───────┘
               │                         │
               v                         v
    ┌──────────────────┐     ┌──────────────────────────────┐
    │ Return response  │     │ 5. Parse payment requirements│
    │ (no payment)     │     │    - Try V2 header first     │
    └──────────────────┘     │    - Fallback to V1 headers  │
                             └──────────┬───────────────────┘
                                        │
                                        v
                             ┌──────────────────────────────┐
                             │ 6. Validate requirement      │
                             │    - Network match (Solana)  │
                             │    - Valid recipient address │
                             │    - Amount > 0              │
                             └──────────┬───────────────────┘
                                        │
                                        v
                             ┌──────────────────────────────┐
                             │ 7. Check maxAmount cap       │
                             │    - Reject if cost > limit  │
                             └──────────┬───────────────────┘
                                        │
                                        v
                             ┌──────────────────────────────┐
                             │ 8. Check budget              │
                             │    - budgetTracker.check()   │
                             │    - Reject if insufficient  │
                             └──────────┬───────────────────┘
                                        │
                                        v
                             ┌──────────────────────────────┐
                             │ 9. Build payment payload     │
                             │    - x402Version, accepted   │
                             │    - payer: agent.address    │
                             │    - resource: { url }       │
                             └──────────┬───────────────────┘
                                        │
                                        v
                             ┌──────────────────────────────┐
                             │ 10. Submit to facilitator    │
                             │    - Try CDP first (5s)      │
                             │    - Fallback to PayAI       │
                             │    - Exponential backoff     │
                             │    - Short-circuit on 4xx    │
                             └──────────┬───────────────────┘
                                        │
                        ┌───────────────┴───────────────┐
                        │                               │
                        v                               v
              ┌─────────────────┐           ┌───────────────────┐
              │ Settlement OK   │           │ Settlement failed │
              └────────┬────────┘           └────────┬──────────┘
                       │                             │
                       v                             v
            ┌──────────────────────┐      ┌──────────────────────┐
            │ 11. Retry with proof │      │ Return error         │
            │    - X-Payment-      │      │ - SETTLEMENT_FAILED  │
            │      Signature header│      └──────────────────────┘
            └──────────┬───────────┘
                       │
                       v
            ┌──────────────────────────────┐
            │ 12. Record transaction       │
            │    - budgetTracker.record()  │
            │    - appendTransaction()     │
            │    - .x402-history.json      │
            └──────────┬───────────────────┘
                       │
                       v
            ┌──────────────────────────────┐
            │ 13. Return response          │
            │    - content, signature,     │
            │      amountPaid, facilitator │
            └──────────────────────────────┘
```

---

## Facilitator Trust Model

### Why Facilitators?

Facilitators are third-party services that handle transaction building, signing, and submission for x402 payments. They exist because:

1. **Transaction Complexity**: Building SPL token transfer transactions requires on-chain data (recent blockhash, token account addresses, etc.)
2. **Simulation**: Transactions must be simulated before submission to prevent failed payments
3. **Network Reliability**: Facilitators handle RPC retries, fee estimation, and transaction confirmation
4. **Protocol Compliance**: Facilitators ensure x402 protocol requirements are met (timeout enforcement, payment proof format, etc.)

### Trust Assumptions

Facilitators **cannot steal funds** because:
- Agent only has delegated authority (capped by SPL `approve()` amount)
- Facilitator builds the transaction but agent's private key never leaves the MCP server
- On-chain delegation cap is enforced by the Solana runtime

Facilitators **can** fail or be malicious in these ways:
- Refuse to settle valid payments (availability risk)
- Claim settlement success but never submit transaction (detectable via on-chain lookup)
- Submit transaction with incorrect amount (rejected by x402 server on retry)

### Mitigation: CDP Primary + PayAI Fallback

This server uses a two-tier facilitator strategy:

| Facilitator | URL | Retry Strategy | Timeout |
|-------------|-----|----------------|---------|
| CDP (primary) | `https://x402.org/facilitator` | Max 2 retries, exponential backoff (500ms, 1000ms) | 5s per attempt |
| PayAI (fallback) | `https://facilitator.payai.network` | Max 2 retries, exponential backoff | 5s per attempt |

**Sequence**:
1. Try CDP with retries
2. If all CDP attempts fail, try PayAI with retries
3. If both fail, return `FACILITATOR_ERROR`

**Short-Circuit on 4xx**:
- Client errors (400-499) are NOT retried — these indicate invalid payloads
- Server errors (500-599) and timeouts trigger retry + fallback

**Exponential Backoff**:
```
Attempt 1: Immediate
Attempt 2: +500ms delay
Attempt 3: +1000ms delay
```

Total worst-case latency: ~22 seconds (CDP 3 attempts + PayAI 3 attempts, all timeout)

---

## Budget Enforcement

Three layers of budget enforcement prevent overspending:

### Layer 1: Per-Request maxAmount Cap

Set in `x402_pay` tool call:

```typescript
x402_pay({
  url: "https://api.example.com/premium",
  maxAmount: "1000000",  // 1 USDC (6 decimals)
  // ...
})
```

- **Checked before** facilitator submission
- **Rejects immediately** if payment requirement exceeds this amount
- **Error code**: `AMOUNT_EXCEEDS_MAX`

### Layer 2: Session Budget Tracker

Initialized from delegation cap on first `x402_pay` call:

```typescript
// In createServer() closure:
let budgetTracker: BudgetTracker | null = null;

// On first x402_pay:
if (!budgetTracker) {
  const delegation = await checkDelegation(tokenAccount);
  budgetTracker = createBudgetTracker(delegation.originalAmount);
}
```

**Checks before payment**:
```typescript
const budgetCheck = await budgetTracker.checkBudget(tokenAccount, rpcConfig);
if (budgetCheck.available < BigInt(paymentAmount)) {
  return errorResult('BUDGET_EXCEEDED', ...);
}
```

**Records after payment**:
```typescript
budgetTracker.recordSpend(BigInt(paymentAmount), transactionSignature);
```

**State**:
- `originalAmount`: Delegation cap from SPL token account
- `spent`: Cumulative amount spent in this session
- `available = originalAmount - spent`

**Reset**: BudgetTracker persists for the lifetime of the MCP server session. Restart the server to reset.

### Layer 3: On-Chain Delegation Cap

Set by owner wallet via SPL `approve()`:

```typescript
import { delegateTokens } from '@ozskr/agent-wallet-sdk';

await delegateTokens(
  ownerSigner,
  tokenAccount,
  agentAddress,
  100_000_000n,  // Hard cap: 100 USDC
  rpcConfig
);
```

**Enforced by Solana runtime**:
- Transfer instructions fail if amount exceeds delegated balance
- Facilitators simulate transactions before submission — simulation fails prevent bad transactions
- On-chain state is source of truth (Layer 2 budget tracker syncs from this)

**Cumulative enforcement**:
```
Request allowed if:
  paymentAmount <= maxAmount (Layer 1)
  AND
  paymentAmount <= budgetTracker.available (Layer 2)
  AND
  paymentAmount <= on-chain delegation.remainingAmount (Layer 3)
```

---

## Transport Modes

### stdio (Default)

MCP servers use stdio transport for communication with Claude Code, Cursor, etc.

```typescript
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const transport = new StdioServerTransport();
await server.connect(transport);
```

- **Input**: `process.stdin` (JSON-RPC messages from MCP host)
- **Output**: `process.stdout` (JSON-RPC responses)
- **Logging**: `process.stderr` (informational messages)

### InMemoryTransport (Testing)

Used in unit tests for synchronous tool calls:

```typescript
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

await server.connect(serverTransport);
const client = new Client({ name: 'test-client', version: '1.0.0' }, {});
await client.connect(clientTransport);

// Call tools directly:
const result = await client.callTool({ name: 'x402_setup_agent', arguments: {...} });
```

### Future: SSE / WebSocket

MCP SDK supports Server-Sent Events and WebSocket transports for web-based integrations. Not currently used in this server.

---

## x402 Protocol Versions

### V2 (Recommended)

Uses a single `X-Payment-Required` header with base64-encoded JSON:

```http
HTTP/1.1 402 Payment Required
X-Payment-Required: eyJ4NDAyVmVyc2lvbiI6MiwiYWNjZXB0cyI6W3sic2NoZW1lIjoiZXhhY3QiLC...
```

Decoded payload:

```json
{
  "x402Version": 2,
  "accepts": [
    {
      "scheme": "exact",
      "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      "amount": "500000",
      "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      "payTo": "RecipientAddress...",
      "maxTimeoutSeconds": 30
    }
  ]
}
```

**Advantages**:
- Single header (simpler parsing)
- Supports multiple payment options
- Extensible via JSON schema

### V1 (Legacy)

Uses individual `X-PAYMENT-*` headers:

```http
HTTP/1.1 402 Payment Required
X-Payment-Amount: 500000
X-Payment-Recipient: RecipientAddress...
X-Payment-Token: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
X-Payment-Network: solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1
```

**Limitations**:
- Multiple headers (harder to parse reliably)
- Single payment option only
- Non-standard field names (`X-Payment-PayTo` vs `X-Payment-Recipient`)

### Backward Compatibility

This server supports both V2 and V1:

```typescript
// In parsePaymentRequiredResponse():

// Try V2 header first
const v2Header = response.headers.get('X-Payment-Required');
if (v2Header) {
  const decoded = decodePaymentRequiredHeader(v2Header);
  if (isPaymentRequired(decoded)) {
    return extractRequirements(decoded);
  }
}

// Fallback to V1 headers
const amount = response.headers.get('X-Payment-Amount');
const recipient = response.headers.get('X-Payment-Recipient')
                  ?? response.headers.get('X-Payment-PayTo');
// ...
```

**Detection logic**:
1. Check for `X-Payment-Required` header → V2
2. Check for `X-Payment-Amount` + `X-Payment-Recipient` → V1
3. If neither found → No payment requirements

---

## State Management

The MCP server uses closure-scoped state in `createServer()`:

```typescript
export function createServer(config: Config): McpServer {
  const server = new McpServer({ name: 'x402-solana-mcp', version: '0.1.0-beta' });

  // Closure state persists across tool calls within a session:
  let cachedSigner: KeyPairSigner | null = null;
  let budgetTracker: BudgetTracker | null = null;

  // Tool handlers close over these variables
  server.tool('x402_pay', ..., async (args) => {
    if (!cachedSigner) {
      cachedSigner = await loadEncryptedKeypair(...);
    }
    if (!budgetTracker) {
      budgetTracker = createBudgetTracker(...);
    }
    // ...
  });

  return server;
}
```

### cachedSigner

- **Initialized**: On first `x402_pay` or `x402_check_balance` call
- **Purpose**: Avoid re-decrypting keypair on every payment
- **Lifetime**: Entire MCP server session (until process exit)
- **Security**: Passphrase is NOT cached — only the decrypted keypair

### budgetTracker

- **Initialized**: On first `x402_pay` call (queries delegation cap from on-chain state)
- **Purpose**: Track cumulative spending in this session
- **Lifetime**: Entire MCP server session
- **Reset**: Restart the MCP server to clear tracked spending

### Session Lifecycle

```
┌─────────────────────────────────────────┐
│ MCP host (Claude Code) starts server    │
│   npx @ozskr/x402-solana-mcp            │
└─────────────────┬───────────────────────┘
                  │
                  v
┌─────────────────────────────────────────┐
│ createServer(config) called             │
│   cachedSigner = null                   │
│   budgetTracker = null                  │
└─────────────────┬───────────────────────┘
                  │
                  v
┌─────────────────────────────────────────┐
│ Tool calls arrive via stdio transport   │
│   - x402_pay loads signer + tracker     │
│   - State persists across calls         │
└─────────────────┬───────────────────────┘
                  │
                  v
┌─────────────────────────────────────────┐
│ MCP host exits                          │
│   - Process terminates                  │
│   - Closure state is lost               │
│   - Next session starts fresh           │
└─────────────────────────────────────────┘
```

**No disk persistence for session state** — spending tracker is in-memory only. Transaction history is persisted in `.x402-history.json`.

---

## Error Handling

All tools return structured error responses:

```typescript
function errorResult(code: string, message: string) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ error: code, message }),
    }],
    isError: true,
  };
}
```

### Error Codes

| Code | Meaning | Retry? |
|------|---------|--------|
| `SETUP_FAILED` | Keypair generation failed | No (check passphrase length) |
| `CHECK_FAILED` | Delegation check RPC error | Yes (transient network issue) |
| `PAY_FAILED` | Generic payment error | Maybe (inspect message) |
| `NO_REQUIREMENTS` | 402 response missing headers | No (server misconfiguration) |
| `INVALID_REQUIREMENT` | Unsupported network/scheme | No (incompatible x402 server) |
| `AMOUNT_EXCEEDS_MAX` | Cost > maxAmount cap | No (increase cap or choose cheaper option) |
| `BUDGET_EXCEEDED` | Insufficient delegated balance | No (revoke + re-delegate with higher cap) |
| `SETTLEMENT_FAILED` | Facilitator rejected payment | Maybe (retry may work) |
| `FACILITATOR_ERROR` | All facilitators failed | Yes (temporary outage) |
| `HISTORY_FAILED` | Transaction history I/O error | Yes (file permissions issue) |
| `DISCOVER_FAILED` | Service discovery failed | Yes (network issue) |
| `ESTIMATE_FAILED` | Cost estimation failed | Yes (network issue) |

### DelegationError

Thrown by `@ozskr/agent-wallet-sdk` for delegation-related issues:

```typescript
if (error instanceof DelegationError) {
  return errorResult(error.code, error.message);
}
```

Common codes:
- `KEYPAIR_EXISTS`: Tried to generate keypair but file already exists (use `force: true`)
- `INVALID_PASSPHRASE`: Wrong passphrase for encrypted keypair
- `NO_DELEGATION`: Token account has no active delegation
- `DELEGATION_EXPIRED`: Delegation amount exhausted (re-approve needed)

### FacilitatorError

Thrown by `submitToFacilitator()` for facilitator issues:

```typescript
if (error instanceof FacilitatorError) {
  return errorResult('FACILITATOR_ERROR', error.message);
}
```

Includes HTTP status code for debugging:

```typescript
class FacilitatorError extends Error {
  readonly statusCode?: number;
}
```

---

## File Structure

```
packages/x402-solana-mcp/
├── src/
│   ├── server.ts           # MCP server factory, 8 tool definitions
│   ├── config.ts           # Zod schema, env var loading
│   ├── cli.ts              # Entry point (stdio transport)
│   └── lib/
│       ├── x402-client.ts  # HTTP client, header parsing, retry logic
│       ├── facilitator.ts  # CDP/PayAI submission, exponential backoff
│       └── history.ts      # Local transaction log (.x402-history.json)
├── package.json
├── tsconfig.json
├── README.md
└── ARCHITECTURE.md         # This file
```

### Dependency Graph

```
cli.ts
  └─> config.ts (loadConfigFromEnv)
  └─> server.ts (createServer)
        └─> @ozskr/agent-wallet-sdk (keypair, delegation, budget)
        └─> lib/x402-client.ts (makeX402Request, retryWithPayment)
        └─> lib/facilitator.ts (submitToFacilitator)
        └─> lib/history.ts (appendTransaction, queryHistory)
              └─> @x402/core (header encoding/decoding)
              └─> @x402/svm (address validation, CAIP-2 constants)
```

---

## Testing

See `packages/x402-solana-mcp/src/__tests__/` for unit tests.

**Key patterns**:

### Mock MCP Transport

```typescript
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);

const client = new Client({ name: 'test', version: '1.0' }, {});
await client.connect(clientTransport);

const result = await client.callTool({ name: 'x402_setup_agent', arguments: {...} });
```

### Mock Facilitator

```typescript
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const facilitatorMock = setupServer(
  http.post('https://x402.org/facilitator/settle', () => {
    return HttpResponse.json({
      success: true,
      transaction: 'MockSignature123...',
      network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    });
  })
);

beforeAll(() => facilitatorMock.listen());
afterEach(() => facilitatorMock.resetHandlers());
afterAll(() => facilitatorMock.close());
```

### Mock RPC Responses

```typescript
const rpcMock = setupServer(
  http.post(config.solanaRpcUrl, async ({ request }) => {
    const body = await request.json();
    if (body.method === 'getAccountInfo') {
      return HttpResponse.json({
        jsonrpc: '2.0',
        id: body.id,
        result: { value: { data: [...], owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' } },
      });
    }
  })
);
```

---

## Future Enhancements

### Phase 1: Payment Flow (Complete)

- [x] 8 MCP tools (setup, delegation, payment, history, discovery, estimation)
- [x] V2 + V1 x402 protocol support
- [x] CDP + PayAI facilitator fallback
- [x] 3-layer budget enforcement
- [x] Encrypted keypair storage

### Phase 2: Advanced Features (Planned)

- [ ] Multi-token support (automatic token account lookup)
- [ ] Payment receipts (signed proof of payment)
- [ ] Batch payments (pay for multiple APIs in one transaction)
- [ ] Subscription payments (recurring delegation renewal)
- [ ] Custom facilitator plugins (extend beyond CDP/PayAI)

### Phase 3: Observability (Planned)

- [ ] Prometheus metrics endpoint (payment counts, latencies, failure rates)
- [ ] Structured logging (JSON output for log aggregation)
- [ ] OpenTelemetry tracing (full payment flow spans)
- [ ] Alert on budget exhaustion (notify owner wallet)

---

## Links

- **Repository**: https://github.com/daftpixie/ozskr
- **Package**: https://www.npmjs.com/package/@ozskr/x402-solana-mcp
- **x402 Protocol**: https://x402.org
- **MCP SDK**: https://github.com/modelcontextprotocol/sdk
- **Agent Wallet SDK**: https://www.npmjs.com/package/@ozskr/agent-wallet-sdk

Built with Claude Code. MIT License.
