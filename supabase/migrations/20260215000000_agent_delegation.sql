-- Add agent wallet and delegation tracking to characters
ALTER TABLE characters ADD COLUMN IF NOT EXISTS agent_pubkey TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS delegation_status TEXT NOT NULL DEFAULT 'none';
-- delegation_status: 'none' | 'pending' | 'active' | 'revoked'
ALTER TABLE characters ADD COLUMN IF NOT EXISTS delegation_amount TEXT;
-- Amount stored as string to preserve bigint precision
ALTER TABLE characters ADD COLUMN IF NOT EXISTS delegation_remaining TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS delegation_token_mint TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS delegation_token_account TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS delegation_tx_signature TEXT;
-- Last delegation-related transaction signature

-- Create agent_transactions table for spending history
CREATE TABLE IF NOT EXISTS agent_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  tx_signature TEXT NOT NULL,
  amount TEXT NOT NULL,
  token_mint TEXT NOT NULL,
  recipient TEXT NOT NULL,
  url TEXT,
  method TEXT DEFAULT 'GET',
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_transactions_character_id ON agent_transactions(character_id);
CREATE INDEX IF NOT EXISTS idx_agent_transactions_created_at ON agent_transactions(created_at);

-- RLS
ALTER TABLE agent_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_transactions_select_own ON agent_transactions
  FOR SELECT USING (
    character_id IN (
      SELECT id FROM characters WHERE wallet_address = auth.jwt() ->> 'wallet_address'
    )
  );

CREATE POLICY agent_transactions_insert_service ON agent_transactions
  FOR INSERT WITH CHECK (true);
-- Service role inserts transactions (not end users)
