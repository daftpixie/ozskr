-- Social OAuth tokens for Yellow Brick social publishing
-- Migration: 20260309000000_social_oauth_tokens
--
-- Stores encrypted OAuth access/refresh tokens per user per provider.
-- Tokens are encrypted at the application layer (AES-256-GCM) before storage.
-- RLS ensures users can only access their own tokens.

CREATE TABLE IF NOT EXISTS public.social_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('twitter', 'instagram', 'linkedin', 'tiktok')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  encrypted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- RLS: users can only see and manage their own tokens
ALTER TABLE public.social_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own OAuth tokens"
  ON public.social_oauth_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role access for background jobs (Trigger.dev)
CREATE POLICY "Service role can access OAuth tokens"
  ON public.social_oauth_tokens
  FOR SELECT
  USING (auth.role() = 'service_role');

-- updated_at auto-update trigger function (idempotent via CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: only create if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_social_oauth_tokens_updated_at'
  ) THEN
    CREATE TRIGGER set_social_oauth_tokens_updated_at
      BEFORE UPDATE ON public.social_oauth_tokens
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
