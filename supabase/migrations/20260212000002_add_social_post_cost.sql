-- Add cost tracking to social_posts for per-publish cost accounting
-- Used by the SocialPublisher abstraction to track provider costs

ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS cost_usd DECIMAL(10, 6) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'ayrshare';

-- Index for cost aggregation queries
CREATE INDEX IF NOT EXISTS idx_social_posts_provider ON social_posts (provider);

COMMENT ON COLUMN social_posts.cost_usd IS 'Estimated cost in USD for this publish operation';
COMMENT ON COLUMN social_posts.provider IS 'Which SocialProvider backend handled this publish';
