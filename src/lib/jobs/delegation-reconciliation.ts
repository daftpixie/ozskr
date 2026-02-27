/**
 * Delegation Reconciliation Service
 * Compares on-chain SPL token account delegation state against the DB.
 *
 * This plain async function is the business logic layer.
 * The Trigger.dev task wrapper lives in src/trigger/reconcile-delegations.ts.
 *
 * Drift classifications:
 *   delegate_mismatch  — on-chain delegate is null/zero but DB shows 'active'
 *   account_missing    — token account does not exist on-chain
 *   amount_drift       — on-chain delegated_amount < DB remaining by >1%
 *   unexpected_topup   — on-chain delegated_amount > DB remaining
 *
 * Auto-revocation:
 *   delegate_mismatch + account_missing → auto_revoked
 *   amount_drift + unexpected_topup     → flagged (no auto-correction)
 */

import { createSupabaseServerClient } from '@/lib/api/supabase';
import { logger } from '@/lib/utils/logger';

/** Batch size for processing active delegation accounts */
const BATCH_SIZE = 100;

/** Percentage threshold (1%) below which an amount difference is considered drift */
const DRIFT_THRESHOLD_PCT = 0.01;

export interface ReconciliationStats {
  checked: number;
  driftsDetected: number;
  autoRevoked: number;
}

interface DelegationAccountRow {
  id: string;
  character_id: string;
  token_account_address: string;
  delegate_pubkey: string;
  remaining_amount: string;
  delegation_status: string;
  version: number;
}

interface OnChainDelegationInfo {
  exists: boolean;
  delegatedAmount?: bigint;
  /** null means delegate authority is absent */
  delegate?: string | null;
}

/**
 * Check on-chain delegation state for a batch of token accounts.
 *
 * Bridges between the job's OnChainDelegationInfo shape and the
 * AgentDelegationStatus returned by @/lib/solana/delegation.
 *
 * Account existence is determined by tokenMint !== TOKEN_PROGRAM_ID —
 * the delegation library uses TOKEN_PROGRAM_ID as a placeholder mint when
 * an account is absent, since a real token account can never have a program
 * ID as its mint.
 */
async function fetchOnChainDelegations(
  tokenAccountAddresses: string[]
): Promise<Map<string, OnChainDelegationInfo>> {
  const results = new Map<string, OnChainDelegationInfo>();

  // Pre-populate with unknown state so the loop can always find an entry
  for (const addr of tokenAccountAddresses) {
    results.set(addr, { exists: true, delegatedAmount: undefined, delegate: undefined });
  }

  const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  if (!rpcUrl) {
    logger.warn('delegation-reconciliation: NEXT_PUBLIC_HELIUS_RPC_URL not set, skipping on-chain checks');
    return results;
  }

  try {
    const { createSolanaRpc, address: toAddress } = await import('@solana/kit');
    const { checkAllAgentDelegations, TOKEN_PROGRAM_ID } = await import('@/lib/solana/delegation');

    const rpc = createSolanaRpc(rpcUrl);
    const addresses = tokenAccountAddresses.map((a) => toAddress(a));
    const onChainData = await checkAllAgentDelegations(rpc, addresses);

    for (const [addr, status] of onChainData.entries()) {
      // Account is absent when tokenMint equals the TOKEN_PROGRAM_ID placeholder
      const exists = status.tokenMint !== TOKEN_PROGRAM_ID;
      results.set(addr, {
        exists,
        delegatedAmount: status.remainingAmount,
        delegate: status.delegate ? String(status.delegate) : null,
      });
    }
  } catch (err) {
    logger.warn('delegation-reconciliation: on-chain check failed, skipping', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return results;
}

/**
 * Determine the drift classification and action for a single account.
 * Returns null if no drift is detected or if on-chain state is unknown.
 */
function classifyDrift(
  account: DelegationAccountRow,
  onChain: OnChainDelegationInfo
): {
  driftType: 'delegate_mismatch' | 'account_missing' | 'amount_drift' | 'unexpected_topup';
  actionTaken: 'auto_revoked' | 'flagged';
  onChainAmount: string | null;
} | null {
  // On-chain state unknown (module unavailable) — skip
  if (onChain.delegatedAmount === undefined && onChain.delegate === undefined) {
    return null;
  }

  // Account does not exist on-chain
  if (!onChain.exists) {
    return {
      driftType: 'account_missing',
      actionTaken: 'auto_revoked',
      onChainAmount: null,
    };
  }

  // Delegate authority has been revoked on-chain
  if (onChain.delegate === null || onChain.delegate === undefined) {
    return {
      driftType: 'delegate_mismatch',
      actionTaken: 'auto_revoked',
      onChainAmount: onChain.delegatedAmount !== undefined
        ? onChain.delegatedAmount.toString()
        : null,
    };
  }

  // Amount comparison (only when delegatedAmount is known)
  if (onChain.delegatedAmount !== undefined) {
    const dbRemaining = BigInt(account.remaining_amount);
    const onChainAmount = onChain.delegatedAmount;

    if (dbRemaining > 0n) {
      const diff = dbRemaining > onChainAmount ? dbRemaining - onChainAmount : onChainAmount - dbRemaining;
      const pctDiff = Number(diff) / Number(dbRemaining);

      if (onChainAmount < dbRemaining && pctDiff > DRIFT_THRESHOLD_PCT) {
        return {
          driftType: 'amount_drift',
          actionTaken: 'flagged',
          onChainAmount: onChainAmount.toString(),
        };
      }

      if (onChainAmount > dbRemaining) {
        return {
          driftType: 'unexpected_topup',
          actionTaken: 'flagged',
          onChainAmount: onChainAmount.toString(),
        };
      }
    }
  }

  return null;
}

/**
 * Process one batch of active delegation accounts.
 * Returns per-batch stats.
 */
async function processBatch(
  accounts: DelegationAccountRow[],
  supabase: ReturnType<typeof createSupabaseServerClient>
): Promise<{ driftsDetected: number; autoRevoked: number }> {
  const tokenAddresses = accounts.map((a) => a.token_account_address);
  const onChainMap = await fetchOnChainDelegations(tokenAddresses);

  let driftsDetected = 0;
  let autoRevoked = 0;

  const now = new Date().toISOString();

  for (const account of accounts) {
    const onChain = onChainMap.get(account.token_account_address) ?? {
      exists: true,
      delegatedAmount: undefined,
      delegate: undefined,
    };

    const drift = classifyDrift(account, onChain);

    try {
      if (drift !== null) {
        driftsDetected++;

        // Write reconciliation log entry (column names match migration schema)
        await supabase.from('reconciliation_log').insert({
          delegation_account_id: account.id,
          drift_type: drift.driftType,
          action_taken: drift.actionTaken,
          on_chain_value: drift.onChainAmount,
          off_chain_value: account.remaining_amount,
        });

        // Apply action
        if (drift.actionTaken === 'auto_revoked') {
          autoRevoked++;

          await supabase
            .from('agent_delegation_accounts')
            .update({
              delegation_status: 'revoked',
              reconciliation_status: 'drift_detected',
              last_reconciled_at: now,
              updated_at: now,
            })
            .eq('id', account.id);
        } else {
          // flagged — do not auto-correct amount, just mark drift
          await supabase
            .from('agent_delegation_accounts')
            .update({
              reconciliation_status: 'drift_detected',
              last_reconciled_at: now,
              updated_at: now,
            })
            .eq('id', account.id);
        }
      } else {
        // No drift — just update last_reconciled_at
        await supabase
          .from('agent_delegation_accounts')
          .update({
            reconciliation_status: 'ok',
            last_reconciled_at: now,
            updated_at: now,
          })
          .eq('id', account.id);
      }
    } catch (err) {
      // Log but continue processing remaining accounts
      logger.error('delegation-reconciliation: error processing account', {
        accountId: account.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { driftsDetected, autoRevoked };
}

/**
 * Reconcile all active agent_delegation_accounts against their on-chain state.
 *
 * @returns Stats summarising the reconciliation run.
 */
export async function reconcileDelegations(): Promise<ReconciliationStats> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  }

  const supabase = createSupabaseServerClient(serviceRoleKey);

  let offset = 0;
  let checked = 0;
  let totalDrifts = 0;
  let totalAutoRevoked = 0;

  // Paginate through all active accounts in batches
  while (true) {
    const { data: accounts, error } = await supabase
      .from('agent_delegation_accounts')
      .select(
        'id, character_id, token_account_address, delegate_pubkey, remaining_amount, delegation_status, version'
      )
      .eq('delegation_status', 'active')
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch delegation accounts for reconciliation: ${error.message}`);
    }

    if (!accounts || accounts.length === 0) {
      break;
    }

    const batchStats = await processBatch(
      accounts as DelegationAccountRow[],
      supabase
    );

    checked += accounts.length;
    totalDrifts += batchStats.driftsDetected;
    totalAutoRevoked += batchStats.autoRevoked;

    if (accounts.length < BATCH_SIZE) {
      break;
    }

    offset += BATCH_SIZE;
  }

  logger.info('delegation-reconciliation: run complete', {
    checked,
    driftsDetected: totalDrifts,
    autoRevoked: totalAutoRevoked,
  });

  return {
    checked,
    driftsDetected: totalDrifts,
    autoRevoked: totalAutoRevoked,
  };
}
