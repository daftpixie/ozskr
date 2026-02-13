-- Feature flags table for runtime flag management without redeployment
CREATE TABLE feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Public can read flags (needed for client-side UI hints)
CREATE POLICY "Anyone can read feature flags"
  ON feature_flags FOR SELECT
  USING (true);

-- Only service role can modify flags
CREATE POLICY "Service role manages flags"
  ON feature_flags FOR ALL
  USING (auth.role() = 'service_role');

-- Seed default flags
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('waitlist_enabled', true, 'Whether the waitlist signup is active'),
  ('twitter_direct_enabled', false, 'Use direct Twitter API instead of Ayrshare'),
  ('mainnet_enabled', false, 'Allow mainnet operations'),
  ('jupiter_swap_enabled', true, 'Enable Jupiter swap functionality'),
  ('social_publishing_enabled', true, 'Enable social media publishing');

-- Helper function to check a flag server-side
CREATE OR REPLACE FUNCTION is_feature_enabled(flag_key TEXT) RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT enabled FROM feature_flags WHERE key = flag_key),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION is_feature_enabled(TEXT) TO anon, authenticated;
