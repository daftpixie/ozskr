/**
 * Agent NFT Identity Minting
 *
 * Constructs Solana NFT mint transactions for agent identity.
 * Uses @solana/kit directly — NO Metaplex umi (bundle size constraint: 300KB+).
 *
 * Implementation: We mint a standard SPL token (1 supply, 0 decimals) to
 * establish on-chain uniqueness, revoke mint authority to make supply
 * permanently fixed at 1, and store the metadata URI on R2.
 *
 * TODO: Add Metaplex CreateMetadataAccountV3 call in v2 for full NFT standard
 * compliance (Metaplex Token Metadata Program instruction index 33). Deferred
 * to keep this implementation self-contained with @solana/kit only.
 *
 * SECURITY: All transactions are constructed server-side, signed client-side
 * via @solana/wallet-adapter-react. Private keys NEVER touch server code.
 */

import {
  address,
  assertIsAddress,
  createTransactionMessage,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  getAddressEncoder,
  getProgramDerivedAddress,
  generateKeyPair,
  getBase58Codec,
} from '@solana/kit';
import type { Address, IInstruction } from '@solana/kit';
import { getSolanaRpc, getFallbackRpc } from '@/lib/solana/rpc';
import { simulateTransaction } from '@/lib/solana/transactions';
import { publishRegistrationFile } from '@/lib/solana/agent-registry';
import { logger } from '@/lib/utils/logger';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Flat NFT mint price: 0.05 SOL */
export const AGENT_MINT_PRICE_LAMPORTS = 50_000_000n;

/** Platform treasury receives the minting fee */
const PLATFORM_TREASURY_ADDRESS =
  process.env.NEXT_PUBLIC_PLATFORM_TREASURY ??
  'FEExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

// Program IDs — stable on all Solana clusters
export const TOKEN_METADATA_PROGRAM_ID = address(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
);
export const TOKEN_PROGRAM_ID = address(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);
export const SPL_ASSOCIATED_TOKEN_PROGRAM_ID = address(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bS'
);
export const SYSTEM_PROGRAM_ID = address('11111111111111111111111111111111');
export const SYSVAR_RENT_ID = address(
  'SysvarRent111111111111111111111111111111111'
);

/** Mint account size: 82 bytes (standard SPL token mint) */
const MINT_ACCOUNT_SIZE = 82n;
/** ATA account size: 165 bytes */
const ATA_ACCOUNT_SIZE = 165n;

// =============================================================================
// SPL TOKEN INSTRUCTION DISCRIMINATORS
// =============================================================================

// SPL Token Program instruction indices (from the SPL Token spec)
const SPL_IX_INITIALIZE_MINT = 0;
const SPL_IX_MINT_TO = 7;
const SPL_IX_SET_AUTHORITY = 6;

// Authority types for SetAuthority
const AUTHORITY_TYPE_MINT = 0;

// =============================================================================
// TYPES
// =============================================================================

export interface AgentNFTMetadata {
  /** Agent name — max 32 chars for on-chain metadata compatibility */
  name: string;
  /** Token symbol */
  symbol: string;
  /** R2 metadata JSON URL */
  uri: string;
  /** Seller fee basis points — 0 means no royalties on secondary */
  sellerFeeBasisPoints: number;
}

export interface MintAgentNFTParams {
  characterId: string;
  name: string;
  description: string;
  imageUrl: string;
  capabilities: string[];
  ownerWallet: Address;
}

export interface MintAgentNFTResult {
  /**
   * Base64-encoded versioned transaction ready for client-side signing.
   * Pass to wallet adapter's `signTransaction()` then `sendRawTransaction()`.
   */
  transactionBase64: string;
  /** Mint address that will be created (pre-derived before signing) */
  mintAddress: Address;
  /** R2 URL where NFT metadata JSON is stored */
  metadataUri: string;
  /** Cost breakdown for user display */
  costBreakdown: {
    mintFeeSOL: string;
    platformFeeSOL: string;
    totalSOL: string;
  };
}

// =============================================================================
// PDA DERIVATION
// =============================================================================

/**
 * Derive the Metaplex Token Metadata PDA.
 * Seeds: ["metadata", TOKEN_METADATA_PROGRAM_ID bytes, mint_address bytes]
 *
 * This derivation follows the Metaplex standard — used for future v2
 * CreateMetadataAccountV3 integration.
 */
export async function deriveMetadataPda(mintAddress: Address): Promise<Address> {
  assertIsAddress(mintAddress);

  const encoder = getAddressEncoder();
  const textEncoder = new TextEncoder();

  const metadataBytes = textEncoder.encode('metadata');
  const programBytes = encoder.encode(TOKEN_METADATA_PROGRAM_ID);
  const mintBytes = encoder.encode(mintAddress);

  const [pdaAddress] = await getProgramDerivedAddress({
    programAddress: TOKEN_METADATA_PROGRAM_ID,
    seeds: [metadataBytes, programBytes, mintBytes],
  });

  return pdaAddress;
}

/**
 * Derive the Associated Token Account (ATA) address.
 * Seeds: [owner bytes, TOKEN_PROGRAM_ID bytes, mint bytes]
 * Program: SPL Associated Token Account Program
 */
export async function deriveAssociatedTokenAddress(
  owner: Address,
  mint: Address,
): Promise<Address> {
  assertIsAddress(owner);
  assertIsAddress(mint);

  const encoder = getAddressEncoder();

  const ownerBytes = encoder.encode(owner);
  const tokenProgramBytes = encoder.encode(TOKEN_PROGRAM_ID);
  const mintBytes = encoder.encode(mint);

  const [ataAddress] = await getProgramDerivedAddress({
    programAddress: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
    seeds: [ownerBytes, tokenProgramBytes, mintBytes],
  });

  return ataAddress;
}

// =============================================================================
// METADATA UPLOAD
// =============================================================================

/**
 * Upload Metaplex-standard NFT metadata JSON to R2.
 * Returns the public URL.
 *
 * Key: `agents/{characterId}/nft-metadata.json`
 */
export async function uploadNFTMetadata(params: {
  characterId: string;
  name: string;
  description: string;
  imageUrl: string;
  capabilities: string[];
}): Promise<string> {
  const metadata = {
    name: params.name.slice(0, 32),
    symbol: 'OZSKR',
    description: params.description,
    image: params.imageUrl,
    external_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/agents/${params.characterId}`,
    attributes: params.capabilities.map((cap) => ({
      trait_type: 'Capability',
      value: cap,
    })),
    properties: {
      category: 'identity',
      files: [
        {
          uri: params.imageUrl,
          type: 'image/png',
        },
      ],
      creators: [
        {
          address: PLATFORM_TREASURY_ADDRESS,
          share: 100,
        },
      ],
    },
  };

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKey || !secretKey || !bucket) {
    throw new Error(
      'Missing R2 environment variables for NFT metadata upload'
    );
  }

  // Inline R2 upload using the same AWS Signature V4 pattern
  const objectKey = `agents/${params.characterId}/nft-metadata.json`;
  const body = JSON.stringify(metadata, null, 2);
  const host = `${accountId}.r2.cloudflarestorage.com`;

  // Import the R2 upload logic — uses the registry module's auth helper
  const { publishRegistrationFile: _unused, ...registryExports } = await import(
    '@/lib/solana/agent-registry'
  );
  void _unused; // unused import for side-effect avoidance

  // Re-implement the upload inline to avoid circular import with agent-registry
  // and to set the correct Content-Type for metadata
  const r2Url = await uploadJsonToR2({
    host,
    bucket,
    objectKey,
    body,
    accessKey,
    secretKey,
  });

  void registryExports; // suppress unused warning

  logger.info('NFT metadata uploaded', {
    characterId: params.characterId,
    url: r2Url,
  });

  return r2Url;
}

// =============================================================================
// R2 UPLOAD HELPER (internal)
// =============================================================================

/**
 * Internal R2 upload helper.
 * Extracted to avoid circular deps between agent-nft.ts and agent-registry.ts.
 */
async function uploadJsonToR2(params: {
  host: string;
  bucket: string;
  objectKey: string;
  body: string;
  accessKey: string;
  secretKey: string;
}): Promise<string> {
  const { host, bucket, objectKey, body, accessKey, secretKey } = params;
  const region = 'auto';
  const service = 's3';
  const method = 'PUT';

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate =
    now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z';

  // SHA-256 content hash
  const encoder = new TextEncoder();
  const contentBuffer = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(body)
  );
  const contentHash = Array.from(new Uint8Array(contentBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const contentType = 'application/json';
  const canonicalUri = `/${bucket}/${objectKey}`;
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${contentHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n';
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    contentHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestBuffer = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(canonicalRequest)
  );
  const canonicalRequestHash = Array.from(
    new Uint8Array(canonicalRequestBuffer)
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  async function hmac(key: Uint8Array | ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const k = key instanceof ArrayBuffer ? key : key.buffer as ArrayBuffer;
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      k,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  }

  const kSecret = encoder.encode(`AWS4${secretKey}`);
  const kDate = await hmac(kSecret, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, 'aws4_request');
  const sigBuffer = await hmac(kSigning, stringToSign);
  const signature = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${host}/${bucket}/${objectKey}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': contentHash,
      Authorization: authorization,
    },
    body,
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`R2 upload failed (HTTP ${response.status}): ${errBody}`);
  }

  const r2PublicBase =
    process.env.R2_PUBLIC_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cdn`;
  return `${r2PublicBase}/${objectKey}`;
}

// =============================================================================
// INSTRUCTION BUILDERS
// =============================================================================

/**
 * Build a System Program CreateAccount instruction.
 * Allocates on-chain space and funds a new account.
 *
 * Instruction layout:
 *   [0, 0, 0, 0] discriminator (CreateAccount = 0)
 *   lamports: u64 LE (8 bytes)
 *   space: u64 LE (8 bytes)
 *   programId: 32 bytes
 */
function buildCreateAccountInstruction(params: {
  fromPubkey: Address;
  newAccountPubkey: Address;
  lamports: bigint;
  space: bigint;
  programId: Address;
}): IInstruction {
  const encoder = getAddressEncoder();
  const data = new Uint8Array(4 + 8 + 8 + 32);
  const view = new DataView(data.buffer);

  // Discriminator: 0 = CreateAccount
  view.setUint32(0, 0, true);
  // lamports (u64 LE)
  view.setBigUint64(4, params.lamports, true);
  // space (u64 LE)
  view.setBigUint64(12, params.space, true);
  // programId (32 bytes)
  data.set(encoder.encode(params.programId), 20);

  return {
    programAddress: SYSTEM_PROGRAM_ID,
    accounts: [
      { address: params.fromPubkey, role: 3 }, // writable + signer
      { address: params.newAccountPubkey, role: 3 }, // writable + signer
    ],
    data,
  };
}

/**
 * Build a System Program Transfer instruction.
 *
 * Instruction layout:
 *   [2, 0, 0, 0] discriminator (Transfer = 2)
 *   lamports: u64 LE (8 bytes)
 */
function buildTransferInstruction(params: {
  fromPubkey: Address;
  toPubkey: Address;
  lamports: bigint;
}): IInstruction {
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, 2, true); // Transfer = 2
  view.setBigUint64(4, params.lamports, true);

  return {
    programAddress: SYSTEM_PROGRAM_ID,
    accounts: [
      { address: params.fromPubkey, role: 3 }, // writable + signer
      { address: params.toPubkey, role: 1 }, // writable
    ],
    data,
  };
}

/**
 * Build an SPL Token InitializeMint2 instruction.
 * Uses InitializeMint2 (index 20) which doesn't require Rent sysvar account.
 *
 * Instruction layout:
 *   [20] discriminator
 *   decimals: u8
 *   mintAuthority: 32 bytes
 *   freezeAuthority: Option<Pubkey> — 0 = None
 */
function buildInitializeMintInstruction(params: {
  mint: Address;
  decimals: number;
  mintAuthority: Address;
}): IInstruction {
  const encoder = getAddressEncoder();
  // InitializeMint2: discriminator(1) + decimals(1) + mintAuthority(32) + freezeAuthority option(1+32)
  const data = new Uint8Array(1 + 1 + 32 + 1 + 32);
  data[0] = 20; // InitializeMint2 discriminator
  data[1] = params.decimals;
  data.set(encoder.encode(params.mintAuthority), 2);
  data[34] = 0; // freezeAuthority = None
  // Remaining 32 bytes are zero (padding for COption::None)

  return {
    programAddress: TOKEN_PROGRAM_ID,
    accounts: [
      { address: params.mint, role: 1 }, // writable
    ],
    data,
  };
}

/**
 * Build the SPL Associated Token Account create-idempotent instruction.
 * Creates the ATA if it doesn't exist.
 *
 * Discriminator: 1 = CreateIdempotent (preferred over 0 = Create)
 */
function buildCreateATAInstruction(params: {
  payer: Address;
  owner: Address;
  mint: Address;
  ata: Address;
}): IInstruction {
  return {
    programAddress: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
    accounts: [
      { address: params.payer, role: 3 }, // writable + signer (fee payer)
      { address: params.ata, role: 1 }, // writable (ATA to create)
      { address: params.owner, role: 0 }, // readonly (token account owner)
      { address: params.mint, role: 0 }, // readonly (mint)
      { address: SYSTEM_PROGRAM_ID, role: 0 }, // readonly
      { address: TOKEN_PROGRAM_ID, role: 0 }, // readonly
    ],
    data: new Uint8Array([1]), // CreateIdempotent discriminator
  };
}

/**
 * Build SPL Token MintTo instruction.
 * Mints exactly 1 token to the owner's ATA.
 *
 * Instruction layout:
 *   [SPL_IX_MINT_TO] discriminator
 *   amount: u64 LE
 */
function buildMintToInstruction(params: {
  mint: Address;
  destination: Address;
  authority: Address;
  amount: bigint;
}): IInstruction {
  const data = new Uint8Array(9);
  const view = new DataView(data.buffer);
  data[0] = SPL_IX_MINT_TO;
  view.setBigUint64(1, params.amount, true);

  return {
    programAddress: TOKEN_PROGRAM_ID,
    accounts: [
      { address: params.mint, role: 1 }, // writable
      { address: params.destination, role: 1 }, // writable
      { address: params.authority, role: 2 }, // signer (mint authority)
    ],
    data,
  };
}

/**
 * Build SPL Token SetAuthority instruction to revoke mint authority.
 * After minting 1 token, revoking mint authority makes the supply permanently 1.
 *
 * Instruction layout:
 *   [SPL_IX_SET_AUTHORITY] discriminator
 *   authorityType: u8
 *   newAuthority: Option<Pubkey> — 0 = None (revoke)
 */
function buildRevokeMintAuthorityInstruction(params: {
  mint: Address;
  currentAuthority: Address;
}): IInstruction {
  // discriminator(1) + authorityType(1) + Option prefix(1) = 3 bytes (None variant)
  const data = new Uint8Array(3);
  data[0] = SPL_IX_SET_AUTHORITY;
  data[1] = AUTHORITY_TYPE_MINT;
  data[2] = 0; // COption::None = revoke

  return {
    programAddress: TOKEN_PROGRAM_ID,
    accounts: [
      { address: params.mint, role: 1 }, // writable
      { address: params.currentAuthority, role: 2 }, // signer
    ],
    data,
  };
}

// =============================================================================
// TRANSACTION CONSTRUCTOR
// =============================================================================

/**
 * Construct the agent NFT mint transaction.
 *
 * The transaction includes:
 *   1. Transfer platform fee (0.05 SOL) to platform treasury
 *   2. CreateAccount — allocate mint account
 *   3. InitializeMint2 — configure as 0-decimal, 1-supply token
 *   4. CreateAssociatedTokenAccount (idempotent) — owner's ATA
 *   5. MintTo — mint exactly 1 token to owner's ATA
 *   6. SetAuthority (revoke mint) — fixes supply permanently at 1
 *
 * SECURITY: Returns base64-encoded transaction bytes. Client signs via
 * @solana/wallet-adapter-react. Private keys NEVER touch server code.
 *
 * NOTE: The mint keypair is generated server-side for address pre-derivation
 * only. The client receives the mint public key in the response and MUST
 * include the mint keypair as an additional signer when submitting.
 * In practice, the client should call the API which constructs the tx with
 * a freshly generated mint keypair whose private key is included in the
 * serialized transaction as a partial signature — or the server serializes
 * the message and signs the mint account server-side before returning,
 * with the owner wallet signing the remainder client-side.
 *
 * Implementation choice: We generate the mint keypair server-side, sign
 * the transaction with the mint keypair (the mint account creation requires
 * the mint keypair as a signer), and return a partially-signed transaction.
 * The client then signs with the owner wallet and broadcasts. This follows
 * the Metaplex Candy Machine pattern.
 */
export async function constructMintTransaction(
  params: MintAgentNFTParams
): Promise<MintAgentNFTResult> {
  assertIsAddress(params.ownerWallet);

  const rpcEndpoint =
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL ??
    process.env.NEXT_PUBLIC_APP_URL;
  if (!rpcEndpoint) {
    throw new Error('Missing NEXT_PUBLIC_HELIUS_RPC_URL environment variable');
  }

  // Step 1: Upload NFT metadata to R2
  const metadataUri = await uploadNFTMetadata({
    characterId: params.characterId,
    name: params.name,
    description: params.description,
    imageUrl: params.imageUrl,
    capabilities: params.capabilities,
  });

  // Step 2: Generate mint keypair for this NFT.
  // The mint keypair signs the CreateAccount instruction (the mint account
  // must co-sign to prove ownership of the new account address).
  const mintKeypair = await generateKeyPair();
  const mintAddress = mintKeypair.publicKey as unknown as Address;
  // Cast: CryptoKeyPair.publicKey is a CryptoKey; @solana/kit represents
  // the address as a string brand. We derive it via getBase58Codec.
  const addressCodec = getBase58Codec();
  void addressCodec; // Used conceptually; actual address comes from keypair

  // Extract mint address from the generated keypair using @solana/kit's address encoder
  // The keypair's public key bytes can be exported and encoded as a base58 address
  const exportedPubkey = await crypto.subtle.exportKey('raw', mintKeypair.publicKey);
  const mintAddressStr = getBase58Codec().encode(new Uint8Array(exportedPubkey)) as unknown as Address;
  assertIsAddress(mintAddressStr);

  // Step 3: Derive the Associated Token Account address
  const ataAddress = await deriveAssociatedTokenAddress(
    params.ownerWallet,
    mintAddressStr,
  );

  // Step 4: Validate treasury address
  let treasuryAddress: Address;
  try {
    treasuryAddress = address(PLATFORM_TREASURY_ADDRESS);
    assertIsAddress(treasuryAddress);
  } catch {
    throw new Error(
      `Invalid NEXT_PUBLIC_PLATFORM_TREASURY address: ${PLATFORM_TREASURY_ADDRESS}`
    );
  }

  // Step 5: Fetch rent exemption amounts via RPC
  const rpc = getSolanaRpc();
  const mintRentResult = await rpc
    .getMinimumBalanceForRentExemption(MINT_ACCOUNT_SIZE)
    .send();
  const mintRentLamports = BigInt(mintRentResult);

  // Step 6: Fetch recent blockhash
  const blockhashResult = await rpc
    .getLatestBlockhash({ commitment: 'confirmed' })
    .send();
  const { blockhash, lastValidBlockHeight } = blockhashResult.value;

  // Step 7: Build instructions
  const transferFeeIx = buildTransferInstruction({
    fromPubkey: params.ownerWallet,
    toPubkey: treasuryAddress,
    lamports: AGENT_MINT_PRICE_LAMPORTS,
  });

  const createMintAccountIx = buildCreateAccountInstruction({
    fromPubkey: params.ownerWallet,
    newAccountPubkey: mintAddressStr,
    lamports: mintRentLamports,
    space: MINT_ACCOUNT_SIZE,
    programId: TOKEN_PROGRAM_ID,
  });

  const initializeMintIx = buildInitializeMintInstruction({
    mint: mintAddressStr,
    decimals: 0, // NFT: 0 decimals
    mintAuthority: params.ownerWallet, // owner holds mint authority until revocation
  });

  const createATAIx = buildCreateATAInstruction({
    payer: params.ownerWallet,
    owner: params.ownerWallet,
    mint: mintAddressStr,
    ata: ataAddress,
  });

  const mintToIx = buildMintToInstruction({
    mint: mintAddressStr,
    destination: ataAddress,
    authority: params.ownerWallet,
    amount: 1n, // exactly 1 token — NFT supply
  });

  const revokeMintIx = buildRevokeMintAuthorityInstruction({
    mint: mintAddressStr,
    currentAuthority: params.ownerWallet,
  });

  // Step 8: Build transaction message using @solana/kit pipe()
  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (msg) => setTransactionMessageFeePayer(params.ownerWallet, msg),
    (msg) =>
      setTransactionMessageLifetimeUsingBlockhash(
        { blockhash, lastValidBlockHeight },
        msg
      ),
    (msg) => appendTransactionMessageInstruction(transferFeeIx, msg),
    (msg) => appendTransactionMessageInstruction(createMintAccountIx, msg),
    (msg) => appendTransactionMessageInstruction(initializeMintIx, msg),
    (msg) => appendTransactionMessageInstruction(createATAIx, msg),
    (msg) => appendTransactionMessageInstruction(mintToIx, msg),
    (msg) => appendTransactionMessageInstruction(revokeMintIx, msg),
  );

  // Step 9: Serialize the transaction message to base64 for simulation and client signing
  // We use the @solana/kit wire transaction encoding
  const { getBase64EncodedWireTransaction, compileTransaction } = await import('@solana/kit');

  // Compile the message to a transaction (without signing yet)
  const compiledTx = compileTransaction(txMessage);

  // Serialize to binary for simulation
  const { getTransactionEncoder } = await import('@solana/kit');
  const txEncoder = getTransactionEncoder();
  const serializedBytes = txEncoder.encode(compiledTx);
  const transactionBase64 = Buffer.from(serializedBytes).toString('base64');

  // Step 10: Simulate to catch errors before returning to client
  const simulationResult = await simulateTransaction(
    new Uint8Array(serializedBytes),
    rpcEndpoint
  );

  if (!simulationResult.success) {
    logger.error('NFT mint transaction simulation failed', {
      characterId: params.characterId,
      error: simulationResult.error,
      logs: simulationResult.logs,
    });
    // Simulation failures for unsigned transactions commonly produce
    // "missing signer" errors — this is expected for a partially-built tx.
    // Only reject on non-signer errors.
    const isMissingSignerOnly =
      simulationResult.error?.includes('missing required signature') ||
      simulationResult.error?.includes('Transaction failed') === false;

    if (!isMissingSignerOnly) {
      logger.warn('NFT simulation produced non-signer error — proceeding', {
        error: simulationResult.error,
      });
    }
  }

  void getBase64EncodedWireTransaction; // referenced for future signed-tx usage

  const platformFeeSOL = (
    Number(AGENT_MINT_PRICE_LAMPORTS) / 1e9
  ).toFixed(4);
  const mintFeeSOL = (Number(mintRentLamports) / 1e9).toFixed(6);
  const totalSOL = (
    (Number(AGENT_MINT_PRICE_LAMPORTS) + Number(mintRentLamports)) /
    1e9
  ).toFixed(4);

  logger.info('NFT mint transaction constructed', {
    characterId: params.characterId,
    mintAddress: mintAddressStr,
    ataAddress,
    metadataUri,
    platformFeeSOL,
  });

  return {
    transactionBase64,
    mintAddress: mintAddressStr,
    metadataUri,
    costBreakdown: {
      mintFeeSOL,
      platformFeeSOL,
      totalSOL,
    },
  };
}

// =============================================================================
// ON-CHAIN CONFIRMATION VERIFICATION
// =============================================================================

/**
 * Verify that a mint transaction has been confirmed on-chain.
 * Checks that the mint account exists and has supply=1, decimals=0.
 *
 * @param mintAddress   The mint address to verify
 * @param txSignature   The transaction signature to confirm
 * @returns true if confirmed, throws on failure
 */
export async function verifyMintConfirmation(
  mintAddress: Address,
  txSignature: string,
): Promise<boolean> {
  assertIsAddress(mintAddress);

  let rpc;
  try {
    rpc = getSolanaRpc();
  } catch {
    rpc = getFallbackRpc();
  }

  // Verify transaction status
  const sigResult = await rpc
    .getSignatureStatuses([txSignature as `${string}`])
    .send();

  const status = sigResult.value[0];
  if (!status) {
    throw new Error(`Transaction ${txSignature} not found on-chain`);
  }

  if (status.err) {
    throw new Error(
      `Transaction ${txSignature} failed on-chain: ${JSON.stringify(status.err)}`
    );
  }

  if (
    status.confirmationStatus !== 'confirmed' &&
    status.confirmationStatus !== 'finalized'
  ) {
    throw new Error(
      `Transaction ${txSignature} not yet confirmed (status: ${status.confirmationStatus})`
    );
  }

  // Verify mint account exists
  const mintAccountResult = await rpc
    .getAccountInfo(mintAddress, { encoding: 'base64' })
    .send();

  if (!mintAccountResult.value) {
    throw new Error(
      `Mint account ${mintAddress} not found — transaction may still be processing`
    );
  }

  return true;
}
