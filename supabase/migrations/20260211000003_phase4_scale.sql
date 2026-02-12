-- ozskr.ai Phase 4 Scale Schema
-- Migration: 20260211000003_phase4_scale.sql
-- Created: 2026-02-11
-- Description: Scheduling, social accounts, social posts, and analytics snapshots

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Schedule type enum
CREATE TYPE schedule_type AS ENUM ('one_time', 'recurring');

-- Schedule content type enum
CREATE TYPE schedule_content_type AS ENUM ('text', 'image', 'video');

-- Social platform enum
CREATE TYPE social_platform AS ENUM ('twitter', 'instagram', 'tiktok', 'youtube');

-- Social post status enum
CREATE TYPE social_post_status AS ENUM ('queued', 'posted', 'failed', 'deleted');

-- =============================================================================
-- TABLES
-- =============================================================================

-- Content schedules table
CREATE TABLE content_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  schedule_type schedule_type NOT NULL,
  cron_expression TEXT,
  next_run_at TIMESTAMPTZ NOT NULL,
  content_type schedule_content_type NOT NULL,
  prompt_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_publish BOOLEAN NOT NULL DEFAULT false,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Social accounts table
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  platform social_platform NOT NULL,
  platform_account_id TEXT NOT NULL,
  platform_username TEXT NOT NULL,
  ayrshare_profile_key TEXT NOT NULL,
  is_connected BOOLEAN NOT NULL DEFAULT true,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(wallet_address, platform)
);

-- Social posts table
CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_generation_id UUID NOT NULL REFERENCES content_generations(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  platform social_platform NOT NULL,
  post_id TEXT,
  post_url TEXT,
  status social_post_status NOT NULL,
  posted_at TIMESTAMPTZ,
  error_message TEXT,
  engagement_metrics JSONB DEFAULT '{}'::jsonb,
  last_metrics_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Analytics snapshots table
CREATE TABLE analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_generations INTEGER NOT NULL DEFAULT 0,
  total_posts INTEGER NOT NULL DEFAULT 0,
  total_engagement JSONB DEFAULT '{}'::jsonb,
  avg_quality_score DOUBLE PRECISION,
  top_performing_content_id UUID REFERENCES content_generations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(character_id, snapshot_date)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Content schedules indexes
CREATE INDEX idx_content_schedules_character_id ON content_schedules(character_id);
CREATE INDEX idx_content_schedules_next_run_at ON content_schedules(next_run_at);
CREATE INDEX idx_content_schedules_is_active ON content_schedules(is_active);

-- Social accounts indexes
CREATE INDEX idx_social_accounts_wallet_address ON social_accounts(wallet_address);
CREATE INDEX idx_social_accounts_platform ON social_accounts(platform);

-- Social posts indexes
CREATE INDEX idx_social_posts_content_generation_id ON social_posts(content_generation_id);
CREATE INDEX idx_social_posts_social_account_id ON social_posts(social_account_id);
CREATE INDEX idx_social_posts_status ON social_posts(status);
CREATE INDEX idx_social_posts_created_at ON social_posts(created_at DESC);

-- Analytics snapshots indexes
CREATE INDEX idx_analytics_snapshots_character_id ON analytics_snapshots(character_id);
CREATE INDEX idx_analytics_snapshots_snapshot_date ON analytics_snapshots(snapshot_date);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE content_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- Content schedules policies
CREATE POLICY "Users can read their own content schedules"
  ON content_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = content_schedules.character_id
      AND characters.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "Users can insert their own content schedules"
  ON content_schedules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = content_schedules.character_id
      AND characters.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "Users can update their own content schedules"
  ON content_schedules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = content_schedules.character_id
      AND characters.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = content_schedules.character_id
      AND characters.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "Users can delete their own content schedules"
  ON content_schedules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = content_schedules.character_id
      AND characters.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

-- Social accounts policies
CREATE POLICY "Users can read their own social accounts"
  ON social_accounts FOR SELECT
  USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Users can insert their own social accounts"
  ON social_accounts FOR INSERT
  WITH CHECK (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Users can update their own social accounts"
  ON social_accounts FOR UPDATE
  USING (wallet_address = (auth.jwt() ->> 'wallet_address'))
  WITH CHECK (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Users can delete their own social accounts"
  ON social_accounts FOR DELETE
  USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

-- Social posts policies
CREATE POLICY "Users can read their own social posts"
  ON social_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM social_accounts
      WHERE social_accounts.id = social_posts.social_account_id
      AND social_accounts.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "Users can insert their own social posts"
  ON social_posts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM social_accounts
      WHERE social_accounts.id = social_posts.social_account_id
      AND social_accounts.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "Users can update their own social posts"
  ON social_posts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM social_accounts
      WHERE social_accounts.id = social_posts.social_account_id
      AND social_accounts.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM social_accounts
      WHERE social_accounts.id = social_posts.social_account_id
      AND social_accounts.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

-- Analytics snapshots policies
CREATE POLICY "Users can read their own analytics snapshots"
  ON analytics_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = analytics_snapshots.character_id
      AND characters.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

-- Service role policies (for background jobs)
CREATE POLICY "Service role can manage content schedules"
  ON content_schedules FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage social accounts"
  ON social_accounts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage social posts"
  ON social_posts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage analytics snapshots"
  ON analytics_snapshots FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE content_schedules IS 'Scheduled content generation jobs for characters';
COMMENT ON TABLE social_accounts IS 'Connected social media accounts for publishing';
COMMENT ON TABLE social_posts IS 'Published social media posts with engagement tracking';
COMMENT ON TABLE analytics_snapshots IS 'Daily analytics snapshots per character';

COMMENT ON COLUMN content_schedules.schedule_type IS 'one_time or recurring schedule';
COMMENT ON COLUMN content_schedules.cron_expression IS 'Cron expression for recurring schedules (null for one_time)';
COMMENT ON COLUMN content_schedules.next_run_at IS 'Next scheduled execution time';
COMMENT ON COLUMN content_schedules.content_type IS 'Type of content to generate (text, image, video)';
COMMENT ON COLUMN content_schedules.prompt_template IS 'Template for generating the content prompt';
COMMENT ON COLUMN content_schedules.is_active IS 'Whether the schedule is active';
COMMENT ON COLUMN content_schedules.auto_publish IS 'Whether to auto-publish approved content to connected social accounts';
COMMENT ON COLUMN content_schedules.last_run_at IS 'Last execution time (null if never run)';
COMMENT ON COLUMN content_schedules.run_count IS 'Number of times this schedule has executed';

COMMENT ON COLUMN social_accounts.platform IS 'Social media platform (twitter, instagram, tiktok, youtube)';
COMMENT ON COLUMN social_accounts.platform_account_id IS 'Platform-specific account ID';
COMMENT ON COLUMN social_accounts.platform_username IS 'Platform username/handle';
COMMENT ON COLUMN social_accounts.ayrshare_profile_key IS 'Encrypted Ayrshare profile key reference';
COMMENT ON COLUMN social_accounts.is_connected IS 'Whether the account is currently connected';
COMMENT ON COLUMN social_accounts.last_posted_at IS 'Timestamp of last successful post';

COMMENT ON COLUMN social_posts.content_generation_id IS 'Reference to the generated content';
COMMENT ON COLUMN social_posts.social_account_id IS 'Reference to the social account used';
COMMENT ON COLUMN social_posts.post_id IS 'Platform-specific post ID (null until posted)';
COMMENT ON COLUMN social_posts.post_url IS 'Direct URL to the published post';
COMMENT ON COLUMN social_posts.status IS 'Post status (queued, posted, failed, deleted)';
COMMENT ON COLUMN social_posts.engagement_metrics IS 'JSON object with likes, shares, comments, views, etc.';
COMMENT ON COLUMN social_posts.last_metrics_update IS 'Last time engagement metrics were fetched';

COMMENT ON COLUMN analytics_snapshots.snapshot_date IS 'Date of this snapshot (unique per character)';
COMMENT ON COLUMN analytics_snapshots.total_generations IS 'Total content generations for this character on this date';
COMMENT ON COLUMN analytics_snapshots.total_posts IS 'Total social media posts on this date';
COMMENT ON COLUMN analytics_snapshots.total_engagement IS 'Aggregated engagement metrics (likes, shares, etc.)';
COMMENT ON COLUMN analytics_snapshots.avg_quality_score IS 'Average quality score across generations';
COMMENT ON COLUMN analytics_snapshots.top_performing_content_id IS 'Reference to best performing content';
