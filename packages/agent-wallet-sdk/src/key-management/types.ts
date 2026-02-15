import type { Address } from '@solana/kit';

/**
 * Pluggable key management interface.
 *
 * Development: EncryptedJsonKeyManager (existing scrypt-based keypair files)
 * Production:  Implement this interface with Turnkey, Privy, or Fireblocks
 *
 * See ARCHITECTURE.md for production key management guidance.
 */
export interface KeyManager {
  /** Get the agent's public key (address) */
  getPublicKey(): Promise<Address>;

  /** Sign a transaction message, returning signature bytes */
  signTransaction(transactionMessage: Uint8Array): Promise<Uint8Array>;

  /** Sign arbitrary bytes (for message signing, not transactions) */
  signMessage(message: Uint8Array): Promise<Uint8Array>;

  /** Check if the key manager is healthy and operational */
  healthCheck(): Promise<{ healthy: boolean; provider: string }>;
}

export interface KeyManagerConfig {
  /** 'encrypted-json' for development, 'turnkey' | 'privy' | 'custom' for production */
  provider: 'encrypted-json' | 'turnkey' | 'privy' | 'custom';
  /** Provider-specific configuration */
  options: Record<string, unknown>;
}
