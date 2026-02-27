/**
 * Admin Character Routes
 * Admin-only operations on characters that require elevated privileges.
 * All routes require admin authentication.
 * Non-admin wallets receive 404 to hide route existence.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseServerClient } from '../supabase';
import { createAgentKeypair } from '@/lib/agent-wallet';
import { logger } from '@/lib/utils/logger';

function getAdminWallets(): string[] {
  return (process.env.ADMIN_WALLETS ?? '').split(',').filter(Boolean);
}

/** Admin gate — returns 404 for non-admin wallets to hide route existence */
async function requireAdmin(c: Context, next: () => Promise<void>): Promise<Response | void> {
  const walletAddress = (c as unknown as { get: (key: string) => unknown }).get(
    'walletAddress',
  ) as string;
  if (!walletAddress || !getAdminWallets().includes(walletAddress)) {
    return c.json({ error: 'Route not found', code: 'NOT_FOUND' }, 404);
  }
  await next();
}

function getServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Service role key not configured');
  }
  return createSupabaseServerClient(serviceRoleKey);
}

const adminCharacters = new Hono();

// All routes require auth + admin check
adminCharacters.use('*', authMiddleware);
adminCharacters.use('*', requireAdmin);

/**
 * POST /admin/characters/:id/provision-wallet
 *
 * Provisions a Turnkey TEE wallet (or local encrypted keypair in dev) for an
 * existing character that was created without one. Idempotent — if a wallet
 * already exists in agent_turnkey_mapping the endpoint returns early with
 * { alreadyExisted: true } and does NOT call Turnkey a second time.
 *
 * Response body:
 *   { walletId: string | null, publicKey: string, alreadyExisted: boolean }
 *
 * walletId is the Turnkey wallet UUID when Turnkey is active, null for local
 * encrypted-JSON keypairs (dev/staging without TURNKEY_ORGANIZATION_ID).
 *
 * On success the characters.agent_pubkey column is also updated so the live
 * record is consistent with the keypair backend.
 */
adminCharacters.post('/:id/provision-wallet', async (c: Context) => {
  const characterId = c.req.param('id');

  // Validate UUID format before touching any external service
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(characterId)) {
    return c.json({ error: 'Invalid character ID format', code: 'VALIDATION_ERROR' }, 400);
  }

  const supabase = getServiceClient();

  // Confirm the character exists before doing any wallet work
  const { data: character, error: characterError } = await supabase
    .from('characters')
    .select('id, agent_pubkey')
    .eq('id', characterId)
    .maybeSingle();

  if (characterError) {
    logger.error('provision-wallet: character lookup failed', {
      characterId,
      error: characterError.message,
    });
    return c.json({ error: 'Database query failed', code: 'DATABASE_ERROR' }, 500);
  }

  if (!character) {
    return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
  }

  // Check whether a Turnkey mapping already exists (prevents double-provisioning).
  // We query the mapping table directly rather than relying on agent_pubkey being set
  // because an older migration path may have set agent_pubkey without creating the
  // mapping row (or vice-versa).
  const { data: existingMapping, error: mappingError } = await supabase
    .from('agent_turnkey_mapping')
    .select('turnkey_wallet_id, turnkey_public_key')
    .eq('character_id', characterId)
    .maybeSingle();

  if (mappingError) {
    logger.error('provision-wallet: mapping lookup failed', {
      characterId,
      error: mappingError.message,
    });
    return c.json({ error: 'Database query failed', code: 'DATABASE_ERROR' }, 500);
  }

  if (existingMapping) {
    logger.info('provision-wallet: wallet already exists, skipping', {
      characterId,
      walletId: existingMapping.turnkey_wallet_id,
    });
    return c.json({
      walletId: existingMapping.turnkey_wallet_id,
      publicKey: existingMapping.turnkey_public_key,
      alreadyExisted: true,
    });
  }

  // For local keypair mode (no Turnkey) we also check the characters.agent_pubkey
  // column — if it is already populated we consider the wallet already provisioned
  // and return early without generating a second keypair file.
  if (!process.env.TURNKEY_ORGANIZATION_ID && character.agent_pubkey) {
    logger.info('provision-wallet: local keypair already exists, skipping', { characterId });
    return c.json({
      walletId: null,
      publicKey: character.agent_pubkey,
      alreadyExisted: true,
    });
  }

  // Provision the keypair.  createAgentKeypair() throws explicitly on failure —
  // it will never silently fall back after the fix in index.ts.
  let publicKey: string;
  try {
    publicKey = await createAgentKeypair(characterId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('provision-wallet: keypair provisioning failed', { characterId, error: message });
    return c.json(
      {
        error: 'Wallet provisioning failed',
        code: 'PROVISIONING_ERROR',
        detail: message,
      },
      500,
    );
  }

  // Update characters.agent_pubkey so the live record reflects the new wallet
  const { error: updateError } = await supabase
    .from('characters')
    .update({ agent_pubkey: publicKey })
    .eq('id', characterId);

  if (updateError) {
    // The wallet was provisioned but we failed to write agent_pubkey.
    // Log as error with full context so an operator can reconcile manually.
    logger.error('provision-wallet: failed to update agent_pubkey — wallet was created', {
      characterId,
      publicKey,
      error: updateError.message,
    });
    return c.json(
      {
        error: 'Wallet provisioned but database update failed — check server logs',
        code: 'DATABASE_ERROR',
        publicKey,
      },
      500,
    );
  }

  // Retrieve the Turnkey wallet ID from the mapping table so we can return it
  // (storeTurnkeyMapping is called inside createAgentKeypairTurnkey).
  // In local mode, walletId is null by convention.
  let walletId: string | null = null;
  if (process.env.TURNKEY_ORGANIZATION_ID) {
    const { data: newMapping } = await supabase
      .from('agent_turnkey_mapping')
      .select('turnkey_wallet_id')
      .eq('character_id', characterId)
      .maybeSingle();
    walletId = newMapping?.turnkey_wallet_id ?? null;
  }

  logger.info('provision-wallet: wallet provisioned successfully', {
    characterId,
    publicKey,
    walletId,
    backend: process.env.TURNKEY_ORGANIZATION_ID ? 'turnkey' : 'local',
  });

  return c.json(
    {
      walletId,
      publicKey,
      alreadyExisted: false,
    },
    201,
  );
});

export { adminCharacters };
