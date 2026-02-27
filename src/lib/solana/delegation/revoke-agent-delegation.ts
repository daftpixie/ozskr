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
 * Simulation is performed before returning (non-fatal if RPC is unavailable).
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
  compileTransaction,
  getTransactionEncoder,
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

  // Simulate before returning — sigVerify: false since unsigned.
  // Non-fatal: network or RPC errors do not prevent the transaction from being built.
  const rpcEndpoint = process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? '';
  if (rpcEndpoint) {
    try {
      const compiled = compileTransaction(txMessage);
      const txBytes = getTransactionEncoder().encode(compiled);
      const txBase64 = Buffer.from(txBytes as Uint8Array).toString('base64');

      const simResponse = await fetch(rpcEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'simulateTransaction',
          params: [
            txBase64,
            { encoding: 'base64', sigVerify: false, replaceRecentBlockhash: true },
          ],
        }),
      });

      if (simResponse.ok) {
        const simBody = await simResponse.json() as {
          result?: { value?: { err?: unknown } };
        };
        if (simBody.result?.value?.err) {
          throw new Error(
            `revoke simulation failed: ${JSON.stringify(simBody.result.value.err)}`,
          );
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('revoke simulation failed')) {
        throw err;
      }
      // Network/RPC errors during simulation are non-fatal.
    }
  }

  return txMessage;
}
