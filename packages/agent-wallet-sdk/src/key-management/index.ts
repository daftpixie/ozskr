export type { KeyManager, KeyManagerConfig, TurnkeyKeyManagerOptions } from './types.js';
export { EncryptedJsonKeyManager } from './encrypted-json.js';
export { TurnkeyKeyManager } from './turnkey.js';
export { createTurnkeyWallet } from './turnkey-wallet.js';
export type { CreateTurnkeyWalletOptions, TurnkeyWalletResult } from './turnkey-wallet.js';

import { EncryptedJsonKeyManager } from './encrypted-json.js';
import { TurnkeyKeyManager } from './turnkey.js';
import type { KeyManagerConfig, KeyManager } from './types.js';
import type { ScryptParams } from '../types.js';

/**
 * Create a key manager from configuration.
 * Supports 'encrypted-json' (development) and 'turnkey' (production TEE) providers.
 *
 * @param config - Key manager configuration
 * @returns A KeyManager instance
 * @throws Error if provider is unsupported or required options are missing
 *
 * @example
 * ```ts
 * // Development: encrypted JSON keypair files
 * const keyManager = createKeyManager({
 *   provider: 'encrypted-json',
 *   options: {
 *     filePath: './agent-keypair.json',
 *     passphrase: 'my-secure-passphrase',
 *     scryptParams: SCRYPT_PARAMS_FAST,
 *   },
 * });
 *
 * // Production: Turnkey TEE (AWS Nitro Enclaves)
 * const keyManager = createKeyManager({
 *   provider: 'turnkey',
 *   options: {
 *     organizationId: 'org-xxx',
 *     apiPublicKey: '...',
 *     apiPrivateKey: '...',
 *     signWith: 'SolanaBase58Address...',
 *   },
 * });
 * ```
 */
export function createKeyManager(config: KeyManagerConfig): KeyManager {
  if (config.provider === 'encrypted-json') {
    const { filePath, passphrase, scryptParams } = config.options;

    if (!filePath || typeof filePath !== 'string') {
      throw new Error('EncryptedJsonKeyManager requires options.filePath (string)');
    }
    if (!passphrase || typeof passphrase !== 'string') {
      throw new Error('EncryptedJsonKeyManager requires options.passphrase (string)');
    }

    return new EncryptedJsonKeyManager(filePath, passphrase, scryptParams as ScryptParams | undefined);
  }

  if (config.provider === 'turnkey') {
    const { organizationId, apiPublicKey, apiPrivateKey, signWith, baseUrl } = config.options;
    return new TurnkeyKeyManager({ organizationId, apiPublicKey, apiPrivateKey, signWith, baseUrl });
  }

  throw new Error(
    `Unsupported key manager provider: ${config.provider}. Only 'encrypted-json' and 'turnkey' are currently supported.`,
  );
}
