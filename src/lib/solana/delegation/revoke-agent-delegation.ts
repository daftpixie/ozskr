/**
 * Build an unsigned Revoke transaction for SPL token delegation.
 *
 * Instruction: SPL Token Revoke (discriminator = 5)
 * Data layout: [5 u8] — 1 byte total
 * Accounts:
 *   0. source  writable, non-signer  (token account to revoke delegate on)
 *   1. owner   readonly, signer      (user wallet)
 *
 * Returns the unsigned transaction — caller must sign and submit.
 * No simulation here: revoke is a simple, safe operation.
 */

import {
  type Address,
  type Instruction,
  AccountRole,
  assertIsAddress,
  createSolanaRpc,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
} from '@solana/kit';
import type { TransactionMessage, TransactionMessageWithBlockhashLifetime } from '@solana/kit';
import { TOKEN_PROGRAM_ID } from './types';

// =============================================================================
// TYPES
// =============================================================================

type SolanaRpc = ReturnType<typeof createSolanaRpc>;

export interface RevokeAgentDelegationParams {
  /** Solana RPC client for blockhash fetch. */
  rpc: SolanaRpc;
  /** User's wallet address (fee payer + owner signer). */
  userWallet: Address;
  /** Token account address to remove the delegate from. */
  tokenAccountAddress: Address;
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Builds an unsigned Revoke transaction that removes all delegate authority
 * from the specified token account.
 *
 * After this transaction is confirmed, the agent keypair can no longer
 * execute transferChecked on behalf of the user.
 *
 * @param params - Revocation parameters.
 * @returns Unsigned transaction message ready for wallet signing.
 */
export async function revokeAgentDelegation(
  params: RevokeAgentDelegationParams,
): Promise<TransactionMessage & TransactionMessageWithBlockhashLifetime> {
  const { rpc, userWallet, tokenAccountAddress } = params;

  assertIsAddress(userWallet);
  assertIsAddress(tokenAccountAddress);

  // Fetch a fresh blockhash.
  const { value: blockhash } = await rpc.getLatestBlockhash().send();

  // Revoke instruction data: single byte discriminator = 5.
  const revokeData = new Uint8Array([5]);

  const revokeInstruction: Instruction = {
    programAddress: TOKEN_PROGRAM_ID,
    accounts: [
      // 0: source token account — writable, non-signer
      { address: tokenAccountAddress, role: AccountRole.WRITABLE },
      // 1: owner — readonly, signer
      { address: userWallet, role: AccountRole.READONLY_SIGNER },
    ],
    data: revokeData,
  };

  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(userWallet, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
    (tx) => appendTransactionMessageInstruction(revokeInstruction, tx),
  );

  return txMessage;
}
