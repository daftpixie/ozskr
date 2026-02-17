import { Turnkey } from '@turnkey/sdk-server';
import type { Address } from '@solana/kit';
import type { KeyManager } from './types.js';

export interface TurnkeyKeyManagerOptions {
  organizationId: string;
  apiPublicKey: string;
  apiPrivateKey: string;
  /** Turnkey wallet address (Solana base58 pubkey) used as signWith */
  signWith: string;
  baseUrl?: string;
}

/**
 * Convert a hex string to Uint8Array.
 * Expects an even-length string of hex characters.
 */
function hexToBytes(hex: string): Uint8Array {
  const len = hex.length;
  if (len % 2 !== 0) {
    throw new Error(`Invalid hex string length: ${len}`);
  }
  const bytes = new Uint8Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Production key manager using Turnkey TEE (AWS Nitro Enclaves).
 *
 * Private keys exist only inside hardware-isolated enclaves — they never
 * leave Turnkey's infrastructure. Signing is performed via the signRawPayload
 * API, which returns Ed25519 R+S components as hex strings.
 *
 * This implementation uses `@turnkey/sdk-server` directly with `signRawPayload`
 * to avoid pulling in `@turnkey/solana` and its `@solana/web3.js` v1 dependency.
 */
export class TurnkeyKeyManager implements KeyManager {
  private client: InstanceType<typeof Turnkey>;
  private readonly signWith: string;

  constructor(private readonly options: TurnkeyKeyManagerOptions) {
    if (!options.organizationId) {
      throw new Error('TurnkeyKeyManager requires organizationId');
    }
    if (!options.apiPublicKey) {
      throw new Error('TurnkeyKeyManager requires apiPublicKey');
    }
    if (!options.apiPrivateKey) {
      throw new Error('TurnkeyKeyManager requires apiPrivateKey');
    }
    if (!options.signWith) {
      throw new Error('TurnkeyKeyManager requires signWith (Solana address)');
    }

    this.signWith = options.signWith;
    this.client = new Turnkey({
      apiBaseUrl: options.baseUrl || 'https://api.turnkey.com',
      apiPublicKey: options.apiPublicKey,
      apiPrivateKey: options.apiPrivateKey,
      defaultOrganizationId: options.organizationId,
    });
  }

  async getPublicKey(): Promise<Address> {
    return this.signWith as Address;
  }

  async signTransaction(transactionMessage: Uint8Array): Promise<Uint8Array> {
    const payload = bytesToHex(transactionMessage);

    const result = await this.client.apiClient().signRawPayload({
      signWith: this.signWith,
      payload,
      encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
      hashFunction: 'HASH_FUNCTION_NOT_APPLICABLE',
    });

    // Turnkey returns R and S as hex strings (32 bytes each)
    // Concatenate to form 64-byte Ed25519 signature
    const r = result.r;
    const s = result.s;

    if (!r || !s) {
      throw new Error('Turnkey signRawPayload returned empty r or s');
    }

    return hexToBytes(padHex(r, 64) + padHex(s, 64));
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    // Ed25519 signing is the same operation for messages and transactions
    return this.signTransaction(message);
  }

  async healthCheck(): Promise<{ healthy: boolean; provider: string }> {
    try {
      await this.client.apiClient().getWhoami({
        organizationId: this.options.organizationId,
      });
      return { healthy: true, provider: 'turnkey' };
    } catch {
      return { healthy: false, provider: 'turnkey' };
    }
  }
}

/**
 * Convert Uint8Array to hex string.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Pad a hex string to the target length with leading zeros.
 * Ed25519 R and S components are 32 bytes (64 hex chars) each.
 */
function padHex(hex: string, targetLength: number): string {
  // Strip '0x' prefix if present
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return clean.padStart(targetLength, '0');
}
