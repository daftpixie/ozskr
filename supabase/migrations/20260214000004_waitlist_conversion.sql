-- Extend waitlist status to support invitation/conversion flow
-- Current: pending, approved, rejected
-- New: pending, approved, rejected, invited, converted

ALTER TABLE waitlist DROP CONSTRAINT IF EXISTS waitlist_status_check;
ALTER TABLE waitlist ADD CONSTRAINT waitlist_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'invited', 'converted'));

-- Track when a waitlist entry was converted to alpha access
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
