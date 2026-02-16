/**
 * Client-side SPL Token delegation utilities.
 * Builds unsigned transactions for approving and revoking SPL token delegation.
 * Uses @solana/web3.js v1 (wallet adapter compatible).
 */

// TODO: Replace with @solana/kit once wallet adapter migrates to v2+ types.
// @solana/web3.js v1 is required here for wallet adapter sendTransaction() compat.
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import type { Connection } from '@solana/web3.js';

// SPL Token Program
const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);

// Associated Token Program
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
);

/**
 * Derive the Associated Token Account address for a wallet + mint.
 */
export function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

/**
 * Build an ApproveChecked transaction for SPL token delegation.
 * The owner approves a delegate (agent) to spend up to `amount` tokens.
 *
 * Instruction layout (ApproveChecked = discriminator 12):
 *   [12, amount(u64 LE), decimals(u8)]
 *   Accounts: source(writable), mint, delegate, owner(signer)
 */
export async function buildApproveCheckedTransaction(
  connection: Connection,
  owner: PublicKey,
  delegate: PublicKey,
  mint: PublicKey,
  amount: bigint,
  decimals: number,
): Promise<Transaction> {
  const sourceTokenAccount = getAssociatedTokenAddress(mint, owner);

  // Build instruction data: [12, amount(u64 LE), decimals(u8)]
  const data = Buffer.alloc(10);
  data.writeUInt8(12, 0);
  data.writeBigUInt64LE(amount, 1);
  data.writeUInt8(decimals, 9);

  const instruction = new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: sourceTokenAccount, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: delegate, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });

  const transaction = new Transaction().add(instruction);
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = owner;

  return transaction;
}

/**
 * Build a Revoke transaction to remove delegation authority.
 *
 * Instruction layout (Revoke = discriminator 5):
 *   [5]
 *   Accounts: source(writable), owner(signer)
 */
export async function buildRevokeTransaction(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
): Promise<Transaction> {
  const sourceTokenAccount = getAssociatedTokenAddress(mint, owner);

  const data = Buffer.alloc(1);
  data.writeUInt8(5, 0);

  const instruction = new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: sourceTokenAccount, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });

  const transaction = new Transaction().add(instruction);
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = owner;

  return transaction;
}
