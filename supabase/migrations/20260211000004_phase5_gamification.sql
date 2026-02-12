-- ============================================================================
-- Phase 5: Gamification Data Model
-- Achievements, points, user stats, tier system, leaderboard
-- ============================================================================

-- ENUMS
-- ============================================================================

CREATE TYPE points_type AS ENUM (
  'creation',
  'generation',
  'publishing',
  'engagement',
  'streak',
  'referral'
);

CREATE TYPE points_source_type AS ENUM (
  'character',
  'content',
  'social_post',
  'achievement'
);

CREATE TYPE user_tier AS ENUM (
  'newcomer',
  'creator',
  'influencer',
  'mogul',
  'legend'
);

CREATE TYPE achievement_category AS ENUM (
  'creation',
  'publishing',
  'engagement',
  'streak'
);

CREATE TYPE achievement_requirement_type AS ENUM (
  'count',
  'streak',
  'milestone'
);

CREATE TYPE leaderboard_period AS ENUM (
  'daily',
  'weekly',
  'monthly',
  'all_time'
);

-- TABLES
-- ============================================================================

-- User points tracking table (append-only ledger)
CREATE TABLE user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  points_type points_type NOT NULL,
  points_amount INTEGER NOT NULL,
  description TEXT NOT NULL,
  source_type points_source_type NOT NULL,
  source_id UUID, -- Nullable FK to source entity (character, content, social_post, achievement)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User aggregate stats (updated via triggers or application logic)
CREATE TABLE user_stats (
  wallet_address TEXT PRIMARY KEY REFERENCES users(wallet_address) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  current_streak_days INTEGER NOT NULL DEFAULT 0,
  longest_streak_days INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  total_agents_created INTEGER NOT NULL DEFAULT 0,
  total_content_generated INTEGER NOT NULL DEFAULT 0,
  total_posts_published INTEGER NOT NULL DEFAULT 0,
  tier user_tier NOT NULL DEFAULT 'newcomer',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Achievements definition table (system-managed)
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL, -- emoji or icon key
  category achievement_category NOT NULL,
  requirement_type achievement_requirement_type NOT NULL,
  requirement_value INTEGER NOT NULL, -- threshold to unlock
  points_reward INTEGER NOT NULL,
  tier_required user_tier, -- minimum tier required (nullable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User achievements (many-to-many: users <-> achievements)
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wallet_address, achievement_id)
);

-- Leaderboard cache (materialized view, refreshed periodically)
CREATE TABLE leaderboard_cache (
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  display_name TEXT,
  total_points INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  tier user_tier NOT NULL,
  period leaderboard_period NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet_address, period)
);

-- INDEXES
-- ============================================================================

CREATE INDEX idx_user_points_wallet ON user_points(wallet_address);
CREATE INDEX idx_user_points_created_at ON user_points(created_at DESC);
CREATE INDEX idx_user_stats_total_points ON user_stats(total_points DESC);
CREATE INDEX idx_user_stats_tier ON user_stats(tier);
CREATE INDEX idx_user_achievements_wallet ON user_achievements(wallet_address);
CREATE INDEX idx_leaderboard_cache_period_rank ON leaderboard_cache(period, rank);

-- RLS POLICIES
-- ============================================================================

-- Enable RLS on all gamification tables
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;

-- user_points: Users can read their own point history
CREATE POLICY "Users can read their own points"
  ON user_points FOR SELECT
  USING (wallet_address = auth.jwt() ->> 'wallet_address');

-- user_points: Service role can manage all points
CREATE POLICY "Service role manages all points"
  ON user_points FOR ALL
  USING (auth.role() = 'service_role');

-- user_stats: Users can read their own stats
CREATE POLICY "Users can read their own stats"
  ON user_stats FOR SELECT
  USING (wallet_address = auth.jwt() ->> 'wallet_address');

-- user_stats: Service role can manage all stats
CREATE POLICY "Service role manages all stats"
  ON user_stats FOR ALL
  USING (auth.role() = 'service_role');

-- achievements: Public readable (all users can see available achievements)
CREATE POLICY "Achievements are public readable"
  ON achievements FOR SELECT
  USING (true);

-- achievements: Only service role can manage achievements
CREATE POLICY "Service role manages achievements"
  ON achievements FOR ALL
  USING (auth.role() = 'service_role');

-- user_achievements: Users can read their own achievements
CREATE POLICY "Users can read their own achievements"
  ON user_achievements FOR SELECT
  USING (wallet_address = auth.jwt() ->> 'wallet_address');

-- user_achievements: Service role can manage all user achievements
CREATE POLICY "Service role manages all user achievements"
  ON user_achievements FOR ALL
  USING (auth.role() = 'service_role');

-- leaderboard_cache: Public readable (all authenticated users can see leaderboard)
CREATE POLICY "Leaderboard is public readable"
  ON leaderboard_cache FOR SELECT
  USING (true);

-- leaderboard_cache: Only service role can update cache
CREATE POLICY "Service role manages leaderboard cache"
  ON leaderboard_cache FOR ALL
  USING (auth.role() = 'service_role');

-- SEED ACHIEVEMENTS
-- ============================================================================

INSERT INTO achievements (slug, name, description, icon, category, requirement_type, requirement_value, points_reward, tier_required) VALUES
  -- Creation achievements
  ('first-steps', 'First Steps', 'Create your first agent', '🚀', 'creation', 'count', 1, 100, NULL),
  ('wordsmith', 'Wordsmith', 'Generate 10 text posts', '✍️', 'creation', 'count', 10, 250, NULL),
  ('visual-artist', 'Visual Artist', 'Generate 10 images', '🎨', 'creation', 'count', 10, 250, NULL),
  ('multi-agent', 'Multi-Agent Master', 'Create 5 agents', '🤖', 'creation', 'count', 5, 300, NULL),
  ('content-machine', 'Content Machine', 'Generate 100 pieces of content', '⚙️', 'creation', 'count', 100, 1000, NULL),
  ('content-empire', 'Content Empire', 'Generate 500 pieces of content', '🏰', 'creation', 'count', 500, 2500, NULL),
  ('early-bird', 'Early Bird', 'Generate content before 8 AM', '🌅', 'creation', 'count', 1, 50, NULL),
  ('night-owl', 'Night Owl', 'Generate content after midnight', '🦉', 'creation', 'count', 1, 50, NULL),

  -- Publishing achievements
  ('social-butterfly', 'Social Butterfly', 'Publish to 3 platforms', '🦋', 'publishing', 'count', 3, 300, NULL),
  ('publishing-pro', 'Publishing Pro', 'Publish 50 posts', '📢', 'publishing', 'count', 50, 500, NULL),

  -- Engagement achievements
  ('viral-moment', 'Viral Moment', 'Single post gets 100+ engagements', '⚡', 'engagement', 'milestone', 100, 750, NULL),
  ('engagement-king', 'Engagement King', 'Get 1000 total engagements', '🏆', 'engagement', 'milestone', 1000, 1000, NULL),
  ('influencer-status', 'Influencer Status', 'Reach 1000 total points', '👑', 'engagement', 'milestone', 1000, 0, NULL),
  ('mogul-status', 'Mogul Status', 'Reach 10000 total points', '💰', 'engagement', 'milestone', 10000, 0, NULL),

  -- Streak achievements
  ('consistent-creator', 'Consistent Creator', '7-day generation streak', '🔥', 'streak', 'streak', 7, 500, NULL),
  ('streak-master', 'Streak Master', '30-day streak', '💎', 'streak', 'streak', 30, 1500, NULL);

-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_points IS 'Append-only ledger of all point awards';
COMMENT ON TABLE user_stats IS 'Aggregate user statistics and tier status';
COMMENT ON TABLE achievements IS 'System-defined achievements that users can unlock';
COMMENT ON TABLE user_achievements IS 'Unlocked achievements per user';
COMMENT ON TABLE leaderboard_cache IS 'Cached leaderboard rankings by period';

COMMENT ON COLUMN user_points.source_id IS 'Nullable FK to source entity (character_id, content_generation_id, social_post_id, achievement_id)';
COMMENT ON COLUMN user_stats.tier IS 'Auto-calculated based on total_points thresholds';
COMMENT ON COLUMN achievements.tier_required IS 'Minimum tier required to unlock achievement (NULL = no requirement)';
COMMENT ON COLUMN leaderboard_cache.period IS 'Leaderboard period: daily, weekly, monthly, all_time';
