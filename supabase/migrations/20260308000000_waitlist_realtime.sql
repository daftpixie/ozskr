-- Enable Supabase Realtime on the waitlist table so clients can subscribe
-- to INSERT events for live spot-counter updates.
--
-- Also adds SELECT policy so the count API (anon key) can call the RPC
-- functions without needing a service role key.
--
-- Idempotent: safe to run against any environment.

-- Enable Realtime publication for waitlist table
ALTER PUBLICATION supabase_realtime ADD TABLE waitlist;

-- Ensure anon can call the count/remaining functions (idempotent re-grant)
GRANT EXECUTE ON FUNCTION get_waitlist_count() TO anon;
GRANT EXECUTE ON FUNCTION get_waitlist_remaining() TO anon;

-- Add SELECT policy on waitlist so anon can read count via RLS
-- (The RPC functions use SECURITY DEFINER so they bypass RLS, but
--  this policy is here for future direct queries.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'waitlist'
      AND policyname = 'Allow anon to read waitlist count'
  ) THEN
    CREATE POLICY "Allow anon to read waitlist count"
      ON waitlist FOR SELECT TO anon
      USING (true);
  END IF;
END $$;
