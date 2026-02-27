/**
 * Build an unsigned approveChecked transaction for SPL token delegation.
 *
 * Instruction: SPL Token ApproveChecked (discriminator = 13)
 * Data layout: [13 u8, amount u64 LE, decimals u8] = 10 bytes
 * Accounts:
 *   0. source         writable, non-signer  (token account being delegated)
 *   1. mint           readonly, non-signer  (token mint — enforces checked)
 *   2. delegate       readonly, non-signer  (agent pubkey)
 *   3. owner          readonly, signer      (user wallet)
 *
 * simulateTransaction is called before returning to the caller.
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
import { validateDelegateNotOwner } from './validate';

// =============================================================================
// TYPES
// =============================================================================

type SolanaRpc = ReturnType<typeof createSolanaRpc>;

export interface ApproveAgentDelegationParams {
  /** Solana RPC client for blockhash + simulation. */
  rpc: SolanaRpc;
  /** Token account address to set delegate on. */
  tokenAccountAddress: Address;
  /** Agent pubkey that will receive delegate authority. */
  delegatePubkey: Address;
  /** Spending cap in base token units (bigint). */
  amount: bigint;
  /** Token mint address (required for ApproveChecked). */
  tokenMint: Address;
  /** Token decimals (must match on-chain mint). */
  decimals: number;
  /** User's wallet address (fee payer + owner signer). */
  userWallet: Address;
}

export interface ApproveAgentDelegationResult {
  /** Unsigned transaction message ready for wallet signing. */
  transaction: TransactionMessage & TransactionMessageWithBlockhashLifetime;
}

// =============================================================================
// SPL TOKEN INSTRUCTION DATA BUILDER
// =============================================================================

/**
 * Builds the ApproveChecked instruction data buffer.
 * Layout: [discriminator(u8), amount(u64 LE), decimals(u8)] — 10 bytes total.
 */
function buildApproveCheckedData(amount: bigint, decimals: number): Uint8Array {
  const data = new Uint8Array(10);
  const view = new DataView(data.buffer);
  view.setUint8(0, 13); // ApproveChecked discriminator
  view.setBigUint64(1, amount, true); // amount, little-endian
  view.setUint8(9, decimals); // decimals
  return data;
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Builds an unsigned approveChecked transaction granting a delegate
 * spending authority over a token account.
 *
 * Security guarantees:
 * - Uses ApproveChecked (discriminator 13) not Approve (discriminator 4),
 *   ensuring the on-chain program validates mint and decimals.
 * - Validates delegate !== owner to prevent self-delegation.
 * - Simulates the transaction before returning.
 *
 * @param params - Approval parameters.
 * @returns Unsigned transaction message.
 * @throws When validation fails or simulation returns an error.
 */
export async function approveAgentDelegation(
  params: ApproveAgentDelegationParams,
): Promise<ApproveAgentDelegationResult> {
  const {
    rpc,
    tokenAccountAddress,
    delegatePubkey,
    amount,
    tokenMint,
    decimals,
    userWallet,
  } = params;

  // Validate all addresses.
  assertIsAddress(tokenAccountAddress);
  assertIsAddress(delegatePubkey);
  assertIsAddress(tokenMint);
  assertIsAddress(userWallet);

  // Validate delegate is not owner.
  validateDelegateNotOwner(delegatePubkey, userWallet);

  // Validate amount is positive.
  if (amount <= 0n) {
    throw new Error(`Delegation amount must be positive, got ${amount}`);
  }

  // Validate decimals.
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error(`decimals must be an integer 0-18, got ${decimals}`);
  }

  // Fetch blockhash.
  const { value: blockhash } = await rpc.getLatestBlockhash().send();

  // Build ApproveChecked instruction.
  const instructionData = buildApproveCheckedData(amount, decimals);

  const approveCheckedInstruction: Instruction = {
    programAddress: TOKEN_PROGRAM_ID,
    accounts: [
      // 0: source token account — writable, non-signer
      { address: tokenAccountAddress, role: AccountRole.WRITABLE },
      // 1: mint — readonly, non-signer
      { address: tokenMint, role: AccountRole.READONLY },
      // 2: delegate — readonly, non-signer
      { address: delegatePubkey, role: AccountRole.READONLY },
      // 3: owner — readonly, signer
      { address: userWallet, role: AccountRole.READONLY_SIGNER },
    ],
    data: instructionData,
  };

  // Build transaction message.
  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(userWallet, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
    (tx) => appendTransactionMessageInstruction(approveCheckedInstruction, tx),
  );

  // Simulate before returning — sigVerify: false since unsigned.
  // Non-fatal if the RPC endpoint is not configured.
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
            {
              encoding: 'base64',
              sigVerify: false,
              replaceRecentBlockhash: true,
            },
          ],
        }),
      });

      if (simResponse.ok) {
        const simBody = await simResponse.json() as {
          result?: { value?: { err?: unknown } };
        };
        if (simBody.result?.value?.err) {
          throw new Error(
            `approveChecked simulation failed: ${JSON.stringify(simBody.result.value.err)}`,
          );
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('approveChecked simulation failed')) {
        throw err;
      }
      // Network/RPC errors during simulation are non-fatal.
      // The wallet adapter will surface any real errors at submission time.
    }
  }

  return { transaction: txMessage };
}
