/**
 * Server-side agent keypair management.
 * Generates and manages encrypted keypairs for AI agent wallets.
 *
 * SECURITY: Agent keypairs are stored encrypted at rest (local) or inside
 * Turnkey TEE (AWS Nitro Enclaves) in production. The signer backend is
 * selected via TURNKEY_ORGANIZATION_ID env var (feature flag).
 *
 * IMPORT NOTE: Uses subpath imports (@ozskr/agent-wallet-sdk/keypair, /types,
 * /key-management) to avoid pulling in delegate.js → @solana-program/token
 * which requires a @solana/kit version incompatible with the main app's.
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { address } from '@solana/kit';
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
import { createSignerFromKeyManager, type AgentSigner } from './signer-adapter';
import { logger } from '@/lib/utils/logger';

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
 * Uses Turnkey TEE when TURNKEY_ORGANIZATION_ID is set, otherwise local encrypted JSON.
 * Returns the agent's public key (address).
 *
 * Throws explicitly if Turnkey is configured but provisioning fails — no silent fallback.
 * When falling back to local JSON (Turnkey not configured), logs a warning so operators
 * can distinguish the active backend from logs.
 */
export async function createAgentKeypair(characterId: string): Promise<string> {
  if (process.env.TURNKEY_ORGANIZATION_ID) {
    try {
      return await createAgentKeypairTurnkey(characterId);
    } catch (err) {
      // Re-throw with explicit context so callers know it was the Turnkey path that failed,
      // not a local I/O or passphrase error.
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Turnkey wallet provisioning failed for character ${characterId}: ${message}`);
    }
  }

  // Turnkey not configured — using local encrypted JSON keypair.
  // Log at warn level so operators can tell which backend is active.
  logger.warn('TURNKEY_ORGANIZATION_ID not set — falling back to local encrypted JSON keypair', {
    characterId,
    note: 'Set TURNKEY_ORGANIZATION_ID to use Turnkey TEE in production',
  });
  return createAgentKeypairLocal(characterId);
}

async function createAgentKeypairLocal(characterId: string): Promise<string> {
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

async function createAgentKeypairTurnkey(characterId: string): Promise<string> {
  const { createTurnkeyWallet } = await import('@ozskr/agent-wallet-sdk/key-management');

  // Label must be unique within the Turnkey organization.
  // Include a short timestamp suffix so re-provisioning (force=true) never
  // collides with a previously-created wallet that still exists in Turnkey.
  const labelSuffix = Date.now().toString(36).slice(-6);
  const wallet = await createTurnkeyWallet({
    organizationId: process.env.TURNKEY_ORGANIZATION_ID!,
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
    baseUrl: process.env.TURNKEY_BASE_URL,
    walletName: `agent-${characterId}-${labelSuffix}`,
  });

  // Store mapping in Supabase (service role)
  await storeTurnkeyMapping(characterId, wallet.walletId, wallet.publicKey);

  logger.info('Created Turnkey wallet for agent', {
    characterId,
    walletId: wallet.walletId,
    address: wallet.publicKey,
  });

  return wallet.publicKey;
}

/**
 * Load an agent signer for signing transactions.
 * Uses Turnkey TEE when TURNKEY_ORGANIZATION_ID is set, otherwise local KeyPairSigner.
 *
 * Both return types satisfy the @solana/kit signer protocol:
 * { address, signMessages, signTransactions }
 */
export async function loadAgentSigner(characterId: string): Promise<AgentSigner> {
  if (process.env.TURNKEY_ORGANIZATION_ID) {
    return loadTurnkeySigner(characterId);
  }
  return loadLocalSigner(characterId);
}

async function loadLocalSigner(characterId: string): Promise<AgentSigner> {
  const passphrase = getPassphrase(characterId);
  const scryptParams = IS_PRODUCTION ? SCRYPT_PARAMS_PRODUCTION : SCRYPT_PARAMS_FAST;
  const keypairPath = getKeypairPath(characterId);

  const signer = await loadEncryptedKeypair(keypairPath, passphrase, scryptParams);

  // Wrap the KeyPairSigner — it already has signMessages/signTransactions
  // but we wrap it for consistent typing and audit logging
  const { EncryptedJsonKeyManager } = await import('@ozskr/agent-wallet-sdk/key-management');
  const km = new EncryptedJsonKeyManager(keypairPath, passphrase, scryptParams);
  return createSignerFromKeyManager(km, signer.address, 'local');
}

async function loadTurnkeySigner(characterId: string): Promise<AgentSigner> {
  const mapping = await getTurnkeyMapping(characterId);
  if (!mapping) {
    throw new Error(`No Turnkey mapping for character ${characterId}`);
  }

  const { createKeyManager } = await import('@ozskr/agent-wallet-sdk/key-management');

  const km = createKeyManager({
    provider: 'turnkey',
    options: {
      organizationId: process.env.TURNKEY_ORGANIZATION_ID!,
      apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
      apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
      signWith: mapping.turnkeyPublicKey,
    },
  });

  return createSignerFromKeyManager(
    km,
    address(mapping.turnkeyPublicKey),
    'turnkey',
  );
}

/**
 * Store a character → Turnkey wallet mapping in Supabase.
 * Uses service role client (not user-scoped).
 */
async function storeTurnkeyMapping(
  characterId: string,
  walletId: string,
  publicKey: string,
): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error } = await supabase
    .from('agent_turnkey_mapping')
    .upsert({
      character_id: characterId,
      turnkey_wallet_id: walletId,
      turnkey_public_key: publicKey,
    }, { onConflict: 'character_id' });

  if (error) {
    throw new Error(`Failed to store Turnkey mapping: ${error.message}`);
  }
}

/**
 * Look up a character's Turnkey wallet mapping.
 *
 * Resolution order:
 * 1. Supabase agent_turnkey_mapping table (per-character, preferred)
 * 2. Env vars TURNKEY_AGENT_WALLET_ID + TURNKEY_AGENT_SOLANA_ADDRESS (single-agent demo fallback)
 */
async function getTurnkeyMapping(
  characterId: string,
): Promise<{ turnkeyWalletId: string; turnkeyPublicKey: string } | null> {
  // Production path: Supabase per-character mapping table (checked first)
  const { createClient } = await import('@supabase/supabase-js');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from('agent_turnkey_mapping')
    .select('turnkey_wallet_id, turnkey_public_key')
    .eq('character_id', characterId)
    .single();

  if (!error && data) {
    return {
      turnkeyWalletId: data.turnkey_wallet_id,
      turnkeyPublicKey: data.turnkey_public_key,
    };
  }

  // Fallback: env var override for single-agent demo deployments
  // Only used when no per-character DB row exists
  const envWalletId = process.env.TURNKEY_AGENT_WALLET_ID;
  const envAddress = process.env.TURNKEY_AGENT_SOLANA_ADDRESS;
  if (envWalletId && envAddress) {
    logger.debug('Using env var Turnkey mapping fallback', { characterId, address: envAddress });
    return { turnkeyWalletId: envWalletId, turnkeyPublicKey: envAddress };
  }

  return null;
}

/**
 * Load agent's raw 64-byte keypair (32-byte secret + 32-byte public).
 * SECURITY: Caller MUST zero the returned bytes after use.
 * Used for converting to @solana/web3.js v1 Keypair format.
 * Only available for local (encrypted JSON) keypairs.
 */
export async function loadAgentKeypairBytes(characterId: string): Promise<Uint8Array> {
  if (process.env.TURNKEY_ORGANIZATION_ID) {
    throw new Error(
      'loadAgentKeypairBytes is not available with Turnkey TEE — private keys never leave the enclave',
    );
  }

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
 * For Turnkey, checks the Supabase mapping table.
 */
export async function agentKeypairExists(characterId: string): Promise<boolean> {
  if (process.env.TURNKEY_ORGANIZATION_ID) {
    const mapping = await getTurnkeyMapping(characterId);
    return mapping !== null;
  }
  return existsSync(getKeypairPath(characterId));
}
