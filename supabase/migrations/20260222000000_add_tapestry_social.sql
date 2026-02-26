-- Migration: add_tapestry_social
-- Adds Tapestry profile tracking to characters and a content mirror table.
-- Backward-compatible: all new columns are nullable or have defaults.

-- ---------------------------------------------------------------------------
-- Extend characters with Tapestry identity columns
-- ---------------------------------------------------------------------------

ALTER TABLE characters ADD COLUMN IF NOT EXISTS tapestry_profile_id TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS tapestry_username TEXT;

-- Unique constraint on tapestry_username (non-null values only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_tapestry_username
  ON characters (tapestry_username)
  WHERE tapestry_username IS NOT NULL;

-- Index for profile-ID lookups (e.g., syncing stats back to Supabase)
CREATE INDEX IF NOT EXISTS idx_characters_tapestry_profile
  ON characters(tapestry_profile_id)
  WHERE tapestry_profile_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Content mirror tracking table
-- Mirrors published content nodes that have been registered in Tapestry.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tapestry_content_mirror (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id        UUID        NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  tapestry_content_id TEXT        NOT NULL,
  source_platform     TEXT        NOT NULL,
  source_post_id      TEXT,
  content_text        TEXT,
  mirrored_at         TIMESTAMPTZ DEFAULT NOW(),
  engagement_data     JSONB       DEFAULT '{}'::jsonb,
  UNIQUE(character_id, tapestry_content_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE tapestry_content_mirror ENABLE ROW LEVEL SECURITY;

-- Users may read/write rows that belong to their own agents
CREATE POLICY "Users access own agent content mirrors"
  ON tapestry_content_mirror FOR ALL
  USING (
    character_id IN (
      SELECT id FROM characters
      WHERE wallet_address = auth.jwt() ->> 'wallet_address'
    )
  );

-- Background jobs (Trigger.dev) run under the service role
CREATE POLICY "Service role full access on tapestry_content_mirror"
  ON tapestry_content_mirror FOR ALL
  USING (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Indexes on tapestry_content_mirror
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tapestry_content_mirror_character
  ON tapestry_content_mirror(character_id);

CREATE INDEX IF NOT EXISTS idx_tapestry_content_mirror_source
  ON tapestry_content_mirror(source_platform, source_post_id);
