/**
 * Shared types for the agent delegation subsystem.
 * All on-chain addresses use @solana/kit Address branded strings.
 * All token amounts are bigint — never floating point.
 */

import {
  address,
  type Address,
} from '@solana/kit';
import type { TransactionMessage, TransactionMessageWithBlockhashLifetime } from '@solana/kit';

// =============================================================================
// PROGRAM IDs
// =============================================================================

/**
 * SPL Token Program (classic, 2020).
 * Only this program is supported — Token-2022 is rejected at the validation layer.
 */
export const TOKEN_PROGRAM_ID = address(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
) as Address<'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'>;

/**
 * Token-2022 Program address — used only for detection/rejection.
 */
export const TOKEN_2022_PROGRAM_ID = address(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
) as Address<'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'>;

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Parameters for creating an agent delegation account.
 * All amounts are in base token units (bigint).
 */
export interface AgentDelegationConfig {
  /** User's wallet address (fee payer, token account owner). */
  userWallet: Address;
  /** Agent's public key that will receive delegate authority. */
  agentPubkey: Address;
  /** SPL token mint address. */
  tokenMint: Address;
  /** Spending cap in base token units. */
  amount: bigint;
  /** Token decimals (must match on-chain mint). */
  decimals: number;
  /** Character / agent identifier — used as PDA seed. */
  characterId: string;
}

/**
 * On-chain state of an agent's token account delegation.
 * Returned by checkAgentDelegation.
 */
export interface AgentDelegationStatus {
  /** Whether a delegation is currently active on-chain. */
  isActive: boolean;
  /** Current delegate address, or null if not delegated. */
  delegate: Address | null;
  /** Remaining delegated amount in base units (on-chain delegatedAmount). */
  remainingAmount: bigint;
  /** Current token balance in base units. */
  balance: bigint;
  /** SPL token mint for this account. */
  tokenMint: Address;
  /** Token account address that was queried. */
  tokenAccount: Address;
  /** Owning program ID (should always be TOKEN_PROGRAM_ID). */
  programId: Address;
}

/**
 * Result of creating (or deriving) an agent token account.
 * The transaction is unsigned and must be signed before submission.
 */
export interface CreateAgentAccountResult {
  /** Derived PDA address for the agent token account. */
  tokenAccountAddress: Address;
  /** Bump seed used to derive the PDA. */
  bump: number;
  /** Unsigned transaction message, ready for wallet signing. */
  transaction: TransactionMessage & TransactionMessageWithBlockhashLifetime;
}
