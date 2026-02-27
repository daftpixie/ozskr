import { schedules } from '@trigger.dev/sdk/v3';
import { reconcileDelegations } from '@/lib/jobs/delegation-reconciliation';

/**
 * Scheduled task: runs every minute, reconciles active agent_delegation_accounts
 * against their on-chain SPL token account state.
 *
 * Any drift (revoked delegate, missing account, amount mismatch) is logged to
 * reconciliation_log. Hard mismatches (delegate_mismatch, account_missing) are
 * auto-revoked in the DB. Soft mismatches (amount_drift, unexpected_topup) are
 * flagged for manual review.
 */
export const reconcileDelegationsTask = schedules.task({
  id: 'reconcile-delegations',
  cron: '* * * * *',
  retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 1000 },
  run: async () => {
    return reconcileDelegations();
  },
});
