-- Enhance waitlist: add status, invite_code, referred_by, and 500-spot cap
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES waitlist(id);
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);

-- Function to check remaining spots (cap at 500)
CREATE OR REPLACE FUNCTION get_waitlist_remaining() RETURNS INTEGER AS $$
  SELECT GREATEST(0, 500 - COUNT(*)::INTEGER) FROM waitlist;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_waitlist_remaining() TO anon;

-- Policy: users can read their own entry by wallet address
CREATE POLICY "Users can read own waitlist entry"
  ON waitlist FOR SELECT
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address');
