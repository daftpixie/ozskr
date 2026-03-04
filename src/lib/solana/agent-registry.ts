/**
 * Solana Agent Registry
 * ERC-8004-compatible agent identity registration
 *
 * No SDK exists for the Solana Agent Registry — we implement the
 * registration file standard directly and store on Cloudflare R2.
 * Agent ID uses CAIP-2 format: solana:<genesis-hash>/<mint-address>
 *
 * R2 upload uses the S3-compatible REST API via fetch (no @aws-sdk/client-s3
 * in the project — avoids the ~200KB bundle overhead).
 */

import { logger } from '@/lib/utils/logger';

// =============================================================================
// CONSTANTS
// =============================================================================

// Solana genesis hashes for CAIP-2 agent IDs
const SOLANA_MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const SOLANA_DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';

const REGISTRATION_FILE_SCHEMA_VERSION = '1.0.0';
const PLATFORM_NAME = 'ozskr.ai';

// =============================================================================
// TYPES
// =============================================================================

export interface AgentRegistrationFile {
  /** CAIP-2 agent identity: "solana:<genesis>/<mint-address>" */
  agentId: string;
  name: string;
  description: string;
  version: string;
  /** Supported capabilities e.g. ["content-generation", "social-publishing"] */
  capabilities: string[];
  serviceEndpoints: {
    mcp?: string;
    a2a?: string;
    x402?: string;
  };
  x402Support: boolean;
  walletBinding: {
    /** Delegated agent wallet pubkey */
    address: string;
    /** CAIP-2 chain: "solana:<genesis>" */
    chain: string;
  };
  validation: {
    method: string;
    provider: string;
  };
  social: {
    tapestryProfile?: string;
    platforms: string[];
  };
  metadata: {
    createdAt: string;
    platform: string;
    version: string;
  };
}

export interface PublishRegistrationResult {
  url: string;
  key: string;
}

// =============================================================================
// AGENT ID
// =============================================================================

/**
 * Build a CAIP-2 agent ID from a mint address.
 * Format: solana:<genesis-hash>/<mint-address>
 */
export function buildAgentId(mintAddress: string): string {
  const genesis =
    process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta'
      ? SOLANA_MAINNET_GENESIS
      : SOLANA_DEVNET_GENESIS;
  return `solana:${genesis}/${mintAddress}`;
}

/**
 * Extract the chain component from an agent ID.
 * Returns e.g. "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
 */
function buildChainId(): string {
  const genesis =
    process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta'
      ? SOLANA_MAINNET_GENESIS
      : SOLANA_DEVNET_GENESIS;
  return `solana:${genesis}`;
}

// =============================================================================
// REGISTRATION FILE BUILDER
// =============================================================================

/**
 * Generate an ERC-8004-compatible agent registration file.
 * The file is a JSON object describing the agent's identity and capabilities.
 */
export function generateRegistrationFile(params: {
  mintAddress: string;
  characterId: string;
  name: string;
  persona: string;
  capabilities: string[];
  agentWalletPubkey?: string;
  tapestryProfile?: string;
  socialPlatforms?: string[];
}): AgentRegistrationFile {
  const agentId = buildAgentId(params.mintAddress);
  const chainId = buildChainId();

  return {
    agentId,
    name: params.name,
    description: params.persona,
    version: REGISTRATION_FILE_SCHEMA_VERSION,
    capabilities: params.capabilities,
    serviceEndpoints: {
      // MCP endpoint: agents with MCP support append their characterId path
      mcp: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/mcp/${params.characterId}`,
    },
    x402Support: false, // Phase 8 — commerce layer activation-gated
    walletBinding: {
      address: params.agentWalletPubkey ?? '',
      chain: chainId,
    },
    validation: {
      // Attestation model — TEE integration is Phase 8+
      method: 'platform-attestation',
      provider: PLATFORM_NAME,
    },
    social: {
      tapestryProfile: params.tapestryProfile,
      platforms: params.socialPlatforms ?? [],
    },
    metadata: {
      createdAt: new Date().toISOString(),
      platform: PLATFORM_NAME,
      version: REGISTRATION_FILE_SCHEMA_VERSION,
    },
  };
}

// =============================================================================
// R2 UPLOAD
// =============================================================================

/**
 * Compute an HMAC-SHA256 signature for the AWS Signature V4 process.
 * Uses the Web Crypto API (available in both Edge and Node.js 18+).
 */
async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key instanceof ArrayBuffer ? key : key.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const encoder = new TextEncoder();
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

/**
 * Convert ArrayBuffer to lowercase hex string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compute SHA-256 hash of a string and return as hex.
 */
async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return bufferToHex(buffer);
}

/**
 * Build an AWS Signature V4 Authorization header for R2 PUT requests.
 * Cloudflare R2 accepts S3-compatible requests with V4 signatures.
 *
 * @param method    HTTP method (always PUT for uploads)
 * @param bucket    R2 bucket name
 * @param key       Object key (path within bucket)
 * @param body      Request body content
 * @param host      R2 endpoint host (without https://)
 * @param accessKey R2 access key ID
 * @param secretKey R2 secret access key
 */
async function buildR2Authorization(
  method: string,
  bucket: string,
  key: string,
  body: string,
  host: string,
  accessKey: string,
  secretKey: string,
): Promise<{ authorization: string; amzDate: string; contentHash: string }> {
  const region = 'auto';
  const service = 's3';

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const amzDate = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z'; // YYYYMMDDTHHMMSSZ

  const contentHash = await sha256Hex(body);
  const contentType = 'application/json';

  // Canonical request
  const canonicalUri = `/${bucket}/${key}`;
  const canonicalQueryString = '';
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
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    contentHash,
  ].join('\n');

  // String to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = [algorithm, amzDate, credentialScope, canonicalRequestHash].join('\n');

  // Signing key derivation
  const encoder = new TextEncoder();
  const kSecret = encoder.encode(`AWS4${secretKey}`);
  const kDate = await hmacSha256(kSecret, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signatureBuffer = await hmacSha256(kSigning, stringToSign);
  const signature = bufferToHex(signatureBuffer);

  const authorization =
    `${algorithm} Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { authorization, amzDate, contentHash };
}

/**
 * Upload an agent registration file to Cloudflare R2.
 * Stores at key: `agents/{characterId}/registry.json`
 * Returns the public URL for the uploaded file.
 *
 * Uses S3-compatible REST API with AWS Signature V4 — no @aws-sdk/client-s3 needed.
 */
export async function publishRegistrationFile(
  characterId: string,
  file: AgentRegistrationFile,
): Promise<PublishRegistrationResult> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  if (!accountId || !accessKey || !secretKey || !bucket) {
    throw new Error(
      'Missing required R2 environment variables: CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME'
    );
  }

  const objectKey = `agents/${characterId}/registry.json`;
  const body = JSON.stringify(file, null, 2);
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}`;

  const { authorization, amzDate, contentHash } = await buildR2Authorization(
    'PUT',
    bucket,
    objectKey,
    body,
    host,
    accessKey,
    secretKey,
  );

  const url = `${endpoint}/${bucket}/${objectKey}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-amz-date': amzDate,
      'x-amz-content-sha256': contentHash,
      Authorization: authorization,
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    logger.error('R2 upload failed', {
      status: response.status,
      key: objectKey,
      error: errorBody,
    });
    throw new Error(`R2 upload failed (HTTP ${response.status}): ${errorBody}`);
  }

  // Public URL — uses the app domain as the R2 public bucket URL base.
  // Cloudflare R2 public buckets are served at the custom domain configured in the dashboard.
  // Format: <NEXT_PUBLIC_APP_URL>/cdn/<key> or R2_PUBLIC_URL if configured.
  const r2PublicBase = process.env.R2_PUBLIC_URL ?? `${appUrl}/cdn`;
  const publicUrl = `${r2PublicBase}/${objectKey}`;

  logger.info('Agent registration file published', {
    characterId,
    agentId: file.agentId,
    key: objectKey,
    url: publicUrl,
  });

  return { url: publicUrl, key: objectKey };
}
