-- Migration: multi_agent_delegation
-- Introduces agent_delegation_accounts as the canonical delegation record,
-- replacing the flat columns on characters (which are deprecated but NOT
-- dropped — backward-compatible migration).
-- Also adds reconciliation_log for on-chain drift detection.
-- Idempotent: all DDL uses IF NOT EXISTS / IF EXISTS guards.

-- ---------------------------------------------------------------------------
-- agent_delegation_accounts
-- One row per (character, token_mint) delegation event.
-- Revoked/depleted rows are kept for audit history; only one non-revoked row
-- per (character_id, token_mint) is enforced via a partial unique index.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_delegation_accounts (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id           UUID        NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  wallet_address         TEXT        NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  token_mint             TEXT        NOT NULL,
  token_account_address  TEXT        NOT NULL,  -- PDA-derived token account pubkey
  delegate_pubkey        TEXT        NOT NULL,  -- Agent's Turnkey pubkey (the delegate)
  delegation_status      TEXT        NOT NULL DEFAULT 'pending',
  -- delegation_status values: pending | active | depleted | revoked
  approved_amount        TEXT        NOT NULL,  -- BigInt stored as string (u64 max: 18446744073709551615)
  remaining_amount       TEXT        NOT NULL,  -- BigInt stored as string
  delegation_tx_signature  TEXT,
  revocation_tx_signature  TEXT,
  version                INTEGER     NOT NULL DEFAULT 1,   -- optimistic locking counter
  last_reconciled_at     TIMESTAMPTZ,
  reconciliation_status  TEXT        NOT NULL DEFAULT 'unverified',
  -- reconciliation_status values: ok | drift_detected | unverified
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index: only one non-revoked/non-depleted delegation per
-- (character_id, token_mint) at a time.  Revoked/depleted rows are kept for
-- audit history and are excluded from the uniqueness constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_delegation_active
  ON agent_delegation_accounts(character_id, token_mint)
  WHERE delegation_status NOT IN ('revoked', 'depleted');

-- Standard query indexes
CREATE INDEX IF NOT EXISTS idx_agent_delegation_character_id
  ON agent_delegation_accounts(character_id);

CREATE INDEX IF NOT EXISTS idx_agent_delegation_wallet_address
  ON agent_delegation_accounts(wallet_address);

CREATE INDEX IF NOT EXISTS idx_agent_delegation_status
  ON agent_delegation_accounts(delegation_status);

CREATE INDEX IF NOT EXISTS idx_agent_delegation_token_mint
  ON agent_delegation_accounts(token_mint);

-- Sparse index: only rows that need attention surface quickly for the
-- reconciliation job without scanning the entire table.
CREATE INDEX IF NOT EXISTS idx_agent_delegation_reconciliation_needs_attention
  ON agent_delegation_accounts(reconciliation_status)
  WHERE reconciliation_status != 'ok';

-- ---------------------------------------------------------------------------
-- RLS on agent_delegation_accounts
-- ---------------------------------------------------------------------------

ALTER TABLE agent_delegation_accounts ENABLE ROW LEVEL SECURITY;

-- Users may SELECT their own delegation accounts (via wallet_address ownership)
CREATE POLICY "Users can select their own delegation accounts"
  ON agent_delegation_accounts FOR SELECT
  USING (wallet_address = auth.jwt() ->> 'wallet_address');

-- Users may INSERT their own delegation accounts
CREATE POLICY "Users can insert their own delegation accounts"
  ON agent_delegation_accounts FOR INSERT
  WITH CHECK (wallet_address = auth.jwt() ->> 'wallet_address');

-- Users may UPDATE their own delegation accounts (e.g. record revocation sig)
CREATE POLICY "Users can update their own delegation accounts"
  ON agent_delegation_accounts FOR UPDATE
  USING (wallet_address = auth.jwt() ->> 'wallet_address');

-- Users may DELETE their own delegation accounts (logical delete via status
-- preferred, but allowed for data portability)
CREATE POLICY "Users can delete their own delegation accounts"
  ON agent_delegation_accounts FOR DELETE
  USING (wallet_address = auth.jwt() ->> 'wallet_address');

-- Service role: SELECT only (reconciliation reads)
CREATE POLICY "Service role can select delegation accounts for reconciliation"
  ON agent_delegation_accounts FOR SELECT
  USING (auth.role() = 'service_role');

-- Service role: UPDATE only (reconciliation writes — update remaining_amount,
-- reconciliation_status, last_reconciled_at, version)
CREATE POLICY "Service role can update delegation accounts for reconciliation"
  ON agent_delegation_accounts FOR UPDATE
  USING (auth.role() = 'service_role');

-- NOTE: service role intentionally has NO INSERT or DELETE policy on this table.
-- All delegation records are created by authenticated users via the API layer.

-- ---------------------------------------------------------------------------
-- Link agent_transactions to agent_delegation_accounts
-- ---------------------------------------------------------------------------

ALTER TABLE agent_transactions
  ADD COLUMN IF NOT EXISTS delegation_account_id UUID
    REFERENCES agent_delegation_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_transactions_delegation_account
  ON agent_transactions(delegation_account_id)
  WHERE delegation_account_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- reconciliation_log
-- Append-only audit log of on-chain drift events detected during
-- background reconciliation jobs. Never modified after insert.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reconciliation_log (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_account_id UUID        NOT NULL REFERENCES agent_delegation_accounts(id),
  drift_type            TEXT        NOT NULL,
  -- drift_type values:
  --   delegate_mismatch  — on-chain delegate != delegate_pubkey in DB
  --   amount_drift       — on-chain delegated_amount != remaining_amount in DB
  --   account_missing    — token account no longer exists on-chain
  --   account_closed     — token account is closed (zero lamports)
  --   unexpected_topup   — on-chain amount increased without an explicit top-up tx
  on_chain_value        TEXT,
  off_chain_value       TEXT,
  action_taken          TEXT        NOT NULL,
  -- action_taken values: auto_revoked | flagged | no_action
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_log_delegation_account
  ON reconciliation_log(delegation_account_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_log_created_at
  ON reconciliation_log(created_at);

-- ---------------------------------------------------------------------------
-- RLS on reconciliation_log
-- Service role only: background reconciliation jobs read and write; no direct
-- user access (users see the effect via delegation_account state).
-- ---------------------------------------------------------------------------

ALTER TABLE reconciliation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can select reconciliation log"
  ON reconciliation_log FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can insert reconciliation log"
  ON reconciliation_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Deprecation comments on characters columns
-- These columns remain to support read access during the migration period.
-- All new code should use agent_delegation_accounts instead.
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN characters.delegation_status IS
  'DEPRECATED — use agent_delegation_accounts.delegation_status instead. '
  'Retained for backward compatibility during migration to agent_delegation_accounts.';

COMMENT ON COLUMN characters.delegation_amount IS
  'DEPRECATED — use agent_delegation_accounts.approved_amount instead. '
  'Retained for backward compatibility during migration to agent_delegation_accounts.';

COMMENT ON COLUMN characters.delegation_remaining IS
  'DEPRECATED — use agent_delegation_accounts.remaining_amount instead. '
  'Retained for backward compatibility during migration to agent_delegation_accounts.';

COMMENT ON COLUMN characters.delegation_token_mint IS
  'DEPRECATED — use agent_delegation_accounts.token_mint instead. '
  'Retained for backward compatibility during migration to agent_delegation_accounts.';

COMMENT ON COLUMN characters.delegation_token_account IS
  'DEPRECATED — use agent_delegation_accounts.token_account_address instead. '
  'Retained for backward compatibility during migration to agent_delegation_accounts.';

COMMENT ON COLUMN characters.delegation_tx_signature IS
  'DEPRECATED — use agent_delegation_accounts.delegation_tx_signature instead. '
  'Retained for backward compatibility during migration to agent_delegation_accounts.';

-- ---------------------------------------------------------------------------
-- Data migration (idempotent)
-- Backfill agent_delegation_accounts from existing characters rows that have
-- an active delegation with a known token account AND a known agent pubkey.
-- Rows without agent_pubkey are skipped (no delegate_pubkey to store).
-- ON CONFLICT DO NOTHING ensures safe re-runs.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  rec RECORD;
  inserted_count INTEGER := 0;
  skipped_count  INTEGER := 0;
BEGIN
  FOR rec IN
    SELECT
      id,
      wallet_address,
      delegation_token_mint,
      delegation_token_account,
      agent_pubkey,
      delegation_amount,
      delegation_remaining,
      delegation_tx_signature
    FROM characters
    WHERE delegation_status = 'active'
      AND delegation_token_account IS NOT NULL
      AND agent_pubkey IS NOT NULL
  LOOP
    INSERT INTO agent_delegation_accounts (
      character_id,
      wallet_address,
      token_mint,
      token_account_address,
      delegate_pubkey,
      delegation_status,
      approved_amount,
      remaining_amount,
      delegation_tx_signature,
      reconciliation_status
    )
    VALUES (
      rec.id,
      rec.wallet_address,
      COALESCE(rec.delegation_token_mint, ''),
      rec.delegation_token_account,
      rec.agent_pubkey,
      'active',
      COALESCE(rec.delegation_amount, '0'),
      COALESCE(rec.delegation_remaining, COALESCE(rec.delegation_amount, '0')),
      rec.delegation_tx_signature,
      'unverified'
    )
    ON CONFLICT DO NOTHING;

    IF FOUND THEN
      inserted_count := inserted_count + 1;
    ELSE
      skipped_count := skipped_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'agent_delegation_accounts backfill: inserted=%, skipped=%',
    inserted_count, skipped_count;
END;
$$;
