-- Migration: add timezone preference to users table
-- Part of WS3 AC8: user timezone stored in profile, used for calendar display

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

-- Allow users to update their own timezone
-- (existing RLS policies on users cover SELECT/UPDATE for wallet_address match)

COMMENT ON COLUMN users.timezone IS 'IANA timezone string (e.g. America/New_York). Used for calendar scheduling display.';
