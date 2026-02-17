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

export interface EncryptedJsonKeyManagerOptions {
  filePath: string;
  passphrase: string;
  scryptParams?: unknown;
}

export interface TurnkeyKeyManagerOptions {
  organizationId: string;
  apiPublicKey: string;
  apiPrivateKey: string;
  /** Turnkey wallet address (Solana base58 pubkey) used as signWith */
  signWith: string;
  baseUrl?: string;
}

export type KeyManagerConfig =
  | {
      provider: 'encrypted-json';
      options: EncryptedJsonKeyManagerOptions;
    }
  | {
      provider: 'turnkey';
      options: TurnkeyKeyManagerOptions;
    }
  | {
      provider: 'privy' | 'custom';
      options: Record<string, unknown>;
    };
