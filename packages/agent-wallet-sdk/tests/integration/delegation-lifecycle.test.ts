/**
 * Devnet Integration Test: SPL Delegation Lifecycle
 *
 * Runs the full delegation lifecycle on Solana devnet:
 * 1. Generate owner + agent keypairs
 * 2. Keypair encrypt/decrypt roundtrip
 * 3. Airdrop SOL to owner
 * 4. Create SPL token mint
 * 5. Create token accounts for owner + agent
 * 6. Mint test tokens to owner
 * 7. Create delegation (owner → agent)
 * 8. Check delegation (verify active)
 * 9. Transfer as delegate
 * 10. Check delegation (verify reduced)
 * 11. Revoke delegation
 * 12. Check delegation (verify inactive)
 * 13. Transfer as delegate (verify throws)
 *
 * SKIPPED in CI — run manually with: INTEGRATION=1 pnpm test
 */

import { describe, it, expect } from 'vitest';
import {
  createSolanaRpc,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  createKeyPairSignerFromPrivateKeyBytes,
  address,
  type TransactionSigner,
  type KeyPairSigner,
} from '@solana/kit';
import {
  getCreateMintInstruction,
  getCreateAssociatedTokenInstruction,
  getMintToInstruction,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { getCreateAccountInstruction } from '@solana-program/system';
import { randomBytes } from 'node:crypto';
import {
  generateAgentKeypair,
  encryptKeypair,
  decryptKeypair,
  createDelegation,
  checkDelegation,
  transferAsDelegate,
  revokeDelegation,
  DelegationError,
  DelegationErrorCode,
  SCRYPT_PARAMS_FAST,
} from '../../src/index.js';

const DEVNET_URL = 'https://api.devnet.solana.com';
const RPC_CONFIG = { endpoint: DEVNET_URL };
const DECIMALS = 9;
const MINT_AMOUNT = 100_000_000_000n; // 100 tokens (9 decimals)
const DELEGATION_AMOUNT = 50_000_000_000n; // 50 tokens
const TRANSFER_AMOUNT = 10_000_000_000n; // 10 tokens

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function generateKeypair(): Promise<KeyPairSigner> {
  const seed = randomBytes(32);
  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed, true);
  seed.fill(0);
  return signer;
}

async function airdrop(rpc: ReturnType<typeof createSolanaRpc>, address: string, lamports: bigint) {
  const sig = await rpc.requestAirdrop(
    address as ReturnType<typeof import('@solana/kit').address>,
    lamports,
  ).send();

  // Wait for confirmation
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Poll for confirmation
  for (let i = 0; i < 30; i++) {
    try {
      const status = await rpc.getSignatureStatuses([sig]).send();
      if (status.value[0]?.confirmationStatus === 'confirmed' || status.value[0]?.confirmationStatus === 'finalized') {
        return;
      }
    } catch {
      // Retry
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Airdrop confirmation timeout');
}

async function sendAndConfirm(
  rpc: ReturnType<typeof createSolanaRpc>,
  transactionMessage: unknown,
) {
  const signed = await signTransactionMessageWithSigners(transactionMessage as Parameters<typeof signTransactionMessageWithSigners>[0]);
  const encoded = getBase64EncodedWireTransaction(signed);
  const sig = getSignatureFromTransaction(signed);

  await rpc.sendTransaction(encoded, { encoding: 'base64' }).send();

  // Wait for confirmation
  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const status = await rpc.getSignatureStatuses([sig]).send();
      if (status.value[0]?.confirmationStatus === 'confirmed' || status.value[0]?.confirmationStatus === 'finalized') {
        return sig;
      }
    } catch {
      // Retry
    }
  }
  throw new Error('Transaction confirmation timeout');
}

// ---------------------------------------------------------------------------
// Integration Test
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.INTEGRATION)('devnet delegation lifecycle', () => {
  it('should complete full delegation lifecycle', async () => {
    const rpc = createSolanaRpc(DEVNET_URL);

    // Step 1: Generate owner + agent keypairs
    const owner = await generateKeypair();
    const { signer: agent, keypairBytes: agentKeypairBytes } = await generateAgentKeypair();

    console.log(`Owner: ${owner.address}`);
    console.log(`Agent: ${agent.address}`);

    // Step 2: Keypair encrypt/decrypt roundtrip
    const encrypted = encryptKeypair(agentKeypairBytes, 'integration-test-pass', SCRYPT_PARAMS_FAST);
    const decrypted = decryptKeypair(encrypted, 'integration-test-pass', SCRYPT_PARAMS_FAST);
    expect(Buffer.from(decrypted).equals(Buffer.from(agentKeypairBytes))).toBe(true);
    decrypted.fill(0);
    agentKeypairBytes.fill(0);

    // Step 3: Airdrop SOL to owner (for tx fees + rent)
    console.log('Airdropping 2 SOL to owner...');
    await airdrop(rpc, owner.address, 2_000_000_000n);

    // Also airdrop to agent for fee paying
    console.log('Airdropping 1 SOL to agent...');
    await airdrop(rpc, agent.address, 1_000_000_000n);

    // Step 4: Create SPL token mint
    const mintKeypair = await generateKeypair();
    console.log(`Mint: ${mintKeypair.address}`);

    const { value: blockhash1 } = await rpc.getLatestBlockhash().send();
    const space = 82n; // Mint account size
    const { value: rentLamports } = await rpc.getMinimumBalanceForRentExemption(space).send();

    const createMintTx = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(owner.address, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash1, tx),
      (tx) => appendTransactionMessageInstruction(
        getCreateAccountInstruction({
          payer: owner,
          newAccount: mintKeypair,
          lamports: rentLamports,
          space,
          programAddress: TOKEN_PROGRAM_ADDRESS,
        }),
        tx,
      ),
      (tx) => appendTransactionMessageInstruction(
        getCreateMintInstruction({
          mint: mintKeypair.address,
          mintAuthority: owner.address,
          decimals: DECIMALS,
        }),
        tx,
      ),
    );

    console.log('Creating mint...');
    await sendAndConfirm(rpc, createMintTx);

    // Step 5: Create ATAs for owner + agent
    const [ownerAta] = await findAssociatedTokenPda({
      owner: owner.address,
      mint: mintKeypair.address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });

    const [agentAta] = await findAssociatedTokenPda({
      owner: agent.address,
      mint: mintKeypair.address,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    });

    const { value: blockhash2 } = await rpc.getLatestBlockhash().send();
    const createAtasTx = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(owner.address, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash2, tx),
      (tx) => appendTransactionMessageInstruction(
        getCreateAssociatedTokenInstruction({
          payer: owner,
          owner: owner.address,
          mint: mintKeypair.address,
        }),
        tx,
      ),
      (tx) => appendTransactionMessageInstruction(
        getCreateAssociatedTokenInstruction({
          payer: owner,
          owner: agent.address,
          mint: mintKeypair.address,
        }),
        tx,
      ),
    );

    console.log('Creating ATAs...');
    await sendAndConfirm(rpc, createAtasTx);

    // Step 6: Mint test tokens to owner
    const { value: blockhash3 } = await rpc.getLatestBlockhash().send();
    const mintToTx = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(owner.address, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash3, tx),
      (tx) => appendTransactionMessageInstruction(
        getMintToInstruction({
          mint: mintKeypair.address,
          token: ownerAta,
          mintAuthority: owner,
          amount: MINT_AMOUNT,
        }),
        tx,
      ),
    );

    console.log('Minting tokens...');
    await sendAndConfirm(rpc, mintToTx);

    // Step 7: Create delegation (owner → agent for 50 tokens)
    console.log('Creating delegation...');
    const delegationTx = await createDelegation(
      {
        ownerTokenAccount: ownerAta,
        ownerSigner: owner as TransactionSigner,
        delegateAddress: agent.address,
        tokenMint: mintKeypair.address,
        maxAmount: DELEGATION_AMOUNT,
        decimals: DECIMALS,
      },
      RPC_CONFIG,
    );
    await sendAndConfirm(rpc, delegationTx);

    // Step 8: Check delegation (should be active)
    const status1 = await checkDelegation(ownerAta, RPC_CONFIG);
    expect(status1.isActive).toBe(true);
    expect(status1.delegate).toBe(agent.address);
    expect(status1.remainingAmount).toBe(DELEGATION_AMOUNT);
    console.log(`Delegation active: remaining=${status1.remainingAmount}`);

    // Step 9: Transfer as delegate (10 tokens)
    console.log('Transferring 10 tokens as delegate...');
    const transferSig = await transferAsDelegate(
      {
        delegateSigner: agent as TransactionSigner,
        sourceTokenAccount: ownerAta,
        destinationTokenAccount: agentAta,
        amount: TRANSFER_AMOUNT,
        decimals: DECIMALS,
        tokenMint: mintKeypair.address,
        feePayer: agent as TransactionSigner,
      },
      RPC_CONFIG,
    );
    console.log(`Transfer signature: ${transferSig}`);

    // Step 10: Check delegation (should show reduced amount)
    const status2 = await checkDelegation(ownerAta, RPC_CONFIG);
    expect(status2.isActive).toBe(true);
    expect(status2.remainingAmount).toBe(DELEGATION_AMOUNT - TRANSFER_AMOUNT);
    console.log(`After transfer: remaining=${status2.remainingAmount}`);

    // Step 11: Revoke delegation
    console.log('Revoking delegation...');
    const revokeTx = await revokeDelegation(
      {
        ownerSigner: owner as TransactionSigner,
        tokenAccount: ownerAta,
      },
      RPC_CONFIG,
    );
    await sendAndConfirm(rpc, revokeTx);

    // Step 12: Check delegation (should be inactive)
    const status3 = await checkDelegation(ownerAta, RPC_CONFIG);
    expect(status3.isActive).toBe(false);
    console.log('Delegation revoked');

    // Step 13: Transfer as delegate should fail
    await expect(
      transferAsDelegate(
        {
          delegateSigner: agent as TransactionSigner,
          sourceTokenAccount: ownerAta,
          destinationTokenAccount: agentAta,
          amount: TRANSFER_AMOUNT,
          decimals: DECIMALS,
          tokenMint: mintKeypair.address,
          feePayer: agent as TransactionSigner,
        },
        RPC_CONFIG,
      ),
    ).rejects.toThrow(DelegationError);

    console.log('Full lifecycle complete!');
  }, 60_000);
});
