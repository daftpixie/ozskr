export type { KeyManager, KeyManagerConfig } from './types.js';
export { EncryptedJsonKeyManager } from './encrypted-json.js';

import { EncryptedJsonKeyManager } from './encrypted-json.js';
import type { KeyManagerConfig, KeyManager } from './types.js';
import type { ScryptParams } from '../types.js';

/**
 * Create a key manager from configuration.
 * Currently only supports 'encrypted-json' provider.
 * Production providers (turnkey, privy) should be implemented separately.
 *
 * @param config - Key manager configuration
 * @returns A KeyManager instance
 * @throws Error if provider is unsupported
 *
 * @example
 * ```ts
 * const keyManager = createKeyManager({
 *   provider: 'encrypted-json',
 *   options: {
 *     filePath: './agent-keypair.json',
 *     passphrase: 'my-secure-passphrase',
 *     scryptParams: SCRYPT_PARAMS_FAST,
 *   },
 * });
 * ```
 */
export function createKeyManager(config: KeyManagerConfig): KeyManager {
  if (config.provider === 'encrypted-json') {
    const filePath = config.options.filePath as string;
    const passphrase = config.options.passphrase as string;
    const scryptParams = config.options.scryptParams as ScryptParams | undefined;

    if (!filePath || typeof filePath !== 'string') {
      throw new Error('EncryptedJsonKeyManager requires options.filePath (string)');
    }
    if (!passphrase || typeof passphrase !== 'string') {
      throw new Error('EncryptedJsonKeyManager requires options.passphrase (string)');
    }

    return new EncryptedJsonKeyManager(filePath, passphrase, scryptParams);
  }

  throw new Error(
    `Unsupported key manager provider: ${config.provider}. Production providers (turnkey, privy) must be implemented separately.`,
  );
}
