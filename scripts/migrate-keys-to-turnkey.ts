#!/usr/bin/env npx tsx
/**
 * Migrate encrypted JSON agent keypairs to Turnkey TEE.
 *
 * This script reads all .agent-keys/*.json files, decrypts them,
 * imports the private keys into Turnkey, verifies the addresses match,
 * and stores the mapping in Supabase.
 *
 * Usage:
 *   npx tsx scripts/migrate-keys-to-turnkey.ts [--dry-run] [--agent-id <id>]
 *
 * Required env vars:
 *   TURNKEY_ORGANIZATION_ID
 *   TURNKEY_API_PUBLIC_KEY
 *   TURNKEY_API_PRIVATE_KEY
 *   AGENT_KEY_SECRET (or JWT_SECRET)
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Idempotent: skips agents that already have a Turnkey mapping.
 * Does NOT delete local files (dual-write period).
 */

import { readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { createClient } from '@supabase/supabase-js';
import { Turnkey } from '@turnkey/sdk-server';
import {
  decryptKeypair,
  SCRYPT_PARAMS_FAST,
  SCRYPT_PARAMS_PRODUCTION,
} from '@ozskr/agent-wallet-sdk';

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const agentIdIdx = args.indexOf('--agent-id');
const targetAgentId = agentIdIdx !== -1 ? args[agentIdIdx + 1] : null;

// Config
const AGENT_KEYS_DIR = process.env.AGENT_KEYS_DIR || join(process.cwd(), '.agent-keys');
const AGENT_KEY_SECRET = process.env.AGENT_KEY_SECRET || process.env.JWT_SECRET || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function getPassphrase(characterId: string): string {
  return `${AGENT_KEY_SECRET}:agent:${characterId}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function main() {
  // Validate env
  if (!AGENT_KEY_SECRET || AGENT_KEY_SECRET.length < 32) {
    console.error('ERROR: AGENT_KEY_SECRET must be at least 32 characters');
    process.exit(1);
  }

  const requiredEnvVars = [
    'TURNKEY_ORGANIZATION_ID',
    'TURNKEY_API_PUBLIC_KEY',
    'TURNKEY_API_PRIVATE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`ERROR: Missing required env var: ${envVar}`);
      process.exit(1);
    }
  }

  console.log(`Migration mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (targetAgentId) {
    console.log(`Target agent: ${targetAgentId}`);
  }

  // Initialize clients
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const turnkey = new Turnkey({
    apiBaseUrl: process.env.TURNKEY_BASE_URL || 'https://api.turnkey.com',
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
  });

  // Verify Turnkey connectivity
  try {
    await turnkey.apiClient().getWhoami({
      organizationId: process.env.TURNKEY_ORGANIZATION_ID!,
    });
    console.log('Turnkey connection verified');
  } catch (err) {
    console.error('ERROR: Cannot connect to Turnkey API:', err instanceof Error ? err.message : 'Unknown error');
    process.exit(1);
  }

  // List keypair files
  let files: string[];
  try {
    files = readdirSync(AGENT_KEYS_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    console.error(`ERROR: Cannot read ${AGENT_KEYS_DIR}`);
    process.exit(1);
  }

  if (targetAgentId) {
    files = files.filter((f) => basename(f, '.json') === targetAgentId);
    if (files.length === 0) {
      console.error(`ERROR: No keypair file found for agent ${targetAgentId}`);
      process.exit(1);
    }
  }

  console.log(`Found ${files.length} keypair file(s) to process\n`);

  const scryptParams = IS_PRODUCTION ? SCRYPT_PARAMS_PRODUCTION : SCRYPT_PARAMS_FAST;
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const characterId = basename(file, '.json');
    console.log(`Processing: ${characterId}`);

    // Check if already migrated
    const { data: existing } = await supabase
      .from('agent_turnkey_mapping')
      .select('turnkey_public_key')
      .eq('character_id', characterId)
      .single();

    if (existing) {
      console.log(`  SKIP: Already has Turnkey mapping (${existing.turnkey_public_key})`);
      skipped++;
      continue;
    }

    try {
      // Decrypt local keypair
      const filePath = join(AGENT_KEYS_DIR, file);
      const content = readFileSync(filePath, 'utf-8');
      const encrypted = JSON.parse(content);
      const keypairBytes = await decryptKeypair(encrypted, getPassphrase(characterId), scryptParams);

      // Extract private key (first 32 bytes) and derive expected pubkey
      const privateKeyBytes = keypairBytes.slice(0, 32);
      const privateKeyHex = bytesToHex(privateKeyBytes);

      // Get expected address from characters table
      const { data: character } = await supabase
        .from('characters')
        .select('agent_pubkey')
        .eq('id', characterId)
        .single();

      const expectedAddress = character?.agent_pubkey;

      if (dryRun) {
        console.log(`  DRY RUN: Would import key for ${characterId}`);
        console.log(`  Expected address: ${expectedAddress || 'unknown'}`);
        migrated++;
        keypairBytes.fill(0);
        continue;
      }

      // Import into Turnkey
      const importResult = await turnkey.apiClient().importPrivateKey({
        privateKeyName: `agent-${characterId}`,
        privateKey: privateKeyHex,
        curve: 'CURVE_ED25519',
        addressFormats: ['ADDRESS_FORMAT_SOLANA'],
      } as Record<string, unknown>);

      // Zero private key material immediately
      keypairBytes.fill(0);

      const turnkeyAddress = (importResult as { addresses?: string[] }).addresses?.[0];
      const privateKeyId = (importResult as { privateKeyId?: string }).privateKeyId;

      // Verify address matches
      if (expectedAddress && turnkeyAddress !== expectedAddress) {
        console.error(`  ERROR: Address mismatch! Expected ${expectedAddress}, got ${turnkeyAddress}`);
        failed++;
        continue;
      }

      // Store mapping
      const { error: insertError } = await supabase
        .from('agent_turnkey_mapping')
        .insert({
          character_id: characterId,
          turnkey_wallet_id: privateKeyId || `imported-${characterId}`,
          turnkey_public_key: turnkeyAddress,
        });

      if (insertError) {
        console.error(`  ERROR: Failed to store mapping: ${insertError.message}`);
        failed++;
        continue;
      }

      console.log(`  OK: Imported to Turnkey (${turnkeyAddress})`);
      migrated++;
    } catch (err) {
      console.error(`  ERROR: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\n--- Migration Summary ---`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Failed:   ${failed}`);
  console.log(`Total:    ${files.length}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : 'Unknown error');
  process.exit(1);
});
