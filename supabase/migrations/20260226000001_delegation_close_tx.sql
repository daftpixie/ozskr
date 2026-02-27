-- Migration: Add close_tx_signature to agent_delegation_accounts
-- Run after: 20260226000000_multi_agent_delegation.sql
--
-- Adds the close_tx_signature column for tracking the on-chain closeAccount
-- transaction, and updates the partial unique index to also exclude 'closed'
-- delegation accounts (so a new delegation can be created after an account
-- is swept and closed).
-- ---------------------------------------------------------------------------

-- Add close_tx_signature column (idempotent: no-op if already exists)
ALTER TABLE agent_delegation_accounts
  ADD COLUMN IF NOT EXISTS close_tx_signature TEXT;

-- Update the partial unique index to also exclude 'closed' rows.
-- Drop the old index and recreate with the updated WHERE clause.
DROP INDEX IF EXISTS idx_agent_delegation_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_delegation_active
  ON agent_delegation_accounts(character_id, token_mint)
  WHERE delegation_status NOT IN ('revoked', 'depleted', 'closed');

-- Update the comment on delegation_status to reflect 'closed' as a valid value
COMMENT ON COLUMN agent_delegation_accounts.delegation_status IS
  'pending | active | depleted | revoked | closed';
