/**
 * Validation helpers for the agent delegation subsystem.
 * Pure functions — no RPC calls, no side effects.
 */

import { assertIsAddress, type Address } from '@solana/kit';
import { TOKEN_2022_PROGRAM_ID } from './types';

// =============================================================================
// ERROR CLASS
// =============================================================================

export class DelegationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DelegationValidationError';
  }
}

// =============================================================================
// VALIDATORS
// =============================================================================

/**
 * Throws if the given programId is Token-2022.
 * Only the classic SPL Token Program is supported.
 *
 * @param programId - Program ID to check.
 * @throws {DelegationValidationError} When programId equals TOKEN_2022_PROGRAM_ID.
 */
export function validateTokenProgramId(programId: Address): void {
  if (programId === TOKEN_2022_PROGRAM_ID) {
    throw new DelegationValidationError(
      'Token-2022 program is not supported. Use the classic SPL Token Program ' +
        '(TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA).',
    );
  }
}

/**
 * Validates that an address matches the expected PDA derived from
 * (userWallet, mint, characterId, "delegation") seeds under TOKEN_PROGRAM_ID.
 *
 * This is a structural check using assertIsAddress — the actual PDA
 * derivation must happen separately via deriveAgentTokenAccount.
 *
 * @param derivedAddress  - Address to validate.
 * @param userWallet      - Owner wallet (used in derivation).
 * @param mint            - Token mint (used in derivation).
 * @param characterId     - Character ID string (used in derivation).
 * @throws {DelegationValidationError} When the address is invalid.
 */
export function validatePdaDerivation(
  derivedAddress: Address,
  userWallet: Address,
  mint: Address,
  characterId: string,
): void {
  // Assert each input is a well-formed address before accepting them.
  try {
    assertIsAddress(derivedAddress);
    assertIsAddress(userWallet);
    assertIsAddress(mint);
  } catch (err) {
    throw new DelegationValidationError(
      `Invalid address in PDA derivation validation: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (!characterId || characterId.trim().length === 0) {
    throw new DelegationValidationError(
      'characterId must be a non-empty string.',
    );
  }

  // The actual PDA match check is performed by the caller after async derivation.
  // This function validates that all inputs are structurally sound.
}

/**
 * Throws if delegate and owner are the same address.
 * Self-delegation would allow bypassing the spending cap.
 *
 * @param delegate - Proposed delegate address.
 * @param owner    - Token account owner address.
 * @throws {DelegationValidationError} When delegate === owner.
 */
export function validateDelegateNotOwner(
  delegate: Address,
  owner: Address,
): void {
  if (delegate === owner) {
    throw new DelegationValidationError(
      `Delegate must not be the same as the owner (${owner}). ` +
        'Self-delegation is not permitted.',
    );
  }
}

/**
 * Parses a decimal string into a bigint token amount.
 * Validates that the value is a non-negative integer within u64 range.
 *
 * @param amount - Decimal string representation (e.g. "1000000").
 * @returns Parsed bigint amount.
 * @throws {DelegationValidationError} On invalid format or out-of-range value.
 */
export function validateAmountBigInt(amount: string): bigint {
  if (!/^\d+$/.test(amount)) {
    throw new DelegationValidationError(
      `Amount must be a non-negative integer string, got: "${amount}"`,
    );
  }

  let parsed: bigint;
  try {
    parsed = BigInt(amount);
  } catch {
    throw new DelegationValidationError(
      `Failed to parse amount as bigint: "${amount}"`,
    );
  }

  if (parsed < 0n) {
    throw new DelegationValidationError(
      `Amount must be non-negative, got: ${parsed}`,
    );
  }

  const U64_MAX = 18446744073709551615n;
  if (parsed > U64_MAX) {
    throw new DelegationValidationError(
      `Amount ${parsed} exceeds u64 maximum (${U64_MAX})`,
    );
  }

  return parsed;
}
