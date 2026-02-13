-- Waitlist table for pre-launch signups
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  wallet_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_has_identifier CHECK (email IS NOT NULL OR wallet_address IS NOT NULL)
);

CREATE UNIQUE INDEX idx_waitlist_email ON waitlist(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_waitlist_wallet ON waitlist(wallet_address) WHERE wallet_address IS NOT NULL;

-- RLS: anon can INSERT only, service role can read
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public waitlist signups" ON waitlist FOR INSERT TO anon WITH CHECK (true);

-- Count function callable by anon
CREATE OR REPLACE FUNCTION get_waitlist_count() RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM waitlist;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_waitlist_count() TO anon;
