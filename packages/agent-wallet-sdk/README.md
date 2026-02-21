# @ozskr/agent-wallet-sdk

[![npm version](https://img.shields.io/npm/v/@ozskr/agent-wallet-sdk)](https://npmjs.com/package/@ozskr/agent-wallet-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-brightgreen)](https://nodejs.org)
[![Built with Claude Code](https://img.shields.io/badge/Built_with-Claude_Code-D4A574?logo=anthropic)](https://claude.com/claude-code)

Non-custodial AI agent wallets on Solana. Enables AI agents to execute on-chain payments via SPL token delegation without holding owner private keys.

**Status**: Beta (`0.1.2-beta`)
**License**: MIT
**Requires**: Node.js 20+

## What It Does

This SDK provides three core capabilities for building AI agents that can spend tokens on Solana:

1. **SPL Token Delegation**: Agents receive bounded spending authority via `approveChecked` — the owner retains custody of their keys
2. **Client-Side Budget Tracking**: Defense-in-depth spending caps combining on-chain delegation with local budget tracking
3. **Encrypted Keypair Storage**: Agent keypairs are encrypted at rest using scrypt KDF + AES-256-GCM, with secure file permissions (0600)

The agent never holds the owner's private keys. The owner can revoke delegation at any time.

## Installation

```bash
npm install @ozskr/agent-wallet-sdk @solana/kit
```

Peer dependencies:
- `@solana/kit` ^2.1.0
- `@solana-program/token` ^0.4.11

## Quickstart

```typescript
import { createDelegation, transferAsDelegate } from '@ozskr/agent-wallet-sdk';
import { address } from '@solana/kit';

// 1. Owner creates delegation for agent
const delegationTx = await createDelegation(
  {
    ownerTokenAccount: address('...'),
    ownerSigner: walletSigner,
    delegateAddress: agentPublicKey,
    tokenMint: address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // USDC
    maxAmount: 10_000_000n, // 10 USDC
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

## API Reference

### Delegation

#### `createDelegation(config, rpcConfig)`

Builds an SPL `approveChecked` transaction message that grants an agent delegate authority to spend tokens from the owner's token account.

**Parameters:**
- `config: DelegationConfig`
  - `ownerTokenAccount: Address` - Owner's SPL token account
  - `ownerSigner: TransactionSigner` - Owner wallet (signs the approval)
  - `delegateAddress: Address` - Agent's public key
  - `tokenMint: Address` - SPL token mint (USDC, $HOPE, etc.)
  - `maxAmount: bigint` - Spending cap in base units (e.g. 1_000_000 = 1 USDC)
  - `decimals: number` - Token decimals (must match mint)
- `rpcConfig: RpcConfig`
  - `endpoint: string` - Solana RPC endpoint URL

**Returns:** `Promise<CompilableTransactionMessage>` - Ready for signing

**Security:** Uses `approveChecked` (not `approve`) to enforce mint and decimal validation on-chain.

---

#### `checkDelegation(tokenAccount, rpcConfig)`

Queries the on-chain state of an SPL token account to determine the current delegation status.

**Parameters:**
- `tokenAccount: Address` - Owner's SPL token account
- `rpcConfig: RpcConfig`

**Returns:** `Promise<DelegationStatus>`
- `isActive: boolean` - Whether delegation is currently active
- `delegate: Address | null` - Agent's address (null if no delegation)
- `remainingAmount: bigint` - Remaining delegated amount from on-chain state
- `originalAmount: bigint` - Original delegation amount
- `tokenMint: Address` - The SPL token mint
- `ownerTokenAccount: Address` - The owner's token account

---

#### `transferAsDelegate(params, rpcConfig)`

Builds, signs, simulates, and submits a `transferChecked` transaction where the agent keypair acts as the delegate authority.

**Parameters:**
- `params: TransferAsDelegateParams`
  - `delegateSigner: TransactionSigner` - Agent's keypair signer
  - `sourceTokenAccount: Address` - Owner's token account (source of funds)
  - `destinationTokenAccount: Address` - Recipient's token account
  - `amount: bigint` - Amount to transfer in base units
  - `decimals: number` - Token decimals (must match mint)
  - `tokenMint: Address` - SPL token mint address
  - `feePayer: TransactionSigner` - Transaction fee payer (typically agent)
- `rpcConfig: RpcConfig`

**Returns:** `Promise<string>` - Transaction signature after successful submission

**Throws:**
- `DelegationError(INSUFFICIENT_DELEGATION)` if amount exceeds remaining delegation
- `DelegationError(NO_ACTIVE_DELEGATION)` if no delegation exists
- `DelegationError(SIMULATION_FAILED)` if transaction simulation fails

**Security:** Checks on-chain delegation status before building the transaction, simulates before submission.

---

#### `revokeDelegation(params, rpcConfig)`

Builds an SPL `revoke` transaction message that removes all delegate authority from the owner's token account.

**Parameters:**
- `params: RevokeDelegationParams`
  - `ownerSigner: TransactionSigner` - Owner who revokes the delegation
  - `tokenAccount: Address` - Token account to revoke delegation on
- `rpcConfig: RpcConfig`

**Returns:** `Promise<CompilableTransactionMessage>` - Ready for signing

---

### Budget Tracking

#### `createBudgetTracker(initialBudget)`

Creates a client-side budget tracker that combines on-chain delegation state with local spend tracking for defense-in-depth validation.

**Parameters:**
- `initialBudget: bigint` - Maximum spending cap in base units (should match on-chain delegation)

**Returns:** `BudgetTracker` instance

**Throws:**
- `DelegationError(INVALID_AMOUNT)` if initialBudget <= 0

---

#### `BudgetTracker` Interface

##### `checkBudget(tokenAccount, rpcConfig): Promise<BudgetCheckResult>`

Queries on-chain delegation state and combines with local spend tracking.

**Returns:** `BudgetCheckResult`
- `remainingOnChain: bigint` - Remaining delegation from RPC query
- `spent: bigint` - Total amount spent according to local tracking
- `available: bigint` - Available to spend: `min(remainingOnChain, budget - spent)`

##### `recordSpend(amount, signature): void`

Records a successful spend against the local budget tracker. Call this AFTER a transaction has been confirmed on-chain.

**Parameters:**
- `amount: bigint` - Amount spent in base units
- `signature: string` - On-chain transaction signature for audit trail

**Throws:**
- `DelegationError(BUDGET_EXCEEDED)` if recording would exceed initial budget
- `DelegationError(INVALID_AMOUNT)` if amount <= 0

##### `reset(): void`

Resets the local spend tracker. Useful when a new delegation is created or when re-syncing with on-chain state.

##### `getSpendHistory(): ReadonlyArray<SpendRecord>`

Returns all recorded spend events for audit/logging.

**Returns:** Array of `SpendRecord`
- `amount: bigint` - Amount spent
- `signature: string` - Transaction signature
- `timestamp: string` - ISO 8601 timestamp

##### `getTotalSpent(): bigint`

Returns the total amount spent according to local tracking.

##### `getInitialBudget(): bigint`

Returns the initial budget cap this tracker was created with.

---

### Keypair Management

#### `generateAgentKeypair()`

Generates a new agent keypair using a CSPRNG seed.

**Returns:** `Promise<KeypairGenerationResult>`
- `signer: KeyPairSigner` - For signing transactions
- `keypairBytes: Uint8Array` - Raw 64-byte keypair (32-byte secret + 32-byte public). **Caller MUST zero after use.**

---

#### `encryptKeypair(keypairBytes, passphrase, params?)`

Encrypts a 64-byte keypair using scrypt KDF + AES-256-GCM.

**Parameters:**
- `keypairBytes: Uint8Array` - Raw 64-byte keypair
- `passphrase: string` - Encryption passphrase (minimum 12 characters)
- `params?: ScryptParams` - Scrypt parameters (defaults to `SCRYPT_PARAMS_PRODUCTION`)

**Returns:** `EncryptedKeypairFile`
- `version: 1` - File format version
- `salt: string` - Base64-encoded scrypt salt (32 bytes)
- `iv: string` - Base64-encoded AES-GCM IV (12 bytes)
- `ciphertext: string` - Base64-encoded encrypted keypair
- `authTag: string` - Base64-encoded AES-GCM auth tag (16 bytes)

**Throws:**
- `DelegationError(INVALID_KEYPAIR_FORMAT)` if keypair is not 64 bytes or passphrase < 12 characters

---

#### `decryptKeypair(encrypted, passphrase, params?)`

Decrypts an encrypted keypair file back to raw 64-byte keypair.

**Parameters:**
- `encrypted: EncryptedKeypairFile` - Encrypted keypair structure
- `passphrase: string` - Decryption passphrase
- `params?: ScryptParams` - Scrypt parameters (must match encryption params)

**Returns:** `Uint8Array` - Raw 64-byte keypair. **Caller MUST zero after use.**

**Throws:**
- `DelegationError(DECRYPTION_FAILED)` if wrong passphrase or corrupted data
- `DelegationError(INVALID_KEYPAIR_FORMAT)` if unsupported version

---

#### `storeEncryptedKeypair(keypairBytes, passphrase, outputPath, force?, params?)`

Encrypts and stores an agent keypair to disk with 0600 permissions.

**Parameters:**
- `keypairBytes: Uint8Array` - Raw 64-byte keypair
- `passphrase: string` - Encryption passphrase (minimum 12 characters)
- `outputPath: string` - File path for the encrypted keypair
- `force?: boolean` - Overwrite existing file if true (default: false)
- `params?: ScryptParams` - Scrypt parameters (defaults to `SCRYPT_PARAMS_PRODUCTION`)

**Throws:**
- `DelegationError(KEYPAIR_EXISTS)` if file exists and force is false

---

#### `loadEncryptedKeypair(filePath, passphrase, params?)`

Loads and decrypts an agent keypair from disk, returning a KeyPairSigner. Validates file permissions (must be 0600) before reading.

**Parameters:**
- `filePath: string` - Path to the encrypted keypair file
- `passphrase: string` - Decryption passphrase
- `params?: ScryptParams` - Scrypt parameters (must match encryption params)

**Returns:** `Promise<KeyPairSigner>` - For signing transactions

**Throws:**
- `DelegationError(KEYPAIR_NOT_FOUND)` if file does not exist
- `DelegationError(INVALID_PERMISSIONS)` if file permissions are not 0600
- `DelegationError(DECRYPTION_FAILED)` if wrong passphrase or corrupted data

---

#### `secureDelete(filePath)`

Securely deletes a file by overwriting with random data before unlinking. Does not throw if the file does not exist.

**Parameters:**
- `filePath: string` - Path to the file to securely delete

---

### Key Management (Pluggable)

#### `KeyManager` Interface

Pluggable key management abstraction. Use `EncryptedJsonKeyManager` for development and implement the interface with Turnkey, Privy, or Fireblocks for production.

```typescript
interface KeyManager {
  getPublicKey(): Promise<Address>;
  signTransaction(transactionMessage: Uint8Array): Promise<Uint8Array>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  healthCheck(): Promise<{ healthy: boolean; provider: string }>;
}
```

---

#### `createKeyManager(config)`

Factory function that creates a `KeyManager` instance from configuration.

**Parameters:**
- `config: KeyManagerConfig`
  - `provider: 'encrypted-json' | 'turnkey' | 'privy' | 'custom'` - Key management provider
  - `options: Record<string, unknown>` - Provider-specific configuration

**Returns:** `KeyManager` instance

**Example:**

```typescript
import { createKeyManager, SCRYPT_PARAMS_FAST } from '@ozskr/agent-wallet-sdk';

const keyManager = createKeyManager({
  provider: 'encrypted-json',
  options: {
    filePath: './agent-keypair.json',
    passphrase: 'my-secure-passphrase-123',
    scryptParams: SCRYPT_PARAMS_FAST,
  },
});

const address = await keyManager.getPublicKey();
const health = await keyManager.healthCheck();
```

**Production providers**: Implement the `KeyManager` interface with your preferred key management service. The SDK ships with `encrypted-json` and `turnkey` built-in — other providers (Privy, Fireblocks) are left to the consumer.

---

#### `TurnkeyKeyManager`

Built-in `KeyManager` implementation backed by [Turnkey](https://turnkey.com) (AWS Nitro Enclave-based TEE). Agent keypairs are stored in hardware-isolated enclaves — the platform cannot extract private keys.

```typescript
import { TurnkeyKeyManager } from '@ozskr/agent-wallet-sdk';

const km = new TurnkeyKeyManager({
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  organizationId: process.env.TURNKEY_ORG_ID,
  privateKeyId: process.env.TURNKEY_PRIVATE_KEY_ID,
});

const pubkey = await km.getPublicKey();
const health = await km.healthCheck(); // { healthy: true, provider: 'turnkey' }
```

---

#### `createTurnkeyWallet(config)`

Helper that creates a new Turnkey wallet and returns the public key and private key ID for use with `TurnkeyKeyManager`.

**Parameters:**
- `config: CreateTurnkeyWalletOptions`
  - `apiPublicKey: string` - Turnkey API public key
  - `apiPrivateKey: string` - Turnkey API private key
  - `organizationId: string` - Turnkey organization ID
  - `walletName: string` - Human-readable wallet name

**Returns:** `Promise<TurnkeyWalletResult>`
- `privateKeyId: string` - Turnkey private key ID (use with `TurnkeyKeyManager`)
- `publicKey: string` - Solana address (base58)

---

#### `EncryptedJsonKeyManager`

Built-in `KeyManager` implementation that wraps the existing encrypted keypair storage (scrypt KDF + AES-256-GCM).

```typescript
import { EncryptedJsonKeyManager } from '@ozskr/agent-wallet-sdk';

const km = new EncryptedJsonKeyManager(
  './agent-keypair.json',
  'my-secure-passphrase-123',
);

const pubkey = await km.getPublicKey();
const sig = await km.signTransaction(txBytes);
const health = await km.healthCheck(); // { healthy: true, provider: 'encrypted-json' }
```

---

### Token Validation

#### `validateTokenMint(actualMint, expectedMint)`

Validates that a token mint address matches the expected mint. Prevents spoofed token attacks where a fake mint is substituted for the real one.

**Parameters:**
- `actualMint: Address` - The mint address from the payment/transaction
- `expectedMint: Address` - The known-good mint address (e.g., `USDC_MINT_MAINNET`)

**Throws:** `DelegationError(INVALID_ADDRESS)` if mints don't match

**Example:**

```typescript
import { validateTokenMint, USDC_MINT_MAINNET } from '@ozskr/agent-wallet-sdk';

// Throws if mintFromPayment !== USDC_MINT_MAINNET
validateTokenMint(mintFromPayment, USDC_MINT_MAINNET);
```

---

### Constants

#### `USDC_MINT_MAINNET`

Official USDC mint address on Solana mainnet-beta (Token Program, NOT Token-2022).

```typescript
address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
```

#### `USDC_DECIMALS`

USDC decimal places: `6`

#### `TOKEN_PROGRAM_ID`

SPL Token Program ID: `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`

#### `TOKEN_2022_PROGRAM_ID`

SPL Token-2022 Program ID: `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`

---

#### `SCRYPT_PARAMS_PRODUCTION`

Production scrypt parameters for key derivation. N=2^20 (~1 second derivation).

```typescript
{
  N: 2 ** 20,
  r: 8,
  p: 1,
  keyLen: 32,
}
```

#### `SCRYPT_PARAMS_FAST`

Fast scrypt parameters for tests. N=2^14 (~64x faster than production).

```typescript
{
  N: 2 ** 14,
  r: 8,
  p: 1,
  keyLen: 32,
}
```

---

### Error Handling

#### `DelegationError`

Structured error class for all SDK operations.

**Properties:**
- `code: DelegationErrorCode` - Structured error code
- `message: string` - Human-readable error message
- `name: 'DelegationError'`

#### `DelegationErrorCode` Enum

```typescript
enum DelegationErrorCode {
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INSUFFICIENT_DELEGATION = 'INSUFFICIENT_DELEGATION',
  NO_ACTIVE_DELEGATION = 'NO_ACTIVE_DELEGATION',
  SIMULATION_FAILED = 'SIMULATION_FAILED',
  RPC_ERROR = 'RPC_ERROR',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_DECIMALS = 'INVALID_DECIMALS',
  KEYPAIR_EXISTS = 'KEYPAIR_EXISTS',
  KEYPAIR_NOT_FOUND = 'KEYPAIR_NOT_FOUND',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  INVALID_PERMISSIONS = 'INVALID_PERMISSIONS',
  INVALID_KEYPAIR_FORMAT = 'INVALID_KEYPAIR_FORMAT',
}
```

**Example:**

```typescript
import { transferAsDelegate, DelegationError, DelegationErrorCode } from '@ozskr/agent-wallet-sdk';

try {
  await transferAsDelegate(params, rpcConfig);
} catch (error) {
  if (error instanceof DelegationError) {
    if (error.code === DelegationErrorCode.INSUFFICIENT_DELEGATION) {
      console.error('Not enough delegation remaining');
    }
  }
}
```

## Security Model

### Delegation Approach

The SDK uses SPL token delegation (`approveChecked`/`transferChecked`) to grant AI agents bounded spending authority without exposing owner private keys:

1. **Owner retains custody**: The agent never holds the owner's private keys
2. **Bounded spending**: On-chain delegation cap enforced by SPL Token program
3. **Revocable**: Owner can revoke delegation at any time via `revoke` instruction
4. **Defense-in-depth**: Client-side budget tracking provides an additional spending cap layer

### Encrypted Keypair Storage

Agent keypairs are encrypted at rest using industry-standard cryptographic primitives:

- **Key derivation**: scrypt KDF with production parameters (N=2^20, r=8, p=1)
- **Encryption**: AES-256-GCM (authenticated encryption)
- **File permissions**: 0600 (owner read/write only) enforced via `chmod`
- **Memory safety**: Decrypted keypair bytes are zeroed in finally blocks after use
- **Secure deletion**: `secureDelete()` overwrites files with random data before unlinking

### Transaction Validation

All delegated transfers follow a strict validation flow:

1. **Address validation**: All addresses validated via `assertIsAddress` before RPC calls
2. **Delegation check**: On-chain delegation status queried before building transaction
3. **Amount validation**: Transfer amount checked against remaining delegation
4. **Simulation**: Transaction simulated before submission to catch failures early
5. **Budget tracking**: Client-side budget tracker provides additional spending cap validation

## Full Example: Delegation Lifecycle

```typescript
import {
  generateAgentKeypair,
  storeEncryptedKeypair,
  loadEncryptedKeypair,
  createDelegation,
  checkDelegation,
  createBudgetTracker,
  transferAsDelegate,
  revokeDelegation,
} from '@ozskr/agent-wallet-sdk';
import { address, signTransactionMessageWithSigners, getBase64EncodedWireTransaction } from '@solana/kit';

const RPC_CONFIG = { endpoint: 'https://api.devnet.solana.com' };
const PASSPHRASE = 'my-secure-passphrase-123';

// 1. Generate and store agent keypair
const { signer: agentSigner, keypairBytes } = await generateAgentKeypair();
await storeEncryptedKeypair(
  keypairBytes,
  PASSPHRASE,
  '/path/to/agent-keypair.json',
);
keypairBytes.fill(0); // Zero memory after storage

// 2. Owner creates delegation
const delegationTx = await createDelegation(
  {
    ownerTokenAccount: address('YOUR_OWNER_TOKEN_ACCOUNT'),
    ownerSigner: walletSigner,
    delegateAddress: agentSigner.address,
    tokenMint: address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // USDC
    maxAmount: 10_000_000n, // 10 USDC
    decimals: 6,
  },
  RPC_CONFIG,
);

// Sign and submit delegation transaction
const signedDelegationTx = await signTransactionMessageWithSigners(delegationTx);
const encodedDelegationTx = getBase64EncodedWireTransaction(signedDelegationTx);
await rpc.sendTransaction(encodedDelegationTx, { encoding: 'base64' }).send();

// 3. Check delegation status
const status = await checkDelegation(
  address('YOUR_OWNER_TOKEN_ACCOUNT'),
  RPC_CONFIG,
);
console.log(`Delegation active: ${status.isActive}, remaining: ${status.remainingAmount}`);

// 4. Create budget tracker
const budget = createBudgetTracker(10_000_000n);

// 5. Agent executes payment
const budgetCheck = await budget.checkBudget(
  address('YOUR_OWNER_TOKEN_ACCOUNT'),
  RPC_CONFIG,
);

if (budgetCheck.available >= 1_000_000n) {
  const signature = await transferAsDelegate(
    {
      delegateSigner: agentSigner,
      sourceTokenAccount: address('YOUR_OWNER_TOKEN_ACCOUNT'),
      destinationTokenAccount: address('RECIPIENT_TOKEN_ACCOUNT'),
      amount: 1_000_000n, // 1 USDC
      decimals: 6,
      tokenMint: address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
      feePayer: agentSigner,
    },
    RPC_CONFIG,
  );

  // Record spend for local tracking
  budget.recordSpend(1_000_000n, signature);
  console.log(`Payment sent: ${signature}`);
}

// 6. Owner revokes delegation
const revokeTx = await revokeDelegation(
  {
    ownerSigner: walletSigner,
    tokenAccount: address('YOUR_OWNER_TOKEN_ACCOUNT'),
  },
  RPC_CONFIG,
);

const signedRevokeTx = await signTransactionMessageWithSigners(revokeTx);
const encodedRevokeTx = getBase64EncodedWireTransaction(signedRevokeTx);
await rpc.sendTransaction(encodedRevokeTx, { encoding: 'base64' }).send();

// 7. Load agent keypair on next session
const loadedSigner = await loadEncryptedKeypair(
  '/path/to/agent-keypair.json',
  PASSPHRASE,
);
```

## Development

```bash
# Clone the repo
git clone https://github.com/daftpixie/ozskr.git
cd ozskr

# Install dependencies
pnpm install

# Build this package
cd packages/agent-wallet-sdk
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

## Legal & Compliance

This software is provided "as-is" without warranty. Users are responsible for:

- **Regulatory compliance**: OFAC/SDN screening, FinCEN MSB determination, and applicable money transmission regulations in your jurisdiction
- **Token delegation risks**: SPL token delegation grants spending authority to agent keypairs — ensure proper key management and access controls
- **Mainnet use**: All transactions on Solana mainnet-beta are irreversible — audit delegation amounts and test on devnet first
- **Key management**: Agent keypairs encrypted at rest are only as secure as the passphrase — use strong, unique passphrases and never commit keypair files to version control

This package does NOT provide legal, financial, or compliance advice. Consult qualified legal counsel before deploying in production.

## Related Packages

- [`@ozskr/x402-solana-mcp`](https://npmjs.com/package/@ozskr/x402-solana-mcp) — MCP server for AI agent x402 payments on Solana (uses this SDK)
- [`@ozskr/x402-facilitator`](https://npmjs.com/package/@ozskr/x402-facilitator) — Self-hosted x402 payment facilitator with governance hooks (uses this SDK)

**Repository**: https://github.com/daftpixie/ozskr

## License

MIT -- Copyright (c) 2026 VT Infinite, Inc

ozskr.ai is developed and maintained by VT Infinite, Inc.
