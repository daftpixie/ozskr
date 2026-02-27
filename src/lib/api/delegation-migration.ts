/**
 * Delegation Migration Utility
 * Backfills agent_delegation_accounts from legacy characters columns.
 *
 * This function is idempotent — safe to call multiple times.  Rows that
 * already exist (matched by the partial unique index on character_id +
 * token_mint WHERE status NOT IN ('revoked', 'depleted')) are skipped via
 * ON CONFLICT DO NOTHING at the database level.
 *
 * Prerequisites:
 *   - SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL env vars set
 *   - The 20260226000000_multi_agent_delegation.sql migration applied
 *
 * Usage (one-shot, safe to run in CI or a startup hook):
 *   import { migrateExistingDelegations } from '@/lib/api/delegation-migration';
 *   const result = await migrateExistingDelegations();
 *   console.info(result);
 */

import { createSupabaseServerClient } from './supabase';

interface MigrationResult {
  migrated: number;
  skipped: number;
}

/**
 * Character row shape as returned by the legacy delegation query.
 * Only the fields needed for backfill are selected.
 */
interface LegacyDelegationCharacter {
  id: string;
  wallet_address: string;
  delegation_token_mint: string | null;
  delegation_token_account: string | null;
  agent_pubkey: string | null;
  delegation_amount: string | null;
  delegation_remaining: string | null;
  delegation_tx_signature: string | null;
}

/**
 * Migrate active delegations from the legacy characters columns into the
 * canonical agent_delegation_accounts table.
 *
 * Selection criteria:
 *   - delegation_status = 'active'
 *   - delegation_token_account IS NOT NULL
 *   - agent_pubkey IS NOT NULL
 *
 * A row without agent_pubkey cannot be migrated because delegate_pubkey is
 * NOT NULL in agent_delegation_accounts — those rows are skipped.
 */
export async function migrateExistingDelegations(): Promise<MigrationResult> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for delegation migration'
    );
  }

  const supabase = createSupabaseServerClient(serviceRoleKey);

  // Fetch all characters that have an active, fully-specified delegation
  const { data: characters, error: fetchError } = await supabase
    .from('characters')
    .select(
      'id, wallet_address, delegation_token_mint, delegation_token_account, agent_pubkey, delegation_amount, delegation_remaining, delegation_tx_signature'
    )
    .eq('delegation_status', 'active')
    .not('delegation_token_account', 'is', null)
    .not('agent_pubkey', 'is', null);

  if (fetchError) {
    throw new Error(
      `Failed to fetch legacy delegation characters: ${fetchError.message}`
    );
  }

  const rows = (characters ?? []) as LegacyDelegationCharacter[];

  let migrated = 0;
  let skipped = 0;

  for (const char of rows) {
    // Defensive check — the query filters should catch these, but guard
    // against null values reaching the insert anyway.
    if (!char.delegation_token_account || !char.agent_pubkey) {
      skipped++;
      continue;
    }

    const tokenMint = char.delegation_token_mint ?? '';
    const approvedAmount = char.delegation_amount ?? '0';
    // remaining defaults to approved if not explicitly tracked
    const remainingAmount = char.delegation_remaining ?? approvedAmount;

    // Check for an existing non-revoked/non-depleted row before inserting.
    // This gives us accurate migrated vs. skipped counts without relying on
    // the insert chain's count API, which differs from select chain behavior.
    const { data: existing, error: checkError } = await supabase
      .from('agent_delegation_accounts')
      .select('id')
      .eq('character_id', char.id)
      .eq('token_mint', tokenMint)
      .not('delegation_status', 'in', '("revoked","depleted")')
      .maybeSingle();

    if (checkError) {
      throw new Error(
        `Failed to check existing delegation for character ${char.id}: ${checkError.message}`
      );
    }

    if (existing) {
      console.info(
        `[delegation-migration] Skipped (already exists): character=${char.id} token_mint=${tokenMint}`
      );
      skipped++;
      continue;
    }

    const { error: insertError } = await supabase
      .from('agent_delegation_accounts')
      .insert({
        character_id: char.id,
        wallet_address: char.wallet_address,
        token_mint: tokenMint,
        token_account_address: char.delegation_token_account,
        delegate_pubkey: char.agent_pubkey,
        delegation_status: 'active',
        approved_amount: approvedAmount,
        remaining_amount: remainingAmount,
        delegation_tx_signature: char.delegation_tx_signature ?? null,
        reconciliation_status: 'unverified',
      });

    if (insertError) {
      // A race between the check and insert can still produce a conflict —
      // treat duplicate key violations as skips rather than hard errors.
      if (
        insertError.code === '23505' ||
        insertError.message.includes('duplicate key')
      ) {
        console.info(
          `[delegation-migration] Skipped (race conflict): character=${char.id} token_mint=${tokenMint}`
        );
        skipped++;
        continue;
      }

      throw new Error(
        `Failed to insert delegation account for character ${char.id}: ${insertError.message}`
      );
    }

    console.info(
      `[delegation-migration] Migrated: character=${char.id} token_mint=${tokenMint} approved=${approvedAmount} remaining=${remainingAmount}`
    );
    migrated++;
  }

  console.info(
    `[delegation-migration] Complete — migrated=${migrated} skipped=${skipped}`
  );

  return { migrated, skipped };
}
