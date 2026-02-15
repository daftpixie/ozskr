/**
 * Server-side agent transfer execution.
 * Builds and submits a delegated SPL token transfer using the agent's keypair.
 *
 * Uses @solana/web3.js v1 to avoid Turbopack's externals-tracing issue with
 * @solana-program/token → @solana/kit version conflict.
 */

import {
  Connection,
  Keypair,
  PublicKey,
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
 * 2. Build TransferChecked instruction (agent as delegate/authority)
 * 3. Simulate transaction
 * 4. Sign with agent keypair and submit
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

  // Build the TransferChecked instruction with agent as authority (delegate)
  const instruction = buildTransferCheckedInstruction(
    source,
    mint,
    destination,
    agentKeypair.publicKey,
    params.amount,
    params.decimals,
  );

  // Build transaction
  const transaction = new Transaction().add(instruction);
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = agentKeypair.publicKey;

  // Simulate before sending
  const simulation = await connection.simulateTransaction(transaction, [agentKeypair]);
  if (simulation.value.err) {
    throw new Error(
      `Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`
    );
  }

  // Sign and send
  transaction.sign(agentKeypair);
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
