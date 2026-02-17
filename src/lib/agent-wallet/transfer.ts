/**
 * Server-side agent transfer execution.
 * Builds and submits a delegated SPL token transfer using the agent's KeyPairSigner.
 *
 * Uses @solana/kit natively for transaction building, signing (Web Crypto Ed25519),
 * and RPC submission. This avoids the tweetnacl incompatibility that occurs when
 * @solana/web3.js v1 is bundled through Turbopack.
 */

import {
  type Instruction,
  type Address,
  address,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  createSolanaRpc,
  AccountRole,
  getProgramDerivedAddress,
} from '@solana/kit';
import { loadAgentSigner } from './index';

const TOKEN_PROGRAM: Address = address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ATA_PROGRAM: Address = address('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const SYSTEM_PROGRAM: Address = address('11111111111111111111111111111111');

function getSolanaRpcUrl(): string {
  return process.env.SOLANA_RPC_URL
    || process.env.NEXT_PUBLIC_HELIUS_RPC_URL
    || 'https://api.devnet.solana.com';
}

/**
 * Derive the Associated Token Account address for a wallet + mint.
 */
async function getAssociatedTokenAddress(
  mint: Address,
  owner: Address,
): Promise<Address> {
  const [ata] = await getProgramDerivedAddress({
    programAddress: ATA_PROGRAM,
    seeds: [
      // owner bytes
      getAddressBytes(owner),
      // token program bytes
      getAddressBytes(TOKEN_PROGRAM),
      // mint bytes
      getAddressBytes(mint),
    ],
  });
  return ata;
}

/**
 * Convert an Address to a 32-byte Uint8Array seed for PDA derivation.
 */
function getAddressBytes(addr: Address): Uint8Array {
  // Base58 decode: @solana/kit addresses are base58-encoded 32-byte public keys
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = 0n;
  for (const char of addr) {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base58 character: ${char}`);
    num = num * 58n + BigInt(idx);
  }
  const bytes = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(num & 0xffn);
    num >>= 8n;
  }
  return bytes;
}

/**
 * Build a CreateAssociatedTokenAccountIdempotent instruction.
 * ATA program instruction index 1 = create_idempotent (no-op if exists).
 */
function buildCreateAtaIdempotentIx(
  payer: Address,
  ata: Address,
  owner: Address,
  mint: Address,
): Instruction {
  return {
    programAddress: ATA_PROGRAM,
    accounts: [
      { address: payer, role: AccountRole.WRITABLE_SIGNER },
      { address: ata, role: AccountRole.WRITABLE },
      { address: owner, role: AccountRole.READONLY },
      { address: mint, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
      { address: TOKEN_PROGRAM, role: AccountRole.READONLY },
    ],
    data: new Uint8Array([1]), // instruction index 1 = create_idempotent
  };
}

/**
 * Build a TransferChecked instruction.
 * SPL Token instruction discriminator 12:
 *   [12, amount(u64 LE), decimals(u8)]
 *   Accounts: source(w), mint, destination(w), authority(s)
 */
function buildTransferCheckedIx(
  source: Address,
  mint: Address,
  destination: Address,
  authority: Address,
  amount: bigint,
  decimals: number,
): Instruction {
  const data = new Uint8Array(10);
  const view = new DataView(data.buffer);
  view.setUint8(0, 12); // TransferChecked discriminator
  view.setBigUint64(1, amount, true); // little-endian
  view.setUint8(9, decimals);

  return {
    programAddress: TOKEN_PROGRAM,
    accounts: [
      { address: source, role: AccountRole.WRITABLE },
      { address: mint, role: AccountRole.READONLY },
      { address: destination, role: AccountRole.WRITABLE },
      { address: authority, role: AccountRole.READONLY_SIGNER },
    ],
    data,
  };
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
 * 1. Load agent KeyPairSigner from encrypted storage
 * 2. Build CreateAtaIdempotent + TransferChecked instructions
 * 3. Sign with Web Crypto Ed25519 (via KeyPairSigner)
 * 4. Simulate, then submit
 */
export async function executeAgentTransfer(
  params: ExecuteTransferParams,
): Promise<TransferResult> {
  const rpcUrl = getSolanaRpcUrl();
  const rpc = createSolanaRpc(rpcUrl);

  // Load agent's KeyPairSigner (Web Crypto Ed25519)
  const agentSigner = await loadAgentSigner(params.characterId);
  const agentAddress = agentSigner.address;

  const mint = address(params.tokenMint);
  const ownerAddr = address(params.ownerAddress);
  const destination = address(params.destinationTokenAccount);

  // Source is the owner's ATA for this token
  const source = await getAssociatedTokenAddress(mint, ownerAddr);

  // Determine destination owner for ATA creation
  const destOwner = params.destinationOwner
    ? address(params.destinationOwner)
    : agentAddress;

  // Build instructions
  const createAtaIx = buildCreateAtaIdempotentIx(agentAddress, destination, destOwner, mint);
  const transferIx = buildTransferCheckedIx(
    source, mint, destination, agentAddress, params.amount, params.decimals,
  );

  // Get recent blockhash
  const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();

  // Build transaction message
  const txMessage = pipe(
    createTransactionMessage({ version: 'legacy' }),
    (tx) => setTransactionMessageFeePayer(agentAddress, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
    (tx) => appendTransactionMessageInstruction(createAtaIx, tx),
    (tx) => appendTransactionMessageInstruction(transferIx, tx),
  );

  // Sign with Web Crypto Ed25519 (KeyPairSigner)
  const signedTx = await signTransactionMessageWithSigners(txMessage);

  // Get wire format and signature
  const wireBase64 = getBase64EncodedWireTransaction(signedTx);
  const txSignature = getSignatureFromTransaction(signedTx);

  // Simulate before sending
  const simResult = await rpc.simulateTransaction(wireBase64, {
    encoding: 'base64',
    commitment: 'confirmed',
  }).send();

  if (simResult.value.err) {
    throw new Error(
      `Transaction simulation failed: ${JSON.stringify(simResult.value.err)}`
    );
  }

  // Send the signed transaction
  await rpc.sendTransaction(wireBase64, {
    encoding: 'base64',
    skipPreflight: false,
  }).send();

  // Poll until confirmed

  let confirmed = false;
  for (let i = 0; i < 30; i++) {
    const statusResult = await rpc.getSignatureStatuses([txSignature]).send();
    const status = statusResult.value[0];
    if (status && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')) {
      if (status.err) {
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
      }
      confirmed = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!confirmed) {
    throw new Error('Transaction confirmation timeout');
  }

  return {
    signature: txSignature,
    amount: params.amount.toString(),
  };
}
