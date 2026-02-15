import type { Address } from '@solana/kit';
import { DelegationError, DelegationErrorCode } from './types.js';

/**
 * Validates that a token mint address matches the expected mint.
 * Use this to prevent spoofed token attacks where a fake USDC mint
 * is substituted for the real one.
 *
 * @param actualMint - The mint address from the payment/transaction
 * @param expectedMint - The known-good mint address (e.g., USDC_MINT_MAINNET)
 * @throws DelegationError with INVALID_ADDRESS code if mints don't match
 */
export function validateTokenMint(actualMint: Address, expectedMint: Address): void {
  if (actualMint !== expectedMint) {
    throw new DelegationError(
      DelegationErrorCode.INVALID_ADDRESS,
      `Token mint mismatch: expected ${expectedMint}, got ${actualMint}. This may indicate a spoofed token.`,
    );
  }
}
