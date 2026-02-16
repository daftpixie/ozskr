/**
 * Server-side agent transfer execution.
 * Builds and submits a delegated SPL token transfer using the agent's keypair.
 *
 * Uses @solana/web3.js v1 to avoid Turbopack's externals-tracing issue with
 * @solana-program/token → @solana/kit version conflict.
 */

// TODO: Replace with @solana/kit native signing once Turbopack resolves
// @solana-program/token → @solana/kit version conflict. @solana/web3.js v1 is
// deprecated but necessary here because delegate.ts can't be imported through
// Turbopack's externals-tracing. See: next.config.ts serverExternalPackages.
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { loadAgentKeypairBytes } from './index';

const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);

const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
);

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL
  || process.env.NEXT_PUBLIC_HELIUS_RPC_URL
  || 'https://api.devnet.solana.com';

function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

/**
 * Build a CreateAssociatedTokenAccountIdempotent instruction.
 * ATA program instruction index 1 = create_idempotent (no-op if exists).
 * Accounts: payer(s,w), ata(w), owner, mint, systemProgram, tokenProgram
 */
function buildCreateAtaIdempotentInstruction(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]), // instruction index 1 = create_idempotent
  });
}

/**
 * Build a TransferChecked instruction.
 * SPL Token instruction discriminator 12:
 *   [12, amount(u64 LE), decimals(u8)]
 *   Accounts: source(w), mint, destination(w), authority(s)
 */
function buildTransferCheckedInstruction(
  source: PublicKey,
  mint: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  amount: bigint,
  decimals: number,
): TransactionInstruction {
  const data = Buffer.alloc(10);
  data.writeUInt8(12, 0);
  data.writeBigUInt64LE(amount, 1);
  data.writeUInt8(decimals, 9);

  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

interface ExecuteTransferParams {
  characterId: string;
  ownerAddress: string;
  destinationTokenAccount: string;
  destinationOwner?: string;
  amount: bigint;
  decimals: number;
  tokenMint: string;
}

interface TransferResult {
  signature: string;
  amount: string;
}

/**
 * Execute a delegated transfer on behalf of an agent.
 * The agent must have active delegation from the token account owner.
 *
 * Flow:
 * 1. Load agent keypair from encrypted storage
 * 2. Build CreateAtaIdempotent + TransferChecked instructions
 * 3. Sign with agent keypair
 * 4. Simulate signed transaction, then submit
 */
export async function executeAgentTransfer(
  params: ExecuteTransferParams,
): Promise<TransferResult> {
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

  // Load agent keypair bytes and convert to web3.js v1 Keypair
  const keypairBytes = await loadAgentKeypairBytes(params.characterId);
  let agentKeypair: Keypair;
  try {
    agentKeypair = Keypair.fromSecretKey(keypairBytes);
  } finally {
    keypairBytes.fill(0);
  }

  const mint = new PublicKey(params.tokenMint);
  const owner = new PublicKey(params.ownerAddress);
  const destination = new PublicKey(params.destinationTokenAccount);

  // Source is the owner's ATA for this token
  const source = getAssociatedTokenAddress(mint, owner);

  // Ensure destination ATA exists (idempotent — no-op if already created)
  const createAtaIx = buildCreateAtaIdempotentInstruction(
    agentKeypair.publicKey, // agent pays rent for ATA creation
    destination,
    new PublicKey(params.destinationOwner || agentKeypair.publicKey.toBase58()),
    mint,
  );

  // Build the TransferChecked instruction with agent as authority (delegate)
  const transferIx = buildTransferCheckedInstruction(
    source,
    mint,
    destination,
    agentKeypair.publicKey,
    params.amount,
    params.decimals,
  );

  // Build transaction: create ATA (idempotent) → transfer
  const transaction = new Transaction().add(createAtaIx, transferIx);
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = agentKeypair.publicKey;

  // Sign first, then simulate the signed transaction.
  // Note: simulateTransaction(tx, [signers]) is unreliable on some RPC endpoints;
  // signing first and simulating the signed tx is the proven approach.
  transaction.sign(agentKeypair);

  const simulation = await connection.simulateTransaction(transaction);
  if (simulation.value.err) {
    throw new Error(
      `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`
    );
  }

  // Send signed transaction
  const signature = await connection.sendRawTransaction(
    transaction.serialize(),
    { skipPreflight: false },
  );

  // Wait for confirmation
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  return {
    signature,
    amount: params.amount.toString(),
  };
}
