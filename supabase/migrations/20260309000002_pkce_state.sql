-- PKCE state table for Twitter OAuth 2.0 PKCE flow
-- Stores short-lived code_verifier + state pairs during the OAuth handshake.
-- Service role only — no client access, no RLS needed.
CREATE TABLE IF NOT EXISTS pkce_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text UNIQUE NOT NULL,
  code_verifier text NOT NULL,
  character_id uuid REFERENCES characters(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pkce_state_state_idx ON pkce_state(state);
