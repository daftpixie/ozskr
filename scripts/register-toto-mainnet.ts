/**
 * register-toto-mainnet.ts
 *
 * One-time script: Register Toto's agent identity on the Solana Agent Registry (mainnet-beta).
 *
 * Flow:
 *   1. Validate environment variables
 *   2. Upload Toto's metadata JSON to IPFS via Pinata
 *   3. Register a new agent NFT on the Solana Agent Registry using 8004-solana SDK
 *   4. Print the asset address and Solana Explorer URL
 *   5. Write result to scripts/toto-nft-result.json
 *
 * SDK quirks discovered:
 *   - 8004-solana v0.7.9 uses @solana/web3.js v1 (Keypair, Connection, PublicKey),
 *     NOT @solana/kit. No bridging via @solana/compat is required here because this
 *     is a standalone script — we import @solana/web3.js directly alongside @solana/kit.
 *   - SolanaSDK.registerAgent() returns TransactionResult & { asset?: PublicKey } on
 *     live send, or PreparedTransaction & { asset: PublicKey } when skipSend=true.
 *   - The OASF skill/domain taxonomy used by the SDK does NOT match the prompt's
 *     assumed tags (e.g. "business/finance/grant_writing" is NOT valid). Valid tags
 *     were validated via getAllSkills() / getAllDomains() at script-write time.
 *   - When skipSend=true (dry-run), registerAgent still needs Connection + cluster
 *     to fetch a recent blockhash for the serialized tx, so a real RPC connection
 *     is required even in dry-run mode.
 *   - The SDK's Keypair signer is a @solana/web3.js Keypair decoded from base58.
 *
 * Usage:
 *   # Dry run (no on-chain tx):
 *   npx tsx scripts/register-toto-mainnet.ts --dry-run
 *
 *   # Live run (Matt runs this manually):
 *   HELIUS_RPC_URL=https://... PINATA_JWT=... AGENT_AUTHORITY_PRIVATE_KEY=... \
 *     npx tsx scripts/register-toto-mainnet.ts
 *
 * Required env vars:
 *   HELIUS_RPC_URL              Helius mainnet RPC endpoint
 *   PINATA_JWT                  Pinata API JWT for IPFS upload
 *   AGENT_AUTHORITY_PRIVATE_KEY Base58-encoded Solana keypair (the registrant/signer)
 *
 * SECURITY: Private key only lives in memory for the duration of this script.
 *           Never stored, never logged, never sent over the wire.
 *           For live runs, pass via env var at the shell — do NOT commit to .env files.
 */

// ---------------------------------------------------------------------------
// NOTE: This script intentionally imports @solana/web3.js v1 because the
// 8004-solana SDK requires it. @solana/kit is NOT used here — this is a
// standalone script outside the app bundle. The @solana/compat bridge is
// therefore unnecessary.
// ---------------------------------------------------------------------------

import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { SolanaSDK } from '8004-solana';
import type { TransactionResult, PreparedTransaction } from '8004-solana';
import * as fs from 'fs/promises';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Toto's agent metadata in Pinata pinning format.
 *
 * Skills and domains use valid OASF taxonomy tags as validated by
 * 8004-solana's getAllSkills() / getAllDomains() / validateSkill() /
 * validateDomain() at script-write time.
 *
 * Original prompt tags (INVALID — not in OASF taxonomy):
 *   "business/finance/grant_writing"
 *   "business/marketing/content_strategy"
 *   "natural_language_processing/text_generation/text_generation"
 *   "technology/blockchain/solana"
 *   "business/finance/funding"
 *
 * Valid replacements used here:
 *   Skills:
 *     advanced_reasoning_planning/strategic_planning
 *     natural_language_processing/natural_language_generation/natural_language_generation
 *     natural_language_processing/information_retrieval_synthesis/knowledge_synthesis
 *   Domains:
 *     finance_and_business/finance
 *     technology/blockchain/blockchain
 */
const TOTO_METADATA = {
  name: 'Toto',
  description:
    'Funding strategist for ozskr.ai — non-dilutive funding, grant applications, revenue strategy across the Solana ecosystem.',
  skills: [
    'advanced_reasoning_planning/strategic_planning',
    'natural_language_processing/natural_language_generation/natural_language_generation',
    'natural_language_processing/information_retrieval_synthesis/knowledge_synthesis',
  ],
  domains: [
    'finance_and_business/finance',
    'technology/blockchain/blockchain',
  ],
  version: '1.0.0',
  platform: 'ozskr.ai',
};

const RESULT_FILE = path.resolve('/home/matt/projects/ozskr/scripts/toto-nft-result.json');

// ---------------------------------------------------------------------------
// Env validation
// ---------------------------------------------------------------------------

interface EnvConfig {
  rpcUrl: string;
  pinataJwt: string;
  privateKeyBase58: string;
}

function validateEnv(): EnvConfig {
  const rpcUrl =
    process.env.HELIUS_RPC_URL ??
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL;

  const pinataJwt = process.env.PINATA_JWT;
  const privateKeyBase58 = process.env.AGENT_AUTHORITY_PRIVATE_KEY;

  const missing: string[] = [];

  if (!rpcUrl) missing.push('HELIUS_RPC_URL (or NEXT_PUBLIC_HELIUS_RPC_URL)');
  if (!pinataJwt) missing.push('PINATA_JWT');
  if (!privateKeyBase58) missing.push('AGENT_AUTHORITY_PRIVATE_KEY');

  if (missing.length > 0) {
    console.error('ERROR: Missing required environment variables:');
    for (const m of missing) {
      console.error(`  - ${m}`);
    }
    console.error('');
    console.error('For dry-run (no on-chain tx), stub values are accepted:');
    console.error(
      '  HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=STUB \\',
    );
    console.error('  PINATA_JWT=STUB \\');
    console.error(
      '  AGENT_AUTHORITY_PRIVATE_KEY=<base58-keypair> \\',
    );
    console.error('  npx tsx scripts/register-toto-mainnet.ts --dry-run');
    process.exit(1);
  }

  return {
    rpcUrl: rpcUrl!,
    pinataJwt: pinataJwt!,
    privateKeyBase58: privateKeyBase58!,
  };
}

// ---------------------------------------------------------------------------
// Keypair loading
// ---------------------------------------------------------------------------

/**
 * Decode a base58-encoded 64-byte Solana keypair into a @solana/web3.js Keypair.
 * The 64-byte format is: [32-byte secret key || 32-byte public key].
 */
function loadKeypairFromBase58(base58Key: string): Keypair {
  let secretBytes: Uint8Array;
  try {
    secretBytes = bs58.decode(base58Key);
  } catch (err) {
    throw new Error(
      `AGENT_AUTHORITY_PRIVATE_KEY is not valid base58: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (secretBytes.length !== 64) {
    throw new Error(
      `AGENT_AUTHORITY_PRIVATE_KEY must be a 64-byte keypair (got ${secretBytes.length} bytes). ` +
        'Use the full keypair bytes, not just the 32-byte secret scalar.',
    );
  }

  return Keypair.fromSecretKey(secretBytes);
}

// ---------------------------------------------------------------------------
// IPFS upload via Pinata
// ---------------------------------------------------------------------------

/**
 * Upload a JSON object to IPFS via Pinata's pinning API.
 * Returns the IPFS URI: ipfs://<CID>
 */
async function uploadToIPFS(metadata: object): Promise<string> {
  console.log('Uploading metadata to IPFS via Pinata...');

  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name: 'toto-agent-metadata.json' },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Pinata upload failed (HTTP ${response.status}): ${body}`,
    );
  }

  const result = (await response.json()) as { IpfsHash: string };

  if (!result.IpfsHash) {
    throw new Error(
      `Pinata response missing IpfsHash field: ${JSON.stringify(result)}`,
    );
  }

  const uri = `ipfs://${result.IpfsHash}`;
  console.log(`Metadata pinned: ${uri}`);
  return uri;
}

// ---------------------------------------------------------------------------
// Priority fee estimation via Helius
// ---------------------------------------------------------------------------

/**
 * Estimate a recommended priority fee using Helius getPriorityFeeEstimate.
 * Returns microlamports. Falls back to 50_000 if the RPC call fails.
 *
 * This is informational only in this script — the 8004-solana SDK manages
 * its own compute unit budget. We print it so Matt can assess cost before
 * executing the live run.
 */
async function estimatePriorityFee(rpcUrl: string): Promise<bigint> {
  const FALLBACK = 50_000n;

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getPriorityFeeEstimate',
        params: [
          {
            // No specific account keys — we want a general estimate
            accountKeys: [],
            options: { recommended: true },
          },
        ],
      }),
    });

    if (!response.ok) return FALLBACK;

    const data = (await response.json()) as {
      result?: { priorityFeeEstimate?: number };
    };

    const fee = data.result?.priorityFeeEstimate;
    if (typeof fee === 'number' && fee > 0) {
      return BigInt(Math.ceil(fee));
    }

    return FALLBACK;
  } catch {
    return FALLBACK;
  }
}

// ---------------------------------------------------------------------------
// Transaction cost estimation
// ---------------------------------------------------------------------------

interface TransactionCostEstimate {
  baseFee: bigint;
  priorityFee: bigint;
  totalEstimate: bigint;
  displayAmount: string;
}

function formatSol(lamports: bigint): string {
  const whole = lamports / 1_000_000_000n;
  const frac = lamports % 1_000_000_000n;
  return `${whole}.${frac.toString().padStart(9, '0')} SOL`;
}

// ---------------------------------------------------------------------------
// Type guards for SDK return types
// ---------------------------------------------------------------------------

function isPreparedTransaction(
  result: unknown,
): result is PreparedTransaction & { asset: PublicKey } {
  return (
    typeof result === 'object' &&
    result !== null &&
    'transaction' in result &&
    'asset' in result &&
    (result as { signed: unknown }).signed === false
  );
}

function isTransactionResult(
  result: unknown,
): result is TransactionResult & { asset?: PublicKey; signatures?: string[] } {
  return (
    typeof result === 'object' &&
    result !== null &&
    'signature' in result &&
    'success' in result
  );
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

interface RegistrationResult {
  assetAddress: string;
  metadataUri: string;
  txSignature?: string;
  explorerUrl: string;
  timestamp: string;
  dryRun: boolean;
  preparedTransaction?: string;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== Toto Agent NFT — Solana Agent Registry (mainnet-beta) ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no on-chain transaction)' : 'LIVE — will submit transaction'}`);
  console.log('');

  // 1. Validate env
  const env = validateEnv();

  // 2. Load authority keypair
  //    SECURITY: secret bytes live only in memory, never logged
  let authority: Keypair;
  try {
    authority = loadKeypairFromBase58(env.privateKeyBase58);
  } catch (err) {
    console.error(
      `ERROR: Failed to load keypair: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  const authorityAddress = authority.publicKey.toBase58();
  console.log(`Authority wallet: ${authorityAddress}`);
  console.log(`Network:          mainnet-beta`);
  console.log(`RPC:              ${env.rpcUrl.replace(/api[-_]?key=[^&]+/i, 'api-key=<redacted>')}`);
  console.log('');

  // 3. Estimate priority fee (informational)
  console.log('Fetching priority fee estimate...');
  const priorityFee = await estimatePriorityFee(env.rpcUrl);
  const baseFee = 5_000n; // standard 5000 lamport base fee per signature
  const costEstimate: TransactionCostEstimate = {
    baseFee,
    priorityFee,
    totalEstimate: baseFee + priorityFee,
    displayAmount: formatSol(baseFee + priorityFee),
  };

  console.log('Estimated transaction cost:');
  console.log(`  Base fee:      ${formatSol(costEstimate.baseFee)}`);
  console.log(`  Priority fee:  ${costEstimate.priorityFee} microlamports (~${formatSol(costEstimate.priorityFee / 1000n)})`);
  console.log(`  Total:         ${costEstimate.displayAmount}`);
  console.log('  Note: The 8004-solana SDK adds compute unit budget instructions.');
  console.log('        Actual cost may differ slightly from this estimate.');
  console.log('');

  // 4. Upload metadata to IPFS
  let metadataUri: string;

  if (DRY_RUN) {
    // In dry-run mode, skip actual Pinata upload if JWT is a stub
    if (env.pinataJwt === 'STUB' || env.pinataJwt.length < 20) {
      metadataUri = 'ipfs://DRY_RUN_PLACEHOLDER_CID';
      console.log(`[DRY RUN] Skipping Pinata upload — would pin: ${JSON.stringify(TOTO_METADATA, null, 2)}`);
      console.log(`[DRY RUN] Metadata URI would be: ${metadataUri}`);
    } else {
      // Real JWT provided even in dry-run — upload but still skip the tx
      metadataUri = await uploadToIPFS(TOTO_METADATA);
    }
  } else {
    metadataUri = await uploadToIPFS(TOTO_METADATA);
  }

  console.log('');

  // 5. Build SDK client
  //    8004-solana uses @solana/web3.js v1 Connection internally.
  //    We pass rpcUrl and cluster to SolanaSDK which creates the Connection.
  console.log('Initializing 8004-solana SDK...');

  const sdk = new SolanaSDK({
    cluster: 'mainnet-beta',
    rpcUrl: env.rpcUrl,
    signer: authority,
    // No ipfsClient — we handled IPFS upload ourselves via Pinata above,
    // and pass the resulting URI directly to registerAgent().
    forceOnChain: true, // Bypass indexer for writes; we only need on-chain
  });

  console.log('SDK initialized.');
  console.log('');

  // 6. Print what will be submitted
  console.log('Registration payload:');
  console.log(`  Agent URI (metadata): ${metadataUri}`);
  console.log(`  Signer/owner:         ${authorityAddress}`);
  console.log(`  Network:              mainnet-beta`);
  console.log(`  Program:              ${
    // MAINNET_AGENT_REGISTRY_PROGRAM_ID is the identity registry program
    // Value: FLod5vBGm3L3Prnsefmf7LbBkKAf3GxNNNfaXoBFVuW (from 8004-solana constants)
    'FLod5vBGm3L3Prnsefmf7LbBkKAf3GxNNNfaXoBFVuW'
  }`);
  console.log('');

  if (DRY_RUN) {
    // -----------------------------------------------------------------------
    // DRY RUN: prepare the transaction without sending it
    // -----------------------------------------------------------------------
    console.log('[DRY RUN] Preparing transaction (skipSend=true)...');

    let prepResult: Awaited<ReturnType<typeof sdk.registerAgent>>;
    try {
      prepResult = await sdk.registerAgent(metadataUri, {
        skipSend: true,
      });
    } catch (err) {
      console.error(
        `[DRY RUN] ERROR: registerAgent (skipSend) failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      console.error(
        'This may indicate an RPC connection issue or invalid metadata URI.',
      );
      process.exit(1);
    }

    if (!isPreparedTransaction(prepResult)) {
      console.error(
        '[DRY RUN] ERROR: Unexpected return type from registerAgent(skipSend=true):',
        prepResult,
      );
      process.exit(1);
    }

    const assetAddress = prepResult.asset.toBase58();
    const explorerUrl = `https://explorer.solana.com/address/${assetAddress}?cluster=mainnet-beta`;

    console.log('');
    console.log('[DRY RUN] Transaction prepared successfully.');
    console.log('');
    console.log('=== DRY RUN RESULT ===');
    console.log(`Asset address (NFT):  ${assetAddress}`);
    console.log(`Explorer URL:         ${explorerUrl}`);
    console.log(`Metadata URI:         ${metadataUri}`);
    console.log(`Blockhash:            ${prepResult.blockhash}`);
    console.log(`Last valid height:    ${prepResult.lastValidBlockHeight}`);
    console.log(`Required signers:     ${prepResult.requiredSigners?.join(', ') ?? prepResult.signer}`);
    console.log(`Transaction signed:   ${prepResult.signed} (must be signed before send)`);
    console.log('');
    console.log('Transaction base64 (first 80 chars):');
    console.log(`  ${prepResult.transaction.slice(0, 80)}...`);
    console.log('');
    console.log('To execute on mainnet, run WITHOUT --dry-run:');
    console.log(
      '  HELIUS_RPC_URL=... PINATA_JWT=... AGENT_AUTHORITY_PRIVATE_KEY=... \\',
    );
    console.log('  npx tsx scripts/register-toto-mainnet.ts');

    const result: RegistrationResult = {
      assetAddress,
      metadataUri,
      explorerUrl,
      timestamp: new Date().toISOString(),
      dryRun: true,
      preparedTransaction: prepResult.transaction,
    };

    await fs.writeFile(RESULT_FILE, JSON.stringify(result, null, 2), 'utf-8');
    console.log('');
    console.log(`Result written to: ${RESULT_FILE}`);
  } else {
    // -----------------------------------------------------------------------
    // LIVE RUN: submit the transaction
    // -----------------------------------------------------------------------
    console.log('Submitting registration transaction...');
    console.log('IMPORTANT: This will create a permanent on-chain record.');
    console.log('');

    // Simulate first using a raw RPC call before delegating to SDK
    // The SDK does not expose a simulation path — we perform a lightweight
    // check by fetching the account info for the authority to confirm it
    // has SOL to cover fees.
    const connection = new Connection(env.rpcUrl, 'confirmed');
    const balance = await connection.getBalance(authority.publicKey);
    const balanceLamports = BigInt(balance);

    console.log(`Authority SOL balance: ${formatSol(balanceLamports)}`);

    if (balanceLamports < 10_000_000n) {
      console.error(
        `ERROR: Authority wallet has insufficient SOL (${formatSol(balanceLamports)}). ` +
          'Need at least 0.01 SOL to cover rent + fees for registration.',
      );
      process.exit(1);
    }

    let txResult: Awaited<ReturnType<typeof sdk.registerAgent>>;
    try {
      txResult = await sdk.registerAgent(metadataUri, {
        // SDK default: skipSend=false — will sign and send
        atomEnabled: false, // ATOM reputation tracking not needed at registration time
      });
    } catch (err) {
      console.error(
        `ERROR: registerAgent failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      process.exit(1);
    }

    if (!isTransactionResult(txResult)) {
      console.error(
        'ERROR: Unexpected return type from registerAgent():',
        txResult,
      );
      process.exit(1);
    }

    if (!txResult.success) {
      console.error(`ERROR: Transaction failed: ${txResult.error ?? '(no error message)'}`);
      process.exit(1);
    }

    const assetAddress = txResult.asset?.toBase58() ?? '(asset not returned)';
    const explorerUrl = `https://explorer.solana.com/address/${assetAddress}?cluster=mainnet-beta`;
    const txExplorerUrl = `https://explorer.solana.com/tx/${txResult.signature}?cluster=mainnet-beta`;

    console.log('');
    console.log('=== REGISTRATION SUCCESSFUL ===');
    console.log(`Asset address (NFT):  ${assetAddress}`);
    console.log(`Transaction sig:      ${txResult.signature}`);
    console.log(`Explorer (asset):     ${explorerUrl}`);
    console.log(`Explorer (tx):        ${txExplorerUrl}`);
    console.log(`Metadata URI:         ${metadataUri}`);
    console.log('');

    const result: RegistrationResult = {
      assetAddress,
      metadataUri,
      txSignature: txResult.signature,
      explorerUrl,
      timestamp: new Date().toISOString(),
      dryRun: false,
    };

    await fs.writeFile(RESULT_FILE, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`Result written to: ${RESULT_FILE}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Verify the asset on Solana Explorer (link above).');
    console.log('  2. Update TOTO_NFT_ASSET_ADDRESS in environment config.');
    console.log('  3. Call sdk.setMetadata() to attach OASF skill/domain tags on-chain.');
  }
}

main().catch((err) => {
  console.error('');
  console.error('FATAL:', err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
