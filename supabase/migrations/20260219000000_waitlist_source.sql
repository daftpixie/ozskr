-- Add source tracking column to waitlist table
-- Tracks where the signup originated (landing, blog, twitter, direct)
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS source TEXT;
