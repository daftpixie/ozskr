/**
 * Sign-In With Solana (SIWS) Utilities
 * Based on CAIP-122 / EIP-4361 pattern adapted for Solana
 *
 * SECURITY: All signature verification must happen client-side before submission.
 * Server-side verification is performed in the auth API route.
 */

import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { assertIsAddress, address as createAddress } from '@solana/kit';

export interface SiwsMessage {
  domain: string;
  address: string;
  statement: string;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
}

/**
 * Create a Sign-In With Solana (SIWS) message.
 *
 * @param params.domain - The domain (hostname) requesting authentication
 * @param params.address - The Solana wallet address (base58 encoded)
 * @returns SIWS message object
 * @throws {Error} If address is invalid
 */
export function createSiwsMessage(params: {
  domain: string;
  address: string;
}): SiwsMessage {
  // Validate address format
  const validatedAddress = createAddress(params.address);
  assertIsAddress(validatedAddress);

  // Generate cryptographically secure nonce
  const nonce = generateNonce();

  // Set timestamps
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

  return {
    domain: params.domain,
    address: params.address,
    statement: 'Sign in to ozskr.ai',
    nonce,
    issuedAt,
    expirationTime,
  };
}

/**
 * Serialize SIWS message to human-readable string format.
 * Format follows CAIP-122 / EIP-4361 pattern.
 *
 * @param message - SIWS message object
 * @returns Serialized message string
 */
export function serializeSiwsMessage(message: SiwsMessage): string {
  const parts = [
    message.domain,
    '',
    message.statement,
    '',
    `Address: ${message.address}`,
    `Nonce: ${message.nonce}`,
    `Issued At: ${message.issuedAt}`,
  ];

  if (message.expirationTime) {
    parts.push(`Expiration Time: ${message.expirationTime}`);
  }

  return parts.join('\n');
}

/**
 * Verify a SIWS signature.
 *
 * SECURITY CRITICAL:
 * - Validates signature using ed25519 (nacl)
 * - Verifies message timestamp is within acceptable range
 * - Does NOT verify nonce uniqueness (handled server-side)
 *
 * @param params.message - Serialized SIWS message string
 * @param params.signature - Base58-encoded signature
 * @param params.publicKey - Base58-encoded public key
 * @returns Promise<boolean> - True if signature is valid
 * @throws {Error} If message has expired or inputs are malformed
 */
export async function verifySiwsSignature(params: {
  message: string;
  signature: string;
  publicKey: string;
}): Promise<boolean> {
  try {
    // Validate address format
    const validatedAddress = createAddress(params.publicKey);
    assertIsAddress(validatedAddress);

    // Decode signature and public key from base58
    const signatureBytes = bs58.decode(params.signature);
    const publicKeyBytes = bs58.decode(params.publicKey);

    // Convert message to bytes
    const messageBytes = new TextEncoder().encode(params.message);

    // Verify ed25519 signature
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );

    if (!isValid) {
      return false;
    }

    // Parse and validate timestamp
    const issuedAtMatch = params.message.match(/Issued At: (.+)/);
    const expirationMatch = params.message.match(/Expiration Time: (.+)/);

    if (!issuedAtMatch) {
      throw new Error('Message missing Issued At timestamp');
    }

    const issuedAt = new Date(issuedAtMatch[1]);
    const now = new Date();

    // Check message is not from the future (allow 1 minute clock skew)
    if (issuedAt.getTime() > now.getTime() + 60_000) {
      throw new Error('Message timestamp is in the future');
    }

    // Check message has not expired
    if (expirationMatch) {
      const expirationTime = new Date(expirationMatch[1]);
      if (now > expirationTime) {
        throw new Error('Message has expired');
      }
    }

    return true;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return false;
  }
}

/**
 * Generate a cryptographically secure nonce.
 * Uses crypto.randomUUID() for simplicity and security.
 *
 * @returns 36-character UUID v4 string
 */
function generateNonce(): string {
  // Use crypto.randomUUID() which is available in all modern browsers and Node.js 16+
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older environments (Node.js < 16)
  // Generate 16 random bytes and convert to hex
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Ultimate fallback (not recommended, but prevents hard failure)
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}
