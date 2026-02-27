#!/usr/bin/env node
/**
 * One-off script: provision the shared demo Turnkey wallet for an existing character.
 * Uses TURNKEY_AGENT_WALLET_ID + TURNKEY_AGENT_SOLANA_ADDRESS env vars (fast-path demo wallet).
 * Run: node tools/provision-wallet.mjs <character-uuid>
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().split(' ')[0]; // strip inline comments
  env[key] = val;
}

const characterId = process.argv[2];
if (!characterId) {
  console.error('Usage: node tools/provision-wallet.mjs <character-uuid>');
  process.exit(1);
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const walletId = env.TURNKEY_AGENT_WALLET_ID;
const publicKey = env.TURNKEY_AGENT_SOLANA_ADDRESS;

if (!supabaseUrl || !serviceKey || !walletId || !publicKey) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TURNKEY_AGENT_WALLET_ID, TURNKEY_AGENT_SOLANA_ADDRESS');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

console.log(`Provisioning wallet for character: ${characterId}`);
console.log(`  Wallet ID : ${walletId}`);
console.log(`  Public Key: ${publicKey}`);

// 1. Confirm character exists
const { data: character, error: charErr } = await supabase
  .from('characters')
  .select('id, name, agent_pubkey')
  .eq('id', characterId)
  .maybeSingle();

if (charErr || !character) {
  console.error('Character not found:', charErr?.message ?? 'no row returned');
  process.exit(1);
}
console.log(`  Character : ${character.name} (current agent_pubkey: ${character.agent_pubkey ?? 'null'})`);

// 2. Try to upsert agent_turnkey_mapping (optional — env var fast path covers demo use)
const { error: mappingErr } = await supabase
  .from('agent_turnkey_mapping')
  .upsert({ character_id: characterId, turnkey_wallet_id: walletId, turnkey_public_key: publicKey }, { onConflict: 'character_id' });

if (mappingErr) {
  console.warn('  ⚠ agent_turnkey_mapping upsert skipped (table may not exist yet):', mappingErr.message);
  console.warn('  → Demo will still work via TURNKEY_AGENT_WALLET_ID env var fast path');
} else {
  console.log('  ✓ agent_turnkey_mapping upserted');
}

// 3. Update characters.agent_pubkey
const { error: updateErr } = await supabase
  .from('characters')
  .update({ agent_pubkey: publicKey })
  .eq('id', characterId);

if (updateErr) {
  console.error('Failed to update agent_pubkey:', updateErr.message);
  process.exit(1);
}
console.log('  ✓ characters.agent_pubkey updated');
console.log('\nDone. Toto now has a wallet.');
