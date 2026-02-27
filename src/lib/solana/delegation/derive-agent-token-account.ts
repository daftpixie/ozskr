/**
 * PDA derivation for agent token accounts.
 *
 * Seeds: [userWallet bytes, mint bytes, UTF-8(characterId), UTF-8("delegation")]
 * Program: SPL Token Program (TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA)
 *
 * Pure function — no RPC calls.
 */

import {
  type Address,
  type ProgramDerivedAddress,
  type ReadonlyUint8Array,
  assertIsAddress,
  getAddressEncoder,
  getProgramDerivedAddress,
} from '@solana/kit';
import { TOKEN_PROGRAM_ID } from './types';

// =============================================================================
// TYPES
// =============================================================================

export interface DerivedAgentTokenAccount {
  /** Derived PDA address. */
  address: Address;
  /** Bump seed used in derivation (0-255). */
  bump: number;
}

// =============================================================================
// DERIVATION
// =============================================================================

/**
 * Derives the agent token account PDA from a deterministic seed set.
 *
 * Seeds (in order):
 *   1. userWallet address bytes (32 bytes)
 *   2. tokenMint address bytes (32 bytes)
 *   3. UTF-8 encoded characterId
 *   4. UTF-8 "delegation" literal
 *
 * The program authority is the SPL Token Program ID.
 *
 * @param userWallet  - The user's wallet address (token account owner).
 * @param tokenMint   - The SPL token mint address.
 * @param characterId - The character / agent identifier string.
 * @returns Derived PDA address and bump seed.
 * @throws When address inputs are invalid.
 */
export async function deriveAgentTokenAccount(
  userWallet: Address,
  tokenMint: Address,
  characterId: string,
): Promise<DerivedAgentTokenAccount> {
  assertIsAddress(userWallet);
  assertIsAddress(tokenMint);

  if (!characterId || characterId.trim().length === 0) {
    throw new Error('characterId must be a non-empty string');
  }

  const encoder = getAddressEncoder();

  // Encode address bytes (each is 32 bytes).
  // encode() returns ReadonlyUint8Array which satisfies Seed type.
  const walletBytes: ReadonlyUint8Array = encoder.encode(userWallet);
  const mintBytes: ReadonlyUint8Array = encoder.encode(tokenMint);

  // Encode strings as UTF-8
  const textEncoder = new TextEncoder();
  const characterIdBytes = textEncoder.encode(characterId);
  const delegationBytes = textEncoder.encode('delegation');

  const pda: ProgramDerivedAddress = await getProgramDerivedAddress({
    programAddress: TOKEN_PROGRAM_ID,
    seeds: [walletBytes, mintBytes, characterIdBytes, delegationBytes],
  });

  const [pdaAddress, bump] = pda;

  return {
    address: pdaAddress,
    bump,
  };
}
