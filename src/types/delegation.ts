/**
 * Delegation Types and Zod Schemas
 * Canonical schemas for agent_delegation_accounts and related operations.
 * All amount fields represent u64 token amounts as decimal strings.
 */

import { z } from 'zod';

// =============================================================================
// STATUS UNIONS
// =============================================================================

export type DelegationStatus = 'pending' | 'active' | 'depleted' | 'revoked' | 'closed';

export type ReconciliationStatus = 'ok' | 'drift_detected' | 'unverified';

export type DriftType =
  | 'delegate_mismatch'
  | 'amount_drift'
  | 'account_missing'
  | 'account_closed'
  | 'unexpected_topup';

export type ReconciliationAction = 'auto_revoked' | 'flagged' | 'no_action';

// =============================================================================
// PRIMITIVE VALIDATORS
// =============================================================================

/**
 * Solana base58 address: 32–44 characters, no 0/O/I/l confusable chars.
 * Matches both wallet addresses and token account PDAs.
 */
const solanaAddressSchema = z
  .string()
  .regex(
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    'Invalid base58 Solana address'
  );

/**
 * Token amount stored as a decimal string representing a non-negative u64.
 * Range: 0 – 18446744073709551615 (2^64 - 1).
 */
const tokenAmountSchema = z
  .string()
  .regex(/^\d+$/, 'Must be a non-negative integer string')
  .refine(
    (val) => {
      try {
        const n = BigInt(val);
        return n >= 0n && n <= 18446744073709551615n;
      } catch {
        return false;
      }
    },
    'Amount out of range (must be a valid u64)'
  );

// =============================================================================
// FULL ROW SCHEMA
// =============================================================================

/**
 * Full agent_delegation_accounts row as returned from Supabase.
 */
export const agentDelegationAccountSchema = z.object({
  id: z.string().uuid(),
  character_id: z.string().uuid(),
  wallet_address: z.string(),
  token_mint: solanaAddressSchema,
  token_account_address: solanaAddressSchema,
  delegate_pubkey: solanaAddressSchema,
  delegation_status: z.enum(['pending', 'active', 'depleted', 'revoked', 'closed']),
  approved_amount: tokenAmountSchema,
  remaining_amount: tokenAmountSchema,
  delegation_tx_signature: z.string().nullable(),
  revocation_tx_signature: z.string().nullable(),
  close_tx_signature: z.string().nullable(),
  version: z.number().int().positive(),
  last_reconciled_at: z.string().datetime({ offset: true }).nullable(),
  reconciliation_status: z.enum(['ok', 'drift_detected', 'unverified']),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export type AgentDelegationAccount = z.infer<typeof agentDelegationAccountSchema>;

// =============================================================================
// MUTATION SCHEMAS
// =============================================================================

/**
 * Input to create a new delegation account row.
 * wallet_address is resolved server-side from the JWT — not accepted from client.
 * version and timestamps are set by the database.
 */
export const createDelegationAccountSchema = z.object({
  characterId: z.string().uuid(),
  tokenMint: solanaAddressSchema,
  tokenAccountAddress: solanaAddressSchema,
  delegatePubkey: solanaAddressSchema,
  approvedAmount: tokenAmountSchema,
  /** Optional: only present when the on-chain transaction is already confirmed. */
  delegationTxSignature: z.string().min(1).optional(),
});

export type CreateDelegationAccountInput = z.infer<typeof createDelegationAccountSchema>;

/**
 * Transition a delegation account to a new status.
 * revocationTxSignature is required when transitioning to 'revoked'.
 */
export const updateDelegationStatusSchema = z
  .object({
    delegationAccountId: z.string().uuid(),
    status: z.enum(['pending', 'active', 'depleted', 'revoked']),
    revocationTxSignature: z.string().min(1).optional(),
  })
  .refine(
    (data) =>
      data.status !== 'revoked' || data.revocationTxSignature !== undefined,
    {
      message: 'revocationTxSignature is required when status is "revoked"',
      path: ['revocationTxSignature'],
    }
  );

export type UpdateDelegationStatusInput = z.infer<typeof updateDelegationStatusSchema>;

/**
 * Decrement remaining_amount after a successful agent transfer.
 * Includes expectedVersion for optimistic locking — the update MUST be
 * conditional on version matching to prevent lost-update races.
 */
export const updateDelegationBalanceSchema = z.object({
  delegationAccountId: z.string().uuid(),
  remainingAmount: tokenAmountSchema,
  /** On-chain transaction signature that reduced the balance. */
  txSignature: z.string().min(1),
  /** The current version value read before this update — used for optimistic lock. */
  expectedVersion: z.number().int().positive(),
});

export type UpdateDelegationBalanceInput = z.infer<typeof updateDelegationBalanceSchema>;

/**
 * Top up an existing active delegation.
 * additionalAmount is the incremental amount added; newApprovedAmount is the
 * new total cap (approved_amount) after the top-up, and must be >= current
 * approved_amount.  The caller is responsible for ensuring consistency between
 * the two values.
 */
export const topUpDelegationSchema = z.object({
  delegationAccountId: z.string().uuid(),
  additionalAmount: tokenAmountSchema,
  newApprovedAmount: tokenAmountSchema,
  /** On-chain transaction signature for the top-up approveChecked call. */
  delegationTxSignature: z.string().min(1),
});

export type TopUpDelegationInput = z.infer<typeof topUpDelegationSchema>;

/**
 * POST /delegation/:characterId/revoke
 * Mark a delegation as revoked after the on-chain revocation transaction confirms.
 */
export const revokeDelegationSchema = z.object({
  delegationAccountId: z.string().uuid(),
  revocationTxSignature: z.string().min(1),
});

export type RevokeDelegationInput = z.infer<typeof revokeDelegationSchema>;

/**
 * POST /delegation/:characterId/close
 * Permanently close a revoked delegation account after the on-chain
 * closeAccount transaction confirms. Only revoked accounts may be closed.
 */
export const closeDelegationSchema = z.object({
  delegationAccountId: z.string().uuid(),
  closeTxSignature: z.string().min(1),
});

export type CloseDelegationInput = z.infer<typeof closeDelegationSchema>;

// =============================================================================
// RECONCILIATION SCHEMAS
// =============================================================================

/**
 * Full reconciliation_log row.
 */
export const reconciliationLogSchema = z.object({
  id: z.string().uuid(),
  delegation_account_id: z.string().uuid(),
  drift_type: z.enum([
    'delegate_mismatch',
    'amount_drift',
    'account_missing',
    'account_closed',
    'unexpected_topup',
  ]),
  on_chain_value: z.string().nullable(),
  off_chain_value: z.string().nullable(),
  action_taken: z.enum(['auto_revoked', 'flagged', 'no_action']),
  created_at: z.string().datetime({ offset: true }),
});

export type ReconciliationLog = z.infer<typeof reconciliationLogSchema>;

/**
 * Input to create a reconciliation_log entry (service role only).
 */
export const createReconciliationLogSchema = z.object({
  delegationAccountId: z.string().uuid(),
  driftType: z.enum([
    'delegate_mismatch',
    'amount_drift',
    'account_missing',
    'account_closed',
    'unexpected_topup',
  ]),
  onChainValue: z.string().nullable(),
  offChainValue: z.string().nullable(),
  actionTaken: z.enum(['auto_revoked', 'flagged', 'no_action']),
});

export type CreateReconciliationLogInput = z.infer<typeof createReconciliationLogSchema>;

// =============================================================================
// API RESPONSE SCHEMAS
// =============================================================================

/**
 * Public-facing delegation account response (camelCase, safe to return to
 * authenticated users — omits internal reconciliation details).
 */
export const delegationAccountResponseSchema = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  tokenMint: solanaAddressSchema,
  tokenAccountAddress: solanaAddressSchema,
  delegatePubkey: solanaAddressSchema,
  delegationStatus: z.enum(['pending', 'active', 'depleted', 'revoked', 'closed']),
  approvedAmount: tokenAmountSchema,
  remainingAmount: tokenAmountSchema,
  delegationTxSignature: z.string().nullable(),
  revocationTxSignature: z.string().nullable(),
  closeTxSignature: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type DelegationAccountResponse = z.infer<typeof delegationAccountResponseSchema>;
