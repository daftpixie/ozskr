import type { Address, KeyPairSigner } from '@solana/kit';
import { loadEncryptedKeypair } from '../keypair.js';
import type { ScryptParams } from '../types.js';
import type { KeyManager } from './types.js';

/**
 * Development-only key manager using encrypted JSON keypair files (scrypt + AES-256-GCM).
 *
 * WARNING: This implementation stores key material in encrypted files on disk.
 * It is suitable for development and testing only. Production deployments MUST
 * use a TEE-based key management solution (Turnkey, Privy, or Fireblocks).
 * See ARCHITECTURE.md for production key management guidance.
 */
export class EncryptedJsonKeyManager implements KeyManager {
  private signer: KeyPairSigner | null = null;

  constructor(
    private readonly filePath: string,
    private readonly passphrase: string,
    private readonly scryptParams?: ScryptParams,
  ) {}

  /**
   * Lazily loads and caches the keypair signer on first use.
   * @returns The cached or newly loaded KeyPairSigner
   */
  private async getSigner(): Promise<KeyPairSigner> {
    if (!this.signer) {
      this.signer = await loadEncryptedKeypair(
        this.filePath,
        this.passphrase,
        this.scryptParams,
      );
    }
    return this.signer;
  }

  /**
   * Get the agent's public key (address).
   * Loads the keypair if not already cached.
   */
  async getPublicKey(): Promise<Address> {
    const signer = await this.getSigner();
    return signer.address;
  }

  /**
   * Sign a transaction message.
   * @param transactionMessage - The serialized transaction message bytes
   * @returns The signature bytes
   */
  async signTransaction(transactionMessage: Uint8Array): Promise<Uint8Array> {
    const signer = await this.getSigner();
    // KeyPairSigner uses Web Crypto API under the hood
    // We access the private key directly to sign
    const signature = await crypto.subtle.sign(
      'Ed25519',
      signer.keyPair.privateKey,
      transactionMessage as BufferSource,
    );
    return new Uint8Array(signature);
  }

  /**
   * Sign arbitrary bytes (for message signing, not transactions).
   * Uses the same underlying signing key.
   * @param message - The message bytes to sign
   * @returns The signature bytes
   */
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    const signer = await this.getSigner();
    // Same signing method as transactions - Ed25519
    const signature = await crypto.subtle.sign(
      'Ed25519',
      signer.keyPair.privateKey,
      message as BufferSource,
    );
    return new Uint8Array(signature);
  }

  /**
   * Check if the key manager is healthy and operational.
   * For EncryptedJsonKeyManager, this always returns healthy=true if the keypair can be loaded.
   */
  async healthCheck(): Promise<{ healthy: boolean; provider: string }> {
    try {
      await this.getSigner();
      return { healthy: true, provider: 'encrypted-json' };
    } catch {
      return { healthy: false, provider: 'encrypted-json' };
    }
  }

  /**
   * Destroy the cached signer and clear references.
   * Call this when the key manager is no longer needed.
   */
  destroy(): void {
    this.signer = null;
  }
}
