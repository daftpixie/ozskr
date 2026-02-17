-- Agent Turnkey TEE wallet mapping
-- Maps character IDs to Turnkey wallet IDs and public keys.
-- No secret material stored — only UUID → Turnkey wallet ID mappings.

CREATE TABLE IF NOT EXISTS agent_turnkey_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  turnkey_wallet_id TEXT NOT NULL,
  turnkey_public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(character_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_turnkey_mapping_character_id
  ON agent_turnkey_mapping(character_id);

-- RLS: Only service role can read/write (no direct user access to wallet IDs)
ALTER TABLE agent_turnkey_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_turnkey_mapping_service_role_only ON agent_turnkey_mapping
  FOR ALL USING (auth.role() = 'service_role');
