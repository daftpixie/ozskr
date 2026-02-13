-- Alpha whitelist table for manual tier overrides
-- Allows admins to grant access tiers to wallets independent of $HOPE balance
CREATE TABLE alpha_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  access_tier TEXT NOT NULL CHECK (access_tier IN ('ALPHA', 'BETA', 'EARLY_ACCESS')),
  notes TEXT,
  added_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE alpha_whitelist ENABLE ROW LEVEL SECURITY;

-- Only service role can manage whitelist (admin API uses service role client)
CREATE POLICY "Service role manages whitelist"
  ON alpha_whitelist FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_whitelist_wallet ON alpha_whitelist(wallet_address);
CREATE INDEX idx_whitelist_tier ON alpha_whitelist(access_tier);
