# Architecture Decision Record: @ozskr/agent-wallet-sdk

## Why SPL Token Delegation?

AI agents that execute on-chain payments face a fundamental custody dilemma: how can an agent spend tokens without holding the owner's private keys?

### Approach Comparison

| Approach | Custody Risk | Complexity | Latency | Revocability | Spending Caps |
|----------|-------------|------------|---------|--------------|---------------|
| **Keypair Holding** | HIGH (agent holds owner keys) | Low | Low | None (agent has full control) | None (agent has full control) |
| **Multisig** | Low | High (2+ signatures per tx) | High (coordination overhead) | Medium (requires all parties) | Medium (requires contract changes) |
| **Session Keys** | Low | N/A | N/A | N/A | N/A (not available on Solana) |
| **SPL Delegation** | LOW (owner retains custody) | Low | Low | High (owner can revoke instantly) | High (enforced on-chain) |

**SPL delegation is the optimal balance** for non-custodial AI agent wallets:

1. **Non-Custodial**: The owner never shares their private key with the agent. The agent only receives a separate keypair with delegated authority.
2. **Bounded Authority**: The on-chain delegation cap (via `approveChecked`) enforces a maximum spending limit that the agent cannot exceed.
3. **Instant Revocation**: The owner can revoke delegation at any time via a single `revoke` instruction — no coordination required.
4. **Low Latency**: Agent transactions require only the agent's signature, not the owner's. No round-trip communication needed.
5. **Simplicity**: Uses standard SPL Token program instructions (`approveChecked`, `transferChecked`, `revoke`) — no custom contracts required.

### Why Not Multisig?

Multisig wallets provide strong security but introduce operational friction:

- **Coordination overhead**: Every transaction requires 2+ signatures, often requiring real-time owner approval
- **Latency**: Multi-party signing introduces significant delays for autonomous agent operations
- **Complexity**: Requires deploying and managing custom multisig contracts (e.g., Squads Protocol)

For AI agents executing autonomous payments (e.g., paying for API access, content generation, x402 micropayments), the round-trip approval flow breaks the user experience. SPL delegation allows the owner to pre-approve a spending budget, then the agent operates autonomously within that cap.

### Why Not Custodial Key Holding?

Some agent platforms take a custodial approach where the agent holds the owner's private key. This is fundamentally insecure:

- **Single point of failure**: If the agent's server is compromised, the attacker gains full control of the owner's wallet
- **No spending limits**: The agent can drain the entire wallet balance, not just a delegated amount
- **Irreversible**: If the agent is compromised, the owner must migrate all assets to a new wallet — they cannot simply revoke the agent's authority

SPL delegation eliminates this risk: the agent only holds its own keypair (with delegated spending authority), and the owner can revoke that authority instantly if the agent is compromised.

## Security Model: Four Layers of Defense

The SDK implements defense-in-depth with four complementary security layers:

### Layer 1: On-Chain Delegation Cap

The SPL Token program enforces a hard spending limit via the `approveChecked` instruction:

```typescript
const approveInstruction = getApproveCheckedInstruction({
  source: ownerTokenAccount,
  mint: tokenMint,
  delegate: agentPublicKey,
  owner: ownerSigner,
  amount: maxAmount, // Hard cap enforced by SPL Token program
  decimals: decimals, // Validated on-chain to prevent decimal mismatch attacks
});
```

The `approveChecked` instruction (vs. the deprecated `approve`) enforces:
- **Mint validation**: The instruction fails if the provided mint does not match the token account's mint
- **Decimal validation**: The instruction fails if the provided decimals do not match the mint's decimals
- **Amount cap**: The delegate can transfer at most `maxAmount` before the delegation is exhausted

**Security guarantee**: Even if all other layers fail, the on-chain program prevents the agent from spending more than the approved cap.

### Layer 2: Client-Side Budget Tracker

The `BudgetTracker` provides an additional spending cap at the application layer:

```typescript
const budget = createBudgetTracker(10_000_000n); // Local budget cap

const check = await budget.checkBudget(tokenAccount, rpcConfig);
// check.available = min(remainingOnChain, budget - localSpent)

if (check.available >= paymentAmount) {
  const signature = await transferAsDelegate(params, rpcConfig);
  budget.recordSpend(paymentAmount, signature);
}
```

This layer provides:
- **Defense against RPC drift**: If the agent's local state drifts from on-chain state (e.g., due to concurrent transactions from other delegates), the budget tracker prevents overspending based on stale data
- **Audit trail**: All spends are recorded with transaction signatures and timestamps for forensic analysis
- **Concurrent access protection**: A simple lock prevents race conditions during rapid spend sequences

**Security guarantee**: The agent cannot exceed the local budget, even if on-chain state has not yet been updated.

### Layer 3: Encrypted Keypair at Rest

Agent keypairs are encrypted at rest using industry-standard cryptographic primitives:

```typescript
// Encryption: scrypt KDF + AES-256-GCM
const encrypted = encryptKeypair(keypairBytes, passphrase, SCRYPT_PARAMS_PRODUCTION);

// File storage with strict permissions
await writeFile(path, JSON.stringify(encrypted), { mode: 0o600 });
await chmod(path, 0o600); // Owner read/write only
```

**Encryption parameters:**
- **Key derivation**: scrypt with N=2^20 (~1 second derivation time on modern hardware)
- **Cipher**: AES-256-GCM (authenticated encryption with associated data)
- **Salt**: 32-byte random salt per keypair (prevents rainbow table attacks)
- **IV**: 12-byte random initialization vector per encryption (prevents ciphertext patterns)
- **Auth tag**: 16-byte GCM authentication tag (prevents tampering)

**File permissions:**
- **0600 (owner read/write only)**: Validated on load to prevent accidental exposure via group/world-readable permissions
- **Secure delete**: Overwrites file with random data before unlinking (prevents recovery from filesystem slack space)

**Security guarantee**: An attacker who gains filesystem access cannot recover the keypair without the passphrase. The scrypt parameters (N=2^20) make brute-force attacks computationally expensive (~1 second per guess).

### Layer 4: Transaction Simulation Before Execution

All delegated transfers are simulated before submission to catch failures early:

```typescript
// Simulate before sending
const simResult = await rpc.simulateTransaction(encodedTx, { encoding: 'base64' }).send();
if (simResult.value.err) {
  throw new DelegationError(
    DelegationErrorCode.SIMULATION_FAILED,
    `Transaction simulation failed: ${JSON.stringify(simResult.value.err)}`,
  );
}

// Only send if simulation succeeds
await rpc.sendTransaction(encodedTx, { encoding: 'base64' }).send();
```

This catches:
- **Insufficient delegation**: Transaction would fail due to delegation being exhausted or revoked
- **Invalid accounts**: Token accounts do not exist or have wrong mint
- **Insufficient SOL**: Fee payer does not have enough SOL for transaction fees
- **Compute budget exceeded**: Transaction requires more compute units than allocated

**Security guarantee**: The agent never submits a transaction that would fail on-chain, preventing wasted transaction fees and revealing potential bugs before they impact real funds.

## Key Management Architecture

### Keypair Generation

Agent keypairs are generated using cryptographically secure random number generation:

```typescript
const seed = randomBytes(32); // CSPRNG from Node.js crypto module
const signer = await createKeyPairSignerFromPrivateKeyBytes(seed, true);

// Export public key to build 64-byte [seed | pubkey] format
const publicKeyBytes = new Uint8Array(
  await crypto.subtle.exportKey('raw', signer.keyPair.publicKey),
);

const keypairBytes = new Uint8Array(64);
keypairBytes.set(seed, 0);       // Bytes 0-31: secret key
keypairBytes.set(publicKeyBytes, 32); // Bytes 32-63: public key
```

**Security properties:**
- **Entropy source**: `randomBytes()` uses the OS CSPRNG (e.g., `/dev/urandom` on Linux)
- **Key format**: 64-byte keypair compatible with Solana's Ed25519 keypair format
- **Exportability**: Public key is extractable for storage/display

### Encryption Flow

```
                  ┌─────────────┐
                  │  Passphrase │
                  └──────┬──────┘
                         │
                    scrypt KDF
              (N=2²⁰, r=8, p=1, keyLen=32)
                         │
                         v
                  ┌─────────────┐      ┌─────────────┐
                  │ 32-byte Key │      │  32-byte    │
                  │  (derived)  │◄─────┤  Salt       │
                  └──────┬──────┘      └─────────────┘
                         │
                  AES-256-GCM Encrypt
                         │
                         v
         ┌───────────────┴───────────────┐
         │                               │
    ┌────v──────┐                  ┌─────v──────┐
    │ Ciphertext│                  │  Auth Tag  │
    └───────────┘                  └────────────┘
         │                               │
         └───────────┬───────────────────┘
                     v
            EncryptedKeypairFile
      { version, salt, iv, ciphertext, authTag }
```

### Decryption Flow

```
  EncryptedKeypairFile
  { salt, iv, ciphertext, authTag }
         │
         v
    Extract Salt
         │
         v
  ┌─────────────┐
  │  Passphrase │
  └──────┬──────┘
         │
    scrypt KDF
  (same params)
         │
         v
  ┌─────────────┐
  │ 32-byte Key │
  └──────┬──────┘
         │
  AES-256-GCM Decrypt
  (verify auth tag)
         │
         v
  ┌─────────────┐
  │  64-byte    │ ──────> Zero in finally block
  │  Keypair    │
  └─────────────┘
         │
         v
  createKeyPairSignerFromBytes()
         │
         v
  KeyPairSigner (ready for use)
```

### Memory Safety

All cryptographic material is zeroed after use to prevent leakage via memory dumps or swap files:

```typescript
// Encryption
const derivedKey = scryptSync(passphrase, salt, keyLen, { N, r, p });
const cipher = createCipheriv('aes-256-gcm', derivedKey, iv);
// ... use cipher ...
derivedKey.fill(0); // Zero derived key immediately after use

// Decryption
let decryptedBytes: Uint8Array | null = null;
try {
  decryptedBytes = decryptKeypair(encrypted, passphrase, params);
  const signer = await createKeyPairSignerFromBytes(decryptedBytes);
  return signer;
} finally {
  if (decryptedBytes) {
    decryptedBytes.fill(0); // ALWAYS zero, even if error thrown
  }
}

// Generation
const seed = randomBytes(32);
const signer = await createKeyPairSignerFromPrivateKeyBytes(seed, true);
// ... build keypairBytes ...
seed.fill(0); // Zero seed after keypairBytes is built
publicKeyBytes.fill(0); // Zero public key copy
```

**Security guarantee**: Decrypted keypair bytes exist in memory only for the minimum time required to create the `KeyPairSigner`, then are zeroed to prevent recovery via memory forensics.

### File Permissions

Encrypted keypairs are stored with strict UNIX permissions:

```typescript
// Write with 0600 permissions (owner read/write only)
await writeFile(outputPath, JSON.stringify(encrypted), { mode: 0o600 });
await chmod(outputPath, 0o600); // Double-check (in case umask interfered)

// Read with permission validation
const fileStat = await stat(filePath);
const mode = fileStat.mode & 0o777;
if (mode !== 0o600) {
  throw new DelegationError(
    DelegationErrorCode.INVALID_PERMISSIONS,
    `Insecure file permissions on ${filePath}: expected 0600, got ${mode.toString(8)}`,
  );
}
```

**Permission bits (0600 = rw-------)**:
- Owner: read + write
- Group: no access
- World: no access

This prevents accidental exposure via shared directories or misconfigured system services.

### Secure Deletion

When deleting keypairs, the SDK overwrites the file with random data before unlinking:

```typescript
export async function secureDelete(filePath: string): Promise<void> {
  const fileStat = await stat(filePath);
  const randomData = randomBytes(fileStat.size); // Overwrite with random data
  await writeFile(filePath, randomData);         // Write random bytes to disk
  await unlink(filePath);                        // Delete file
}
```

This prevents recovery via filesystem forensics (e.g., `extundelete` on ext4) by ensuring the original ciphertext is not recoverable from unallocated disk blocks.

## Testing Approach

The SDK test suite uses Vitest 4 with mocked RPC clients to achieve fast, deterministic tests:

### Unit Tests with Mocked RPC

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createDelegation, checkDelegation, transferAsDelegate } from '../src/delegate.js';

// Mock @solana/kit RPC client
vi.mock('@solana/kit', async () => {
  const actual = await vi.importActual('@solana/kit');
  return {
    ...actual,
    createSolanaRpc: vi.fn(() => ({
      getLatestBlockhash: vi.fn(() => ({
        send: vi.fn(async () => ({
          value: { blockhash: 'mock-blockhash', lastValidBlockHeight: 1000n },
        })),
      })),
      simulateTransaction: vi.fn(() => ({
        send: vi.fn(async () => ({ value: { err: null } })),
      })),
      sendTransaction: vi.fn(() => ({
        send: vi.fn(async () => 'mock-signature'),
      })),
    })),
  };
});
```

### Vitest 4 Constructor Mock Pattern

Vitest 4 requires function-style constructors (not arrow functions) for classes:

```typescript
// CORRECT: Function-style mock
const MockMemoryClient = vi.fn(function() {
  return {
    add: vi.fn(async () => ({ id: 'mock-id' })),
    search: vi.fn(async () => ({ results: [] })),
  };
});

// WRONG: Arrow function (cannot be used as constructor)
const MockMemoryClient = vi.fn(() => ({
  add: vi.fn(async () => ({ id: 'mock-id' })),
}));
```

### Test Coverage Targets

The SDK maintains high test coverage across all modules:

- **delegate.ts**: 100% (all delegation/transfer/revocation paths)
- **budget.ts**: 100% (budget tracking, concurrent access protection)
- **keypair.ts**: 97.9% (encryption, decryption, file I/O, secure delete)
- **types.ts**: 100% (error codes, validation helpers)

**Coverage achieved: 97.9% overall (42 tests across 4 test files)**

### Test Execution

```bash
pnpm test                      # Run all tests
pnpm test:watch               # Watch mode for TDD
pnpm test:coverage            # Generate coverage report
```

Test files mirror source structure:

```
packages/agent-wallet-sdk/
├── src/
│   ├── delegate.ts
│   ├── budget.ts
│   ├── keypair.ts
│   └── types.ts
└── test/
    ├── delegate.test.ts
    ├── budget.test.ts
    ├── keypair.test.ts
    └── types.test.ts
```

### Integration Testing Philosophy

The SDK prioritizes unit tests over integration tests because:

1. **Determinism**: Mocked RPC responses are predictable; devnet RPC is not
2. **Speed**: Unit tests run in milliseconds; integration tests require network round-trips
3. **Cost**: Integration tests consume devnet SOL; unit tests are free
4. **Reliability**: Unit tests never fail due to RPC downtime or network issues

**Integration tests are deferred to the consuming application** (e.g., ozskr.ai's E2E test suite), where the SDK is tested against a real Solana network as part of the full payment flow.

## Design Principles

### 1. Minimize Trust Surface

The SDK never requires the owner to trust the agent with full wallet access:

- Agent holds only a delegated keypair (not the owner's keys)
- Delegation is bounded by an on-chain spending cap
- Owner can revoke delegation at any time without agent cooperation

### 2. Defense-in-Depth

Security relies on multiple independent layers:

- On-chain delegation cap (enforced by SPL Token program)
- Client-side budget tracking (enforced by application code)
- Encrypted keypair storage (enforced by filesystem + passphrase)
- Transaction simulation (enforced before every submit)

If any single layer fails, the others still provide protection.

### 3. Fail-Safe Defaults

The SDK chooses safe defaults at every decision point:

- `approveChecked` (not `approve`) to enforce mint/decimal validation
- `transferChecked` (not `transfer`) to prevent decimal mismatch attacks
- Transaction simulation before submission (not blind send)
- File permissions validated on load (not assumed correct)
- Memory zeroed in finally blocks (not just in success path)

### 4. Explicit Over Implicit

The SDK requires callers to be explicit about security-critical operations:

- `storeEncryptedKeypair()` requires `force=true` to overwrite existing files (prevents accidental key loss)
- `loadEncryptedKeypair()` validates file permissions explicitly (prevents accidental exposure)
- `recordSpend()` requires transaction signature (enforces audit trail)

### 5. Zero Configuration for Common Paths

Common operations require minimal boilerplate:

```typescript
// Minimal delegation setup
const tx = await createDelegation(config, rpcConfig);

// Minimal transfer
const sig = await transferAsDelegate(params, rpcConfig);

// Minimal budget tracking
const budget = createBudgetTracker(10_000_000n);
await budget.checkBudget(tokenAccount, rpcConfig);
```

Advanced options (custom scrypt params, force-overwrite, etc.) are available but optional.

## Future Considerations

### Multi-Token Delegation

The current SDK supports one delegation per token account. A future version could support multiple simultaneous delegations (e.g., one agent for content payments, another for trading):

```typescript
const contentAgent = await createDelegation({
  delegateAddress: contentAgentPubkey,
  maxAmount: 5_000_000n, // 5 USDC for content
});

const tradingAgent = await createDelegation({
  delegateAddress: tradingAgentPubkey,
  maxAmount: 10_000_000n, // 10 USDC for trading
});
```

**Challenge**: The SPL Token program only supports one active delegation per token account. Multi-delegation would require multiple token accounts (one per agent) with fund splitting logic.

### Time-Bounded Delegation

Future versions could add time-based expiration to delegations:

```typescript
const tx = await createDelegation({
  maxAmount: 10_000_000n,
  expiresAt: Date.now() + 86400_000, // 24 hours
});
```

**Challenge**: The SPL Token program does not natively support time-based delegation expiration. This would require a custom wrapper contract or off-chain enforcement (e.g., agent checks expiration time before each transfer).

### Hardware Security Module (HSM) Support

For high-value delegations, agent keypairs could be stored in HSM hardware rather than encrypted files:

```typescript
const signer = await loadKeypairFromHSM({
  hsmEndpoint: 'pkcs11://...',
  keyId: 'agent-keypair-001',
});
```

This would provide stronger physical security but increase operational complexity and cost.

### Delegation Audit Events

Future versions could emit structured audit events for all delegation operations:

```typescript
const events = new DelegationEventEmitter();

events.on('delegation_created', (event) => {
  console.log(`Created delegation: ${event.delegate} for ${event.maxAmount}`);
});

events.on('transfer_executed', (event) => {
  console.log(`Transfer: ${event.amount} to ${event.destination}, sig: ${event.signature}`);
});

events.on('delegation_revoked', (event) => {
  console.log(`Revoked delegation for ${event.tokenAccount}`);
});
```

This would enable centralized logging, alerting, and compliance reporting for production deployments.

---

**Version**: 1.0.0
**Last Updated**: 2026-02-14
**Status**: Beta (production-ready, pending external audit)
