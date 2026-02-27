/**
 * Delegation Routes
 * Multi-agent delegation account management + legacy single-agent endpoints.
 *
 * Multi-agent endpoints operate on the agent_delegation_accounts table
 * (one character may have multiple delegation accounts across token mints).
 *
 * Legacy endpoints (GET /:characterId, POST /:characterId,
 * GET /:characterId/transactions, POST /:characterId/transfer) continue to
 * operate on characters.delegation_* fields for backward compatibility.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { createAuthenticatedClient, createSupabaseServerClient } from '../supabase';
import { UuidSchema, WalletAddressSchema } from '@/types/schemas';
import {
  createDelegationAccountSchema,
  updateDelegationBalanceSchema,
  revokeDelegationSchema,
  topUpDelegationSchema,
  closeDelegationSchema,
} from '@/types/delegation';
import type { AgentDelegationAccount, ReconciliationLog } from '@/types/delegation';
import { createRateLimiter } from '../middleware/rate-limit';
import { logger } from '@/lib/utils/logger';

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

/** 60 GET requests per minute per wallet */
const delegationReadLimiter = createRateLimiter(60, 60, 'ozskr:delegation:read');

/** 10 write requests per minute per wallet */
const delegationWriteLimiter = createRateLimiter(10, 60, 'ozskr:delegation:write');

// ---------------------------------------------------------------------------
// Hono app
// ---------------------------------------------------------------------------

type DelegationEnv = {
  Variables: {
    walletAddress: string;
    jwtToken: string;
  };
};

const delegation = new Hono<DelegationEnv>();

delegation.use('/*', authMiddleware);

// ---------------------------------------------------------------------------
// Auth context helper
// ---------------------------------------------------------------------------

function getAuthContext(c: { get: (key: string) => unknown }) {
  const walletAddress = c.get('walletAddress');
  const jwtToken = c.get('jwtToken');
  if (typeof walletAddress !== 'string' || typeof jwtToken !== 'string') return null;
  return { walletAddress, jwtToken };
}

// ---------------------------------------------------------------------------
// Service role client helper (for service-only endpoints)
// ---------------------------------------------------------------------------

function getServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Service role key not configured');
  }
  return createSupabaseServerClient(serviceRoleKey);
}

// ---------------------------------------------------------------------------
// Helper: cast untyped Supabase rows from new tables to our domain types.
// agent_delegation_accounts and reconciliation_log are not yet registered in
// the Database type — casting via unknown is the safe bridge.
// ---------------------------------------------------------------------------

function castRow<T>(row: unknown): T {
  return row as T;
}

function castRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

// ===========================================================================
// NEW: Multi-agent delegation account endpoints
// ===========================================================================

/**
 * GET /api/delegation/wallet/all
 * Returns all delegation accounts across all characters for the authenticated user.
 * Groups by character_id and includes character name.
 *
 * NOTE: This route MUST be registered before /:characterId to avoid the
 * "wallet" segment being swallowed as a characterId param.
 */
delegation.get(
  '/wallet/all',
  delegationReadLimiter,
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Fetch all characters owned by this wallet
      const { data: characters, error: charError } = await supabase
        .from('characters')
        .select('id, name')
        .eq('wallet_address', auth.walletAddress);

      if (charError) {
        logger.error('Failed to fetch characters for wallet/all', { error: charError.message });
        return c.json({ error: 'Failed to fetch characters', code: 'DATABASE_ERROR' }, 500);
      }

      if (!characters || characters.length === 0) {
        return c.json({ groups: [] }, 200);
      }

      const characterIds = characters.map((ch) => ch.id);

      // Fetch all delegation accounts for those characters.
      // Cast to unknown[] first since agent_delegation_accounts is not in Database type.
      const { data: rawAccounts, error: accError } = await supabase
        .from('agent_delegation_accounts' as 'characters') // eslint-disable-line @typescript-eslint/no-explicit-any
        .select('*')
        .in('character_id', characterIds)
        .order('created_at', { ascending: false });

      if (accError) {
        logger.error('Failed to fetch delegation accounts', { error: accError.message });
        return c.json({ error: 'Failed to fetch delegation accounts', code: 'DATABASE_ERROR' }, 500);
      }

      const accounts = castRows<AgentDelegationAccount>(rawAccounts ?? []);

      // Group by character_id
      const characterMap = new Map(characters.map((ch) => [ch.id, ch.name]));
      const groupMap = new Map<
        string,
        {
          characterId: string;
          characterName: string;
          accounts: unknown[];
        }
      >();

      for (const account of accounts) {
        const characterId = account.character_id;
        if (!groupMap.has(characterId)) {
          groupMap.set(characterId, {
            characterId,
            characterName: characterMap.get(characterId) ?? 'Unknown',
            accounts: [],
          });
        }
        groupMap.get(characterId)!.accounts.push({
          id: account.id,
          tokenMint: account.token_mint,
          tokenAccountAddress: account.token_account_address,
          delegatePubkey: account.delegate_pubkey,
          approvedAmount: account.approved_amount,
          remainingAmount: account.remaining_amount,
          delegationStatus: account.delegation_status,
          delegationTxSignature: account.delegation_tx_signature,
          revocationTxSignature: account.revocation_tx_signature,
          closeTxSignature: account.close_tx_signature,
          version: account.version,
          reconciliationStatus: account.reconciliation_status,
          lastReconciledAt: account.last_reconciled_at,
          createdAt: account.created_at,
          updatedAt: account.updated_at,
        });
      }

      return c.json({ groups: Array.from(groupMap.values()) }, 200);
    } catch {
      return c.json({ error: 'Failed to fetch delegation accounts', code: 'INTERNAL_ERROR' }, 500);
    }
  }
);

/**
 * GET /api/delegation/reconciliation-status
 * Returns summary stats from the reconciliation_log for the authenticated user.
 */
delegation.get(
  '/reconciliation-status',
  delegationReadLimiter,
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Get all characters for this wallet so we can scope the query
      const { data: characters, error: charError } = await supabase
        .from('characters')
        .select('id')
        .eq('wallet_address', auth.walletAddress);

      if (charError) {
        return c.json({ error: 'Failed to fetch characters', code: 'DATABASE_ERROR' }, 500);
      }

      const characterIds = (characters ?? []).map((ch) => ch.id);

      if (characterIds.length === 0) {
        return c.json({
          lastRunAt: null,
          activeAccountsChecked: 0,
          driftsDetected: 0,
          unreconciledCount: 0,
        }, 200);
      }

      // Count active accounts owned by this user
      const { count: activeCount } = await (supabase
        .from('agent_delegation_accounts' as 'characters') as unknown as {
          select: (cols: string, opts: { count: string; head: boolean }) => {
            in: (col: string, ids: string[]) => {
              eq: (col: string, val: string) => Promise<{ count: number | null }>;
            };
          };
        })
        .select('id', { count: 'exact', head: true })
        .in('character_id', characterIds)
        .eq('delegation_status', 'active');

      // Count drift-detected accounts
      const { count: driftCount } = await (supabase
        .from('agent_delegation_accounts' as 'characters') as unknown as {
          select: (cols: string, opts: { count: string; head: boolean }) => {
            in: (col: string, ids: string[]) => {
              eq: (col: string, val: string) => Promise<{ count: number | null }>;
            };
          };
        })
        .select('id', { count: 'exact', head: true })
        .in('character_id', characterIds)
        .eq('reconciliation_status', 'drift_detected');

      // Count accounts never reconciled
      const { count: unreconciledCount } = await (supabase
        .from('agent_delegation_accounts' as 'characters') as unknown as {
          select: (cols: string, opts: { count: string; head: boolean }) => {
            in: (col: string, ids: string[]) => {
              is: (col: string, val: null) => Promise<{ count: number | null }>;
            };
          };
        })
        .select('id', { count: 'exact', head: true })
        .in('character_id', characterIds)
        .is('last_reconciled_at', null);

      // Get all delegation account IDs for this user
      const { data: rawAccounts } = await supabase
        .from('agent_delegation_accounts' as 'characters')
        .select('id')
        .in('character_id', characterIds);

      const accountIds = castRows<{ id: string }>(rawAccounts ?? []).map((a) => a.id);

      let lastRunAt: string | null = null;
      if (accountIds.length > 0) {
        const { data: rawLastLog } = await supabase
          .from('reconciliation_log' as 'characters')
          .select('created_at')
          .in('delegation_account_id', accountIds)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastLog = castRow<Pick<ReconciliationLog, 'created_at'> | null>(rawLastLog);
        lastRunAt = lastLog?.created_at ?? null;
      }

      return c.json({
        lastRunAt,
        activeAccountsChecked: activeCount ?? 0,
        driftsDetected: driftCount ?? 0,
        unreconciledCount: unreconciledCount ?? 0,
      }, 200);
    } catch {
      return c.json({ error: 'Failed to fetch reconciliation status', code: 'INTERNAL_ERROR' }, 500);
    }
  }
);

/**
 * GET /api/delegation/:characterId
 * Returns all agent_delegation_accounts for this character (including revoked history).
 * Also returns legacy delegation fields from the characters table.
 */
delegation.get(
  '/:characterId',
  delegationReadLimiter,
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);

    const characterId = c.req.param('characterId');
    if (!UuidSchema.safeParse(characterId).success) {
      return c.json({ error: 'Invalid character ID', code: 'VALIDATION_ERROR' }, 400);
    }

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Verify ownership — single literal string so Supabase can infer types
      const { data: character, error: charError } = await supabase
        .from('characters')
        .select('id, agent_pubkey, delegation_status, delegation_amount, delegation_remaining, delegation_token_mint, delegation_token_account, delegation_tx_signature')
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (charError || !character) {
        return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
      }

      // Fetch all multi-agent delegation accounts (full history including revoked)
      const { data: rawAccounts, error: accError } = await supabase
        .from('agent_delegation_accounts' as 'characters')
        .select('*')
        .eq('character_id', characterId)
        .order('created_at', { ascending: false });

      if (accError) {
        logger.error('Failed to fetch delegation accounts', { error: accError.message, characterId });
        return c.json({ error: 'Failed to fetch delegation accounts', code: 'DATABASE_ERROR' }, 500);
      }

      const accounts = castRows<AgentDelegationAccount>(rawAccounts ?? []);

      return c.json({
        characterId: character.id,
        // Legacy single-agent fields
        legacyDelegation: {
          agentPubkey: character.agent_pubkey,
          delegationStatus: character.delegation_status || 'none',
          delegationAmount: character.delegation_amount,
          delegationRemaining: character.delegation_remaining,
          delegationTokenMint: character.delegation_token_mint,
          delegationTokenAccount: character.delegation_token_account,
          delegationTxSignature: character.delegation_tx_signature,
        },
        // Multi-agent delegation accounts
        delegationAccounts: accounts.map((acc) => ({
          id: acc.id,
          tokenMint: acc.token_mint,
          tokenAccountAddress: acc.token_account_address,
          delegatePubkey: acc.delegate_pubkey,
          approvedAmount: acc.approved_amount,
          remainingAmount: acc.remaining_amount,
          delegationStatus: acc.delegation_status,
          delegationTxSignature: acc.delegation_tx_signature,
          revocationTxSignature: acc.revocation_tx_signature,
          closeTxSignature: acc.close_tx_signature,
          version: acc.version,
          reconciliationStatus: acc.reconciliation_status,
          lastReconciledAt: acc.last_reconciled_at,
          createdAt: acc.created_at,
          updatedAt: acc.updated_at,
        })),
      }, 200);
    } catch {
      return c.json({ error: 'Failed to fetch delegation status', code: 'INTERNAL_ERROR' }, 500);
    }
  }
);

/**
 * POST /api/delegation/:characterId/create
 * Register a newly-approved SPL delegation account in the database.
 *
 * Security: verifies that delegatePubkey matches the agent_turnkey_mapping
 * for this character, falling back to characters.agent_pubkey if no Turnkey
 * row exists.
 */
delegation.post(
  '/:characterId/create',
  delegationWriteLimiter,
  zValidator('json', createDelegationAccountSchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);

    const characterId = c.req.param('characterId');
    if (!UuidSchema.safeParse(characterId).success) {
      return c.json({ error: 'Invalid character ID', code: 'VALIDATION_ERROR' }, 400);
    }

    const input = c.req.valid('json');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Verify character ownership
      const { data: character, error: charError } = await supabase
        .from('characters')
        .select('id, agent_pubkey')
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (charError || !character) {
        return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
      }

      // Verify delegatePubkey matches the agent's expected key.
      // agent_turnkey_mapping is in the Database type so this is typed correctly.
      const { data: turnkeyRow } = await supabase
        .from('agent_turnkey_mapping' as 'characters')
        .select('turnkey_public_key')
        .eq('character_id', characterId)
        .maybeSingle();

      const typedTurnkeyRow = castRow<{ turnkey_public_key: string } | null>(turnkeyRow);
      const expectedDelegate: string | null =
        typedTurnkeyRow?.turnkey_public_key ?? character.agent_pubkey;

      if (!expectedDelegate) {
        return c.json(
          {
            error: 'No agent keypair registered for this character',
            code: 'NO_AGENT_KEY',
          },
          400
        );
      }

      if (input.delegatePubkey !== expectedDelegate) {
        logger.warn('Delegate pubkey mismatch on delegation create', {
          characterId,
          provided: input.delegatePubkey.slice(0, 8),
          expected: expectedDelegate.slice(0, 8),
        });
        return c.json(
          {
            error: 'delegatePubkey does not match registered agent key',
            code: 'DELEGATE_MISMATCH',
          },
          403
        );
      }

      // Insert delegation account row
      const { data: rawNew, error: insertError } = await supabase
        .from('agent_delegation_accounts' as 'characters')
        .insert({
          character_id: characterId,
          token_mint: input.tokenMint,
          token_account_address: input.tokenAccountAddress,
          delegate_pubkey: input.delegatePubkey,
          approved_amount: input.approvedAmount,
          remaining_amount: input.approvedAmount,
          delegation_status: 'active',
          delegation_tx_signature: input.delegationTxSignature,
          version: 1,
          reconciliation_status: 'ok',
        } as unknown as Record<string, unknown>)
        .select()
        .single();

      if (insertError || !rawNew) {
        logger.error('Failed to insert delegation account', { error: insertError?.message, characterId });
        return c.json({ error: 'Failed to create delegation account', code: 'DATABASE_ERROR' }, 500);
      }

      const newAccount = castRow<AgentDelegationAccount>(rawNew);

      logger.info('Delegation account created', {
        characterId,
        delegationAccountId: newAccount.id,
        tokenMint: input.tokenMint.slice(0, 8),
        approvedAmount: input.approvedAmount,
      });

      return c.json(
        {
          id: newAccount.id,
          characterId: newAccount.character_id,
          tokenMint: newAccount.token_mint,
          tokenAccountAddress: newAccount.token_account_address,
          delegatePubkey: newAccount.delegate_pubkey,
          approvedAmount: newAccount.approved_amount,
          remainingAmount: newAccount.remaining_amount,
          delegationStatus: newAccount.delegation_status,
          delegationTxSignature: newAccount.delegation_tx_signature,
          version: newAccount.version,
          reconciliationStatus: newAccount.reconciliation_status,
          createdAt: newAccount.created_at,
        },
        201
      );
    } catch {
      return c.json({ error: 'Failed to create delegation account', code: 'INTERNAL_ERROR' }, 500);
    }
  }
);

/**
 * PATCH /api/delegation/:characterId/update-balance
 * Record a balance decrease after a confirmed delegated transfer.
 *
 * Security:
 * - Advisory lock prevents concurrent balance races on the same account.
 * - Optimistic locking (version check) prevents lost-update anomalies.
 * - Service role only endpoint.
 */
delegation.patch(
  '/:characterId/update-balance',
  delegationWriteLimiter,
  zValidator('json', updateDelegationBalanceSchema),
  async (c) => {
    const characterId = c.req.param('characterId');
    if (!UuidSchema.safeParse(characterId).success) {
      return c.json({ error: 'Invalid character ID', code: 'VALIDATION_ERROR' }, 400);
    }

    const input = c.req.valid('json');

    // Internal service authentication: X-Internal-Secret must match INTERNAL_API_SECRET.
    // This endpoint is only callable by trusted internal services (e.g., Trigger.dev jobs),
    // not by arbitrary authenticated users.
    const internalSecret = c.req.header('X-Internal-Secret');
    const expectedSecret = process.env.INTERNAL_API_SECRET;
    if (!expectedSecret || internalSecret !== expectedSecret) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    try {
      const supabase = getServiceClient();

      // Validate remainingAmount is non-negative
      const remaining = BigInt(input.remainingAmount);
      if (remaining < 0n) {
        return c.json({ error: 'remainingAmount cannot be negative', code: 'VALIDATION_ERROR' }, 400);
      }

      // Acquire advisory lock to prevent concurrent balance races on this account.
      // pg_advisory_xact_lock is scoped to the current transaction and releases
      // automatically on commit or rollback.
      await supabase.rpc('pg_advisory_xact_lock_delegation', {
        p_account_id: input.delegationAccountId,
      } as unknown as Record<string, unknown>);

      // Fetch existing account to check version and status
      const { data: rawExisting, error: fetchError } = await supabase
        .from('agent_delegation_accounts' as 'characters')
        .select('id, character_id, remaining_amount, delegation_status, version')
        .eq('id', input.delegationAccountId)
        .eq('character_id', characterId)
        .single();

      if (fetchError || !rawExisting) {
        return c.json({ error: 'Delegation account not found', code: 'NOT_FOUND' }, 404);
      }

      const existingAccount = castRow<Pick<AgentDelegationAccount, 'id' | 'character_id' | 'remaining_amount' | 'delegation_status' | 'version'>>(rawExisting);

      if (existingAccount.delegation_status === 'revoked' || existingAccount.delegation_status === 'closed') {
        return c.json(
          {
            error: 'Delegation account is no longer active',
            code: 'DELEGATION_INACTIVE',
          },
          400
        );
      }

      // Optimistic locking: reject if version doesn't match
      if (existingAccount.version !== input.expectedVersion) {
        return c.json(
          {
            error: 'Version conflict — balance was modified by a concurrent operation',
            code: 'VERSION_CONFLICT',
            details: { expectedVersion: input.expectedVersion, currentVersion: existingAccount.version },
          },
          409
        );
      }

      const newStatus = remaining === 0n ? 'depleted' : existingAccount.delegation_status;

      // Update with version increment
      const { data: rawUpdated, error: updateError } = await supabase
        .from('agent_delegation_accounts' as 'characters')
        .update({
          remaining_amount: input.remainingAmount,
          delegation_status: newStatus,
          version: input.expectedVersion + 1,
          updated_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>)
        .eq('id', input.delegationAccountId)
        .eq('version', input.expectedVersion)
        .select()
        .single();

      if (updateError || !rawUpdated) {
        logger.error('Balance update failed (possible version race)', {
          accountId: input.delegationAccountId,
          error: updateError?.message,
        });
        return c.json({ error: 'Balance update failed', code: 'DATABASE_ERROR' }, 500);
      }

      const updated = castRow<AgentDelegationAccount>(rawUpdated);

      logger.info('Delegation balance updated', {
        accountId: input.delegationAccountId,
        remainingAmount: input.remainingAmount,
        newStatus,
        newVersion: updated.version,
      });

      return c.json(
        {
          id: updated.id,
          remainingAmount: updated.remaining_amount,
          delegationStatus: updated.delegation_status,
          version: updated.version,
          updatedAt: updated.updated_at,
        },
        200
      );
    } catch {
      return c.json({ error: 'Failed to update delegation balance', code: 'INTERNAL_ERROR' }, 500);
    }
  }
);

/**
 * POST /api/delegation/:characterId/revoke
 * Mark a delegation account as revoked after an on-chain revocation confirms.
 */
delegation.post(
  '/:characterId/revoke',
  delegationWriteLimiter,
  zValidator('json', revokeDelegationSchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);

    const characterId = c.req.param('characterId');
    if (!UuidSchema.safeParse(characterId).success) {
      return c.json({ error: 'Invalid character ID', code: 'VALIDATION_ERROR' }, 400);
    }

    const input = c.req.valid('json');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Verify character ownership
      const { data: character, error: charError } = await supabase
        .from('characters')
        .select('id')
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (charError || !character) {
        return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
      }

      // Verify account belongs to this character
      const { data: rawAccount, error: accError } = await supabase
        .from('agent_delegation_accounts' as 'characters')
        .select('id, delegation_status')
        .eq('id', input.delegationAccountId)
        .eq('character_id', characterId)
        .single();

      if (accError || !rawAccount) {
        return c.json({ error: 'Delegation account not found', code: 'NOT_FOUND' }, 404);
      }

      const account = castRow<Pick<AgentDelegationAccount, 'id' | 'delegation_status'>>(rawAccount);

      if (account.delegation_status === 'revoked' || account.delegation_status === 'closed') {
        return c.json(
          { error: 'Delegation account is already revoked or closed', code: 'ALREADY_REVOKED' },
          400
        );
      }

      const { data: rawUpdated, error: updateError } = await supabase
        .from('agent_delegation_accounts' as 'characters')
        .update({
          delegation_status: 'revoked',
          revocation_tx_signature: input.revocationTxSignature,
          updated_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>)
        .eq('id', input.delegationAccountId)
        .select()
        .single();

      if (updateError || !rawUpdated) {
        return c.json({ error: 'Failed to revoke delegation', code: 'DATABASE_ERROR' }, 500);
      }

      const updated = castRow<AgentDelegationAccount>(rawUpdated);

      logger.info('Delegation account revoked', {
        characterId,
        accountId: input.delegationAccountId,
        signature: input.revocationTxSignature.slice(0, 16),
      });

      return c.json(
        {
          id: updated.id,
          delegationStatus: updated.delegation_status,
          revocationTxSignature: updated.revocation_tx_signature,
          updatedAt: updated.updated_at,
        },
        200
      );
    } catch {
      return c.json({ error: 'Failed to revoke delegation', code: 'INTERNAL_ERROR' }, 500);
    }
  }
);

/**
 * POST /api/delegation/:characterId/top-up
 * Increase the approved_amount of an existing delegation after an on-chain top-up.
 * Restores 'depleted' accounts back to 'active'.
 */
delegation.post(
  '/:characterId/top-up',
  delegationWriteLimiter,
  zValidator('json', topUpDelegationSchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);

    const characterId = c.req.param('characterId');
    if (!UuidSchema.safeParse(characterId).success) {
      return c.json({ error: 'Invalid character ID', code: 'VALIDATION_ERROR' }, 400);
    }

    const input = c.req.valid('json');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Verify character ownership
      const { data: character, error: charError } = await supabase
        .from('characters')
        .select('id')
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (charError || !character) {
        return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
      }

      // Acquire advisory lock BEFORE reading account state to prevent TOCTOU races.
      await supabase.rpc('pg_advisory_xact_lock_delegation', {
        p_account_id: input.delegationAccountId,
      } as unknown as Record<string, unknown>);

      // Fetch current account state (inside the advisory lock)
      const { data: rawAccount, error: accError } = await supabase
        .from('agent_delegation_accounts' as 'characters')
        .select('id, delegation_status, remaining_amount, approved_amount, version')
        .eq('id', input.delegationAccountId)
        .eq('character_id', characterId)
        .single();

      if (accError || !rawAccount) {
        return c.json({ error: 'Delegation account not found', code: 'NOT_FOUND' }, 404);
      }

      const account = castRow<Pick<AgentDelegationAccount, 'id' | 'delegation_status' | 'remaining_amount' | 'approved_amount' | 'version'>>(rawAccount);

      if (account.delegation_status === 'revoked' || account.delegation_status === 'closed') {
        return c.json(
          { error: 'Cannot top up a revoked or closed delegation account', code: 'DELEGATION_INACTIVE' },
          400
        );
      }

      // Guard: newApprovedAmount must be >= current approved amount (no cap reduction).
      if (BigInt(input.newApprovedAmount) < BigInt(account.approved_amount)) {
        return c.json(
          { error: 'newApprovedAmount must be greater than or equal to current approved amount', code: 'VALIDATION_ERROR' },
          400
        );
      }

      // Compute new remaining_amount = current + additionalAmount
      const currentRemaining = BigInt(account.remaining_amount);
      const additional = BigInt(input.additionalAmount);
      const newRemaining = currentRemaining + additional;

      const newStatus =
        account.delegation_status === 'depleted' ? 'active' : account.delegation_status;

      const { data: rawUpdated, error: updateError } = await supabase
        .from('agent_delegation_accounts' as 'characters')
        .update({
          approved_amount: input.newApprovedAmount,
          remaining_amount: newRemaining.toString(),
          delegation_status: newStatus,
          delegation_tx_signature: input.delegationTxSignature,
          version: account.version + 1,
          updated_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>)
        .eq('id', input.delegationAccountId)
        .select()
        .single();

      if (updateError || !rawUpdated) {
        return c.json({ error: 'Failed to top up delegation', code: 'DATABASE_ERROR' }, 500);
      }

      const updated = castRow<AgentDelegationAccount>(rawUpdated);

      logger.info('Delegation account topped up', {
        characterId,
        accountId: input.delegationAccountId,
        additionalAmount: input.additionalAmount,
        newApprovedAmount: input.newApprovedAmount,
        newStatus,
      });

      return c.json(
        {
          id: updated.id,
          approvedAmount: updated.approved_amount,
          remainingAmount: updated.remaining_amount,
          delegationStatus: updated.delegation_status,
          version: updated.version,
          updatedAt: updated.updated_at,
        },
        200
      );
    } catch {
      return c.json({ error: 'Failed to top up delegation', code: 'INTERNAL_ERROR' }, 500);
    }
  }
);

/**
 * POST /api/delegation/:characterId/close
 * Permanently close a delegation account.
 * Only accounts in 'revoked' status may be closed.
 */
delegation.post(
  '/:characterId/close',
  delegationWriteLimiter,
  zValidator('json', closeDelegationSchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);

    const characterId = c.req.param('characterId');
    if (!UuidSchema.safeParse(characterId).success) {
      return c.json({ error: 'Invalid character ID', code: 'VALIDATION_ERROR' }, 400);
    }

    const input = c.req.valid('json');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Verify character ownership
      const { data: character, error: charError } = await supabase
        .from('characters')
        .select('id')
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (charError || !character) {
        return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
      }

      // Verify account belongs to character and is revoked
      const { data: rawAccount, error: accError } = await supabase
        .from('agent_delegation_accounts' as 'characters')
        .select('id, delegation_status')
        .eq('id', input.delegationAccountId)
        .eq('character_id', characterId)
        .single();

      if (accError || !rawAccount) {
        return c.json({ error: 'Delegation account not found', code: 'NOT_FOUND' }, 404);
      }

      const account = castRow<Pick<AgentDelegationAccount, 'id' | 'delegation_status'>>(rawAccount);

      if (account.delegation_status !== 'revoked') {
        return c.json(
          {
            error: 'Only revoked delegation accounts can be closed',
            code: 'INVALID_STATE',
            details: { currentStatus: account.delegation_status },
          },
          400
        );
      }

      const { data: rawUpdated, error: updateError } = await supabase
        .from('agent_delegation_accounts' as 'characters')
        .update({
          delegation_status: 'closed',
          close_tx_signature: input.closeTxSignature,
          updated_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>)
        .eq('id', input.delegationAccountId)
        .select()
        .single();

      if (updateError || !rawUpdated) {
        return c.json({ error: 'Failed to close delegation', code: 'DATABASE_ERROR' }, 500);
      }

      const updated = castRow<AgentDelegationAccount>(rawUpdated);

      logger.info('Delegation account closed', {
        characterId,
        accountId: input.delegationAccountId,
        signature: input.closeTxSignature.slice(0, 16),
      });

      return c.json(
        {
          id: updated.id,
          delegationStatus: updated.delegation_status,
          closeTxSignature: updated.close_tx_signature,
          updatedAt: updated.updated_at,
        },
        200
      );
    } catch {
      return c.json({ error: 'Failed to close delegation', code: 'INTERNAL_ERROR' }, 500);
    }
  }
);

// ===========================================================================
// LEGACY: Single-agent delegation endpoints (characters table fields)
// Preserved for backward compatibility with the existing frontend.
// ===========================================================================

const DelegationUpdateSchema = z.object({
  status: z.enum(['pending', 'active', 'revoked']),
  amount: z.string().regex(/^\d+$/, 'Must be a non-negative integer string').optional(),
  remaining: z.string().regex(/^\d+$/, 'Must be a non-negative integer string').optional(),
  tokenMint: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid base58 Solana address').optional(),
  tokenAccount: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid base58 Solana address').optional(),
  txSignature: z.string().min(1).max(200).optional(),
});

/**
 * POST /api/delegation/:characterId
 * Update legacy delegation status on the characters row after Phantom confirms.
 * Called by the client after the user approves/revokes in Phantom.
 */
delegation.post(
  '/:characterId',
  delegationWriteLimiter,
  zValidator('json', DelegationUpdateSchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);

    const characterId = c.req.param('characterId');
    if (!UuidSchema.safeParse(characterId).success) {
      return c.json({ error: 'Invalid character ID', code: 'VALIDATION_ERROR' }, 400);
    }

    const input = c.req.valid('json');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      const { data: existing, error: verifyError } = await supabase
        .from('characters')
        .select('id')
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (verifyError || !existing) {
        return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
      }

      const updateData: Record<string, unknown> = { delegation_status: input.status };
      if (input.amount !== undefined) updateData.delegation_amount = input.amount;
      if (input.remaining !== undefined) updateData.delegation_remaining = input.remaining;
      if (input.tokenMint !== undefined) updateData.delegation_token_mint = input.tokenMint;
      if (input.tokenAccount !== undefined) updateData.delegation_token_account = input.tokenAccount;
      if (input.txSignature !== undefined) updateData.delegation_tx_signature = input.txSignature;

      if (input.status === 'revoked') {
        updateData.delegation_remaining = null;
      }

      const { error: updateError } = await supabase
        .from('characters')
        .update(updateData)
        .eq('id', characterId);

      if (updateError) {
        return c.json({ error: 'Failed to update delegation', code: 'DATABASE_ERROR' }, 500);
      }

      return c.json({ success: true, status: input.status }, 200);
    } catch {
      return c.json({ error: 'Failed to update delegation', code: 'INTERNAL_ERROR' }, 500);
    }
  }
);

/**
 * GET /api/delegation/:characterId/transactions
 * Get agent transaction history (legacy, from agent_transactions table).
 */
delegation.get(
  '/:characterId/transactions',
  delegationReadLimiter,
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);

    const characterId = c.req.param('characterId');
    if (!UuidSchema.safeParse(characterId).success) {
      return c.json({ error: 'Invalid character ID', code: 'VALIDATION_ERROR' }, 400);
    }

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      const { data: character, error: verifyError } = await supabase
        .from('characters')
        .select('id')
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (verifyError || !character) {
        return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
      }

      const { data: transactions, error } = await supabase
        .from('agent_transactions')
        .select('*')
        .eq('character_id', characterId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        return c.json({ error: 'Failed to fetch transactions', code: 'DATABASE_ERROR' }, 500);
      }

      return c.json({
        transactions: (transactions || []).map((tx) => ({
          id: tx.id,
          txSignature: tx.tx_signature,
          amount: tx.amount,
          tokenMint: tx.token_mint,
          recipient: tx.recipient,
          url: tx.url,
          method: tx.method,
          status: tx.status,
          createdAt: tx.created_at,
        })),
      }, 200);
    } catch {
      return c.json({ error: 'Failed to fetch transactions', code: 'INTERNAL_ERROR' }, 500);
    }
  }
);

const TransferSchema = z.object({
  destinationTokenAccount: WalletAddressSchema,
  destinationOwner: WalletAddressSchema.optional(),
  amount: z.string().regex(/^\d+$/, 'Amount must be a positive integer string'),
  decimals: z.number().int().min(0).max(18),
  tokenMint: WalletAddressSchema,
  url: z.string().url().optional(),
  method: z.string().max(50).optional(),
});

/**
 * POST /api/delegation/:characterId/transfer
 * Execute a delegated transfer from the agent.
 * The agent signs the transaction server-side using its encrypted keypair.
 */
delegation.post(
  '/:characterId/transfer',
  delegationWriteLimiter,
  zValidator('json', TransferSchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);

    const characterId = c.req.param('characterId');
    if (!UuidSchema.safeParse(characterId).success) {
      return c.json({ error: 'Invalid character ID', code: 'VALIDATION_ERROR' }, 400);
    }

    const input = c.req.valid('json');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      const { data: character, error: verifyError } = await supabase
        .from('characters')
        .select('id, agent_pubkey, delegation_status, delegation_token_mint, delegation_token_account, delegation_remaining, wallet_address')
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (verifyError || !character) {
        return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
      }

      if (character.delegation_status !== 'active') {
        return c.json({ error: 'No active delegation', code: 'DELEGATION_INACTIVE' }, 400);
      }

      if (!character.agent_pubkey) {
        return c.json({ error: 'Agent has no keypair', code: 'NO_AGENT_KEY' }, 400);
      }

      // Guard: transfer amount must not exceed delegation remaining.
      if (character.delegation_remaining !== null && character.delegation_remaining !== undefined) {
        if (BigInt(input.amount) > BigInt(character.delegation_remaining)) {
          return c.json({ error: 'Transfer amount exceeds delegation remaining', code: 'EXCEEDS_LIMIT' }, 400);
        }
      }

      const { executeAgentTransfer } = await import('@/lib/agent-wallet/transfer');
      const result = await executeAgentTransfer({
        characterId,
        ownerAddress: character.wallet_address,
        destinationTokenAccount: input.destinationTokenAccount,
        destinationOwner: input.destinationOwner,
        amount: BigInt(input.amount),
        decimals: input.decimals,
        tokenMint: input.tokenMint,
      });

      await supabase.from('agent_transactions').insert({
        character_id: characterId,
        tx_signature: result.signature,
        amount: input.amount,
        token_mint: input.tokenMint,
        recipient: input.destinationTokenAccount,
        url: input.url || null,
        method: input.method || 'delegation_transfer',
        status: 'confirmed',
      });

      const currentRemaining = character.delegation_remaining
        ? BigInt(character.delegation_remaining)
        : null;
      if (currentRemaining !== null) {
        const spent = BigInt(input.amount);
        const newRemaining = currentRemaining > spent ? currentRemaining - spent : 0n;
        await supabase
          .from('characters')
          .update({ delegation_remaining: newRemaining.toString() })
          .eq('id', characterId);
      }

      logger.info('Agent transfer executed', {
        characterId,
        signature: result.signature,
        amount: input.amount,
        tokenMint: input.tokenMint,
      });

      return c.json({ success: true, signature: result.signature, amount: result.amount }, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transfer failed';
      logger.error('Agent transfer failed', { characterId, error: message });
      return c.json({ error: message, code: 'TRANSFER_FAILED' }, 500);
    }
  }
);

export { delegation };
