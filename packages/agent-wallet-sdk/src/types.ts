import type { Address, TransactionSigner } from '@solana/kit';

// ---------------------------------------------------------------------------
// Delegation Configuration
// ---------------------------------------------------------------------------

/** Configuration for creating an SPL token delegation from owner to agent. */
export interface DelegationConfig {
  /** The owner's SPL token account that will delegate spending authority. */
  ownerTokenAccount: Address;
  /** The owner (wallet) who signs the approval transaction. */
  ownerSigner: TransactionSigner;
  /** The agent's public key that will receive delegated spending authority. */
  delegateAddress: Address;
  /** The SPL token mint (USDC, $HOPE, etc.). */
  tokenMint: Address;
  /** Maximum spending cap in base units (e.g. 1_000_000 = 1 USDC). */
  maxAmount: bigint;
  /** Token decimals — must match the mint (6 for USDC). */
  decimals: number;
}

// ---------------------------------------------------------------------------
// Delegation Status
// ---------------------------------------------------------------------------

/** Current on-chain state of an SPL token delegation. */
export interface DelegationStatus {
  /** Whether a delegation is currently active on-chain. */
  isActive: boolean;
  /** The delegate's address (agent public key). Empty string if no delegation. */
  delegate: Address | null;
  /** Remaining delegated amount in base units (from on-chain state). */
  remainingAmount: bigint;
  /** The original delegation amount (from on-chain state at time of approval). */
  originalAmount: bigint;
  /** The SPL token mint for this delegation. */
  tokenMint: Address;
  /** The owner's token account address. */
  ownerTokenAccount: Address;
}

// ---------------------------------------------------------------------------
// Transfer Parameters
// ---------------------------------------------------------------------------

/** Parameters for executing a delegated transfer (agent spends on owner's behalf). */
export interface TransferAsDelegateParams {
  /** The agent's signer (keypair) with delegated authority. */
  delegateSigner: TransactionSigner;
  /** The owner's token account (source of funds). */
  sourceTokenAccount: Address;
  /** The recipient's token account. */
  destinationTokenAccount: Address;
  /** Amount to transfer in base units. */
  amount: bigint;
  /** Token decimals — must match the mint. */
  decimals: number;
  /** The SPL token mint address. */
  tokenMint: Address;
  /** Fee payer for the transaction (typically the agent signer). */
  feePayer: TransactionSigner;
}

// ---------------------------------------------------------------------------
// Revocation Parameters
// ---------------------------------------------------------------------------

/** Parameters for revoking an agent's delegation (owner revokes). */
export interface RevokeDelegationParams {
  /** The owner who revokes the delegation. */
  ownerSigner: TransactionSigner;
  /** The token account to revoke delegation on. */
  tokenAccount: Address;
}

// ---------------------------------------------------------------------------
// Budget Tracking
// ---------------------------------------------------------------------------

/** Result of a budget check combining on-chain and local state. */
export interface BudgetCheckResult {
  /** Remaining delegation amount from on-chain RPC query. */
  remainingOnChain: bigint;
  /** Total amount spent according to local tracking. */
  spent: bigint;
  /** Available to spend: min(remainingOnChain, budget - spent). */
  available: bigint;
}

/** Record of a single spend event for local tracking. */
export interface SpendRecord {
  /** Amount spent in base units. */
  amount: bigint;
  /** On-chain transaction signature. */
  signature: string;
  /** Timestamp of the spend event (ISO 8601). */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// RPC Configuration
// ---------------------------------------------------------------------------

/** Configuration for RPC connection used by the SDK. */
export interface RpcConfig {
  /** Solana RPC endpoint URL. */
  endpoint: string;
}

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

/** A built transaction message ready for signing/submission. */
export interface UnsignedTransactionResult {
  /** The unsigned transaction message. Caller must sign before submission. */
  transactionMessage: unknown;
}

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

/** Error codes for structured error handling across the SDK. */
export enum DelegationErrorCode {
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INSUFFICIENT_DELEGATION = 'INSUFFICIENT_DELEGATION',
  NO_ACTIVE_DELEGATION = 'NO_ACTIVE_DELEGATION',
  SIMULATION_FAILED = 'SIMULATION_FAILED',
  RPC_ERROR = 'RPC_ERROR',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_DECIMALS = 'INVALID_DECIMALS',
}

/** Structured error class for delegation operations. */
export class DelegationError extends Error {
  readonly code: DelegationErrorCode;

  constructor(code: DelegationErrorCode, message: string) {
    super(message);
    this.name = 'DelegationError';
    this.code = code;
  }
}
