/**
 * Server-side agent keypair management.
 * Generates and manages encrypted keypairs for AI agent wallets.
 *
 * SECURITY: Agent keypairs are stored encrypted at rest.
 * The passphrase is derived from a server secret + character ID.
 * Users never see or handle agent private keys.
 *
 * IMPORT NOTE: Uses subpath imports (@ozskr/agent-wallet-sdk/keypair and /types)
 * to avoid pulling in delegate.js → @solana-program/token which requires a
 * @solana/kit version incompatible with the main app's resolved version.
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  generateAgentKeypair,
  storeEncryptedKeypair,
  loadEncryptedKeypair,
  decryptKeypair,
} from '@ozskr/agent-wallet-sdk/keypair';
import {
  SCRYPT_PARAMS_PRODUCTION,
  SCRYPT_PARAMS_FAST,
} from '@ozskr/agent-wallet-sdk/types';

const AGENT_KEYS_DIR = process.env.AGENT_KEYS_DIR || join(process.cwd(), '.agent-keys');
const AGENT_KEY_SECRET = process.env.AGENT_KEY_SECRET || process.env.JWT_SECRET || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function getPassphrase(characterId: string): string {
  if (!AGENT_KEY_SECRET || AGENT_KEY_SECRET.length < 32) {
    throw new Error('AGENT_KEY_SECRET or JWT_SECRET must be at least 32 characters');
  }
  return `${AGENT_KEY_SECRET}:agent:${characterId}`;
}

function getKeypairPath(characterId: string): string {
  return join(AGENT_KEYS_DIR, `${characterId}.json`);
}

/**
 * Generate and store an agent keypair for a character.
 * Returns the agent's public key (address).
 */
export async function createAgentKeypair(characterId: string): Promise<string> {
  if (!existsSync(AGENT_KEYS_DIR)) {
    mkdirSync(AGENT_KEYS_DIR, { recursive: true, mode: 0o700 });
  }

  const passphrase = getPassphrase(characterId);
  const scryptParams = IS_PRODUCTION ? SCRYPT_PARAMS_PRODUCTION : SCRYPT_PARAMS_FAST;
  const keypairPath = getKeypairPath(characterId);

  const { signer, keypairBytes } = await generateAgentKeypair();

  try {
    await storeEncryptedKeypair(keypairBytes, passphrase, keypairPath, false, scryptParams);
    return signer.address;
  } finally {
    keypairBytes.fill(0);
  }
}

/**
 * Load an agent's KeyPairSigner for signing transactions.
 * Only call this server-side when the agent needs to sign.
 */
export async function loadAgentSigner(characterId: string) {
  const passphrase = getPassphrase(characterId);
  const scryptParams = IS_PRODUCTION ? SCRYPT_PARAMS_PRODUCTION : SCRYPT_PARAMS_FAST;
  const keypairPath = getKeypairPath(characterId);

  return loadEncryptedKeypair(keypairPath, passphrase, scryptParams);
}

/**
 * Load agent's raw 64-byte keypair (32-byte secret + 32-byte public).
 * SECURITY: Caller MUST zero the returned bytes after use.
 * Used for converting to @solana/web3.js v1 Keypair format.
 */
export async function loadAgentKeypairBytes(characterId: string): Promise<Uint8Array> {
  const { readFile, stat } = await import('node:fs/promises');

  const passphrase = getPassphrase(characterId);
  const scryptParams = IS_PRODUCTION ? SCRYPT_PARAMS_PRODUCTION : SCRYPT_PARAMS_FAST;
  const keypairPath = getKeypairPath(characterId);

  // Verify file exists and has secure permissions
  const fileStat = await stat(keypairPath);
  const mode = fileStat.mode & 0o777;
  if (mode !== 0o600) {
    throw new Error(`Insecure file permissions on ${keypairPath}`);
  }

  const content = await readFile(keypairPath, 'utf-8');
  const encrypted = JSON.parse(content);
  return decryptKeypair(encrypted, passphrase, scryptParams);
}

/**
 * Check if an agent keypair exists for a character.
 */
export function agentKeypairExists(characterId: string): boolean {
  return existsSync(getKeypairPath(characterId));
}
