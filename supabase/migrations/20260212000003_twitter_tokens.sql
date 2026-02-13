-- Twitter OAuth token storage with pgcrypto encryption
-- Tokens are encrypted at rest using AES-256 via pgp_sym_encrypt

-- Enable pgcrypto extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Twitter OAuth tokens table
CREATE TABLE IF NOT EXISTS twitter_tokens (
  social_account_id UUID PRIMARY KEY REFERENCES social_accounts(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  twitter_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: only service role can access tokens (never exposed to clients)
ALTER TABLE twitter_tokens ENABLE ROW LEVEL SECURITY;

-- No RLS policies = only service role key can read/write
-- This is intentional: tokens should NEVER be accessible via anon/authenticated keys

-- Index for expiry-based queries (token refresh scheduling)
CREATE INDEX IF NOT EXISTS idx_twitter_tokens_expires_at ON twitter_tokens (expires_at);

-- Auto-update updated_at on modification
CREATE OR REPLACE FUNCTION update_twitter_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER twitter_tokens_updated_at
  BEFORE UPDATE ON twitter_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_twitter_tokens_updated_at();

-- Server-side RPC for pgcrypto encryption (callable from Supabase client)
-- These use service role only (RLS blocks anon/authenticated)

CREATE OR REPLACE FUNCTION pgp_sym_encrypt_text(plaintext_value TEXT, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(plaintext_value, encryption_key), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION pgp_sym_decrypt_text(encrypted_value TEXT, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted_value, 'base64'), encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restrict RPC functions to service role only
REVOKE ALL ON FUNCTION pgp_sym_encrypt_text(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION pgp_sym_decrypt_text(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pgp_sym_encrypt_text(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION pgp_sym_decrypt_text(TEXT, TEXT) TO service_role;

COMMENT ON TABLE twitter_tokens IS 'Encrypted OAuth 2.0 tokens for direct Twitter/X API access';
COMMENT ON COLUMN twitter_tokens.access_token_encrypted IS 'AES-256 encrypted OAuth access token';
COMMENT ON COLUMN twitter_tokens.refresh_token_encrypted IS 'AES-256 encrypted OAuth refresh token';
