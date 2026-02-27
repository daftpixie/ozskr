/**
 * Sweep remaining token balance and close an agent token account in one transaction.
 *
 * Transaction includes two instructions:
 *   1. TransferChecked — full balance from agentTokenAccount → primaryAta
 *   2. CloseAccount    — reclaim rent to userWallet
 *
 * Both instructions reference userWallet as the owner/signer, so a single
 * wallet adapter signing call handles both.
 *
 * Instruction: SPL Token TransferChecked (discriminator = 12)
 * Data layout: [12 u8, amount u64 LE, decimals u8] = 10 bytes
 * Accounts:
 *   0. source          writable, non-signer  (agent token account)
 *   1. mint            readonly, non-signer  (token mint)
 *   2. destination     writable, non-signer  (user primary ATA)
 *   3. owner           readonly, signer      (user wallet — owner of source)
 *
 * Instruction: SPL Token CloseAccount (discriminator = 9)
 * Data layout: [9 u8] = 1 byte
 * Accounts:
 *   0. account         writable, non-signer  (agent token account)
 *   1. destination     writable, non-signer  (rent destination)
 *   2. owner           readonly, signer      (user wallet)
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

export interface SweepAndCloseParams {
  /** Solana RPC client for balance fetch + blockhash. */
  rpc: SolanaRpc;
  /** User's wallet address (fee payer, owner, rent destination). */
  userWallet: Address;
  /** Agent token account PDA to sweep and close. */
  agentTokenAccount: Address;
  /** User's primary ATA — destination for swept tokens. */
  primaryAta: Address;
  /** Token mint address. */
  tokenMint: Address;
  /** Token decimals. */
  decimals: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Builds TransferChecked instruction data.
 * Layout: [12 u8, amount u64 LE, decimals u8] — 10 bytes.
 */
function buildTransferCheckedData(amount: bigint, decimals: number): Uint8Array {
  const data = new Uint8Array(10);
  const view = new DataView(data.buffer);
  view.setUint8(0, 12); // TransferChecked discriminator
  view.setBigUint64(1, amount, true); // amount, little-endian
  view.setUint8(9, decimals); // decimals
  return data;
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Builds an unsigned sweep-and-close transaction.
 *
 * Fetches the current balance of agentTokenAccount and builds a single
 * transaction containing:
 *   1. TransferChecked: move full balance to primaryAta
 *   2. CloseAccount: reclaim rent to userWallet
 *
 * If the balance is already zero, only the CloseAccount instruction is included.
 *
 * @param params - Sweep and close parameters.
 * @returns Unsigned transaction message ready for wallet signing.
 */
export async function sweepAndClose(
  params: SweepAndCloseParams,
): Promise<TransactionMessage & TransactionMessageWithBlockhashLifetime> {
  const {
    rpc,
    userWallet,
    agentTokenAccount,
    primaryAta,
    tokenMint,
    decimals,
  } = params;

  assertIsAddress(userWallet);
  assertIsAddress(agentTokenAccount);
  assertIsAddress(primaryAta);
  assertIsAddress(tokenMint);

  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error(`decimals must be an integer 0-18, got ${decimals}`);
  }

  // Fetch current balance from on-chain.
  const status = await checkAgentDelegation(rpc, agentTokenAccount);
  const remainingBalance = status.balance;

  // Fetch a fresh blockhash.
  const { value: blockhash } = await rpc.getLatestBlockhash().send();

  // CloseAccount instruction — always included.
  const closeData = new Uint8Array([9]);
  const closeInstruction: Instruction = {
    programAddress: TOKEN_PROGRAM_ID,
    accounts: [
      // 0: account to close — writable
      { address: agentTokenAccount, role: AccountRole.WRITABLE },
      // 1: rent lamports destination — writable
      { address: userWallet, role: AccountRole.WRITABLE },
      // 2: owner — readonly signer
      { address: userWallet, role: AccountRole.READONLY_SIGNER },
    ],
    data: closeData,
  };

  if (remainingBalance === 0n) {
    // No tokens to sweep — just close the account.
    const txMessage = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(userWallet, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
      (tx) => appendTransactionMessageInstruction(closeInstruction, tx),
    );
    return txMessage;
  }

  // TransferChecked instruction — move full balance to primaryAta.
  const transferData = buildTransferCheckedData(remainingBalance, decimals);
  const transferInstruction: Instruction = {
    programAddress: TOKEN_PROGRAM_ID,
    accounts: [
      // 0: source — writable
      { address: agentTokenAccount, role: AccountRole.WRITABLE },
      // 1: mint — readonly
      { address: tokenMint, role: AccountRole.READONLY },
      // 2: destination — writable
      { address: primaryAta, role: AccountRole.WRITABLE },
      // 3: owner — readonly signer
      { address: userWallet, role: AccountRole.READONLY_SIGNER },
    ],
    data: transferData,
  };

  // Build transaction with transfer then close.
  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(userWallet, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
    (tx) => appendTransactionMessageInstruction(transferInstruction, tx),
    (tx) => appendTransactionMessageInstruction(closeInstruction, tx),
  );

  return txMessage;
}
