/**
 * Build an unsigned CloseAccount transaction for an agent token account.
 *
 * PRECONDITION: the token account must have a zero balance before closing.
 * This function fetches the balance and throws if it is non-zero.
 *
 * Instruction: SPL Token CloseAccount (discriminator = 9)
 * Data layout: [9 u8] — 1 byte total
 * Accounts:
 *   0. account          writable, non-signer  (account to close)
 *   1. destination      writable, non-signer  (rent lamports destination)
 *   2. owner            readonly, signer      (user wallet)
 *
 * Rent reclaimed goes to userWallet.
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
import { checkAgentDelegation } from './check-agent-delegation';

// =============================================================================
// TYPES
// =============================================================================

type SolanaRpc = ReturnType<typeof createSolanaRpc>;

export interface CloseAgentTokenAccountParams {
  /** Solana RPC client for precondition check + blockhash fetch. */
  rpc: SolanaRpc;
  /** User's wallet address (fee payer, owner signer, rent destination). */
  userWallet: Address;
  /** Token account address to close. */
  tokenAccountAddress: Address;
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Builds an unsigned CloseAccount transaction for an agent token account.
 *
 * PRECONDITION: fetches the on-chain balance and throws
 * `DelegationCloseError` if balance is non-zero. The caller must either
 * sweep remaining tokens first (use sweepAndClose) or ensure the balance
 * is already zero.
 *
 * @param params - Close parameters.
 * @returns Unsigned transaction message ready for wallet signing.
 * @throws When the token account has a non-zero balance.
 * @throws When the token account address is invalid.
 */
export async function closeAgentTokenAccount(
  params: CloseAgentTokenAccountParams,
): Promise<TransactionMessage & TransactionMessageWithBlockhashLifetime> {
  const { rpc, userWallet, tokenAccountAddress } = params;

  assertIsAddress(userWallet);
  assertIsAddress(tokenAccountAddress);

  // PRECONDITION: verify balance is zero before building close transaction.
  const status = await checkAgentDelegation(rpc, tokenAccountAddress);
  if (status.balance > 0n) {
    throw new Error(
      `Cannot close token account ${tokenAccountAddress}: non-zero balance ${status.balance}. ` +
        'Sweep remaining tokens first using sweepAndClose().',
    );
  }

  // Fetch a fresh blockhash.
  const { value: blockhash } = await rpc.getLatestBlockhash().send();

  // CloseAccount instruction data: single byte discriminator = 9.
  const closeData = new Uint8Array([9]);

  const closeInstruction: Instruction = {
    programAddress: TOKEN_PROGRAM_ID,
    accounts: [
      // 0: account to close — writable, non-signer
      { address: tokenAccountAddress, role: AccountRole.WRITABLE },
      // 1: destination for rent lamports — writable, non-signer
      { address: userWallet, role: AccountRole.WRITABLE },
      // 2: owner — readonly, signer
      { address: userWallet, role: AccountRole.READONLY_SIGNER },
    ],
    data: closeData,
  };

  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(userWallet, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
    (tx) => appendTransactionMessageInstruction(closeInstruction, tx),
  );

  return txMessage;
}
