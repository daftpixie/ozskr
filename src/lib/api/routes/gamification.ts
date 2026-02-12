/**
 * Gamification Routes
 * Points, achievements, stats, and leaderboard endpoints
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  UserPointsResponseSchema,
  UserStatsResponseSchema,
  AllAchievementsResponseSchema,
  LeaderboardResponseSchema,
  LeaderboardPositionResponseSchema,
  LeaderboardPeriodSchema,
  UserPointsPaginatedResponseSchema,
} from '@/types/gamification';
import { authMiddleware } from '../middleware/auth';
import { readLimiter } from '../middleware/rate-limit';
import { createAuthenticatedClient } from '../supabase';
import type {
  UserPoints,
  UserStats,
  Achievement,
  UserAchievement,
  LeaderboardEntry,
} from '@/types/database';
import { calculateTierProgress } from '@/lib/gamification/tiers';

/** Hono env with auth middleware variables */
type GamificationEnv = {
  Variables: {
    walletAddress: string;
    jwtToken: string;
  };
};

const gamification = new Hono<GamificationEnv>();

// All gamification routes require authentication and rate limiting
gamification.use('/*', authMiddleware);
gamification.use('/*', readLimiter);

/**
 * Helper to extract auth context from Hono context with type narrowing
 */
function getAuthContext(c: { get: (key: string) => unknown }) {
  const walletAddress = c.get('walletAddress');
  const jwtToken = c.get('jwtToken');
  if (typeof walletAddress !== 'string' || typeof jwtToken !== 'string') {
    return null;
  }
  return { walletAddress, jwtToken };
}

/**
 * Helper to map database UserPoints to API response
 */
function mapUserPointsToResponse(points: UserPoints) {
  return {
    id: points.id,
    walletAddress: points.wallet_address,
    pointsType: points.points_type,
    pointsAmount: points.points_amount,
    description: points.description,
    sourceType: points.source_type,
    sourceId: points.source_id,
    createdAt: points.created_at,
  };
}

/**
 * Helper to map database Achievement to API response
 */
function mapAchievementToResponse(achievement: Achievement) {
  return {
    id: achievement.id,
    slug: achievement.slug,
    name: achievement.name,
    description: achievement.description,
    icon: achievement.icon,
    category: achievement.category,
    requirementType: achievement.requirement_type,
    requirementValue: achievement.requirement_value,
    pointsReward: achievement.points_reward,
    tierRequired: achievement.tier_required,
    createdAt: achievement.created_at,
  };
}

/**
 * Helper to map database LeaderboardEntry to API response
 */
function mapLeaderboardEntryToResponse(entry: LeaderboardEntry) {
  return {
    walletAddress: entry.wallet_address,
    displayName: entry.display_name,
    totalPoints: entry.total_points,
    rank: entry.rank,
    tier: entry.tier,
  };
}

// =============================================================================
// POINTS ROUTES
// =============================================================================

/**
 * GET /api/gamification/me/points
 * Get user's point history with pagination
 */
gamification.get(
  '/me/points',
  zValidator(
    'query',
    z.object({
      page: z.string().optional().default('1').transform(Number).pipe(z.number().int().min(1).max(1000)),
      limit: z.string().optional().default('20').transform(Number).pipe(z.number().int().min(1).max(100)),
    })
  ),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const { page, limit } = c.req.valid('query');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);
      const offset = (page - 1) * limit;

      // Count total points entries
      const { count, error: countError } = await supabase
        .from('user_points')
        .select('*', { count: 'exact', head: true })
        .eq('wallet_address', auth.walletAddress);

      if (countError) {
        return c.json(
          { error: 'Failed to count points', code: 'DATABASE_ERROR' },
          500
        );
      }

      // Fetch paginated points history
      const { data: pointsData, error: selectError } = await supabase
        .from('user_points')
        .select('*')
        .eq('wallet_address', auth.walletAddress)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (selectError) {
        return c.json(
          { error: 'Failed to fetch points', code: 'DATABASE_ERROR' },
          500
        );
      }

      const totalPages = Math.ceil((count || 0) / limit);

      const response = UserPointsPaginatedResponseSchema.parse({
        data: pointsData?.map(mapUserPointsToResponse) || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
      });

      return c.json(response, 200);
    } catch {
      return c.json(
        { error: 'Failed to fetch points', code: 'INTERNAL_ERROR' },
        500
      );
    }
  }
);

// =============================================================================
// STATS ROUTES
// =============================================================================

/**
 * GET /api/gamification/me/stats
 * Get user's aggregate stats with tier progress
 */
gamification.get('/me/stats', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Fetch or create user stats
    let { data: stats, error: statsError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('wallet_address', auth.walletAddress)
      .single();

    // If stats don't exist, create default entry
    if (statsError && statsError.code === 'PGRST116') {
      const { data: newStats, error: insertError } = await supabase
        .from('user_stats')
        .insert({
          wallet_address: auth.walletAddress,
        })
        .select()
        .single();

      if (insertError || !newStats) {
        return c.json(
          { error: 'Failed to create user stats', code: 'DATABASE_ERROR' },
          500
        );
      }
      stats = newStats;
    } else if (statsError || !stats) {
      return c.json(
        { error: 'Failed to fetch user stats', code: 'DATABASE_ERROR' },
        500
      );
    }

    // Calculate tier progress
    const tierProgress = calculateTierProgress(stats.total_points);

    const response = UserStatsResponseSchema.parse({
      walletAddress: stats.wallet_address,
      totalPoints: stats.total_points,
      currentStreakDays: stats.current_streak_days,
      longestStreakDays: stats.longest_streak_days,
      lastActiveDate: stats.last_active_date,
      totalAgentsCreated: stats.total_agents_created,
      totalContentGenerated: stats.total_content_generated,
      totalPostsPublished: stats.total_posts_published,
      tier: stats.tier,
      updatedAt: stats.updated_at,
      tierProgress,
    });

    return c.json(response, 200);
  } catch {
    return c.json(
      { error: 'Failed to fetch user stats', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

// =============================================================================
// ACHIEVEMENTS ROUTES
// =============================================================================

/**
 * GET /api/gamification/me/achievements
 * Get all achievements with unlock status and progress
 */
gamification.get('/me/achievements', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Fetch all achievements
    const { data: allAchievements, error: achievementsError } = await supabase
      .from('achievements')
      .select('*')
      .order('requirement_value', { ascending: true });

    if (achievementsError || !allAchievements) {
      return c.json(
        { error: 'Failed to fetch achievements', code: 'DATABASE_ERROR' },
        500
      );
    }

    // Fetch user's unlocked achievements
    const { data: unlockedData, error: unlockedError } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('wallet_address', auth.walletAddress);

    if (unlockedError) {
      return c.json(
        { error: 'Failed to fetch unlocked achievements', code: 'DATABASE_ERROR' },
        500
      );
    }

    // Fetch user stats for progress calculation
    const { data: stats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('wallet_address', auth.walletAddress)
      .single();

    // Build unlocked achievement IDs set
    const unlockedIds = new Set(unlockedData?.map((ua) => ua.achievement_id) || []);

    // Separate unlocked and locked achievements
    const unlocked = [];
    const locked = [];

    for (const achievement of allAchievements) {
      const baseAchievement = mapAchievementToResponse(achievement);

      if (unlockedIds.has(achievement.id)) {
        // Unlocked achievement
        const unlockedRecord = unlockedData?.find(
          (ua) => ua.achievement_id === achievement.id
        );
        unlocked.push({
          ...baseAchievement,
          unlockedAt: unlockedRecord?.unlocked_at || new Date().toISOString(),
        });
      } else {
        // Locked achievement - calculate progress
        const progress = calculateAchievementProgress(achievement, stats);
        locked.push({
          ...baseAchievement,
          progress: progress.percentage,
          currentValue: progress.currentValue,
        });
      }
    }

    const response = AllAchievementsResponseSchema.parse({ unlocked, locked });

    return c.json(response, 200);
  } catch {
    return c.json(
      { error: 'Failed to fetch achievements', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

/**
 * Helper to calculate achievement progress based on user stats
 */
function calculateAchievementProgress(
  achievement: Achievement,
  stats: UserStats | null
): { percentage: number; currentValue: number } {
  if (!stats) {
    return { percentage: 0, currentValue: 0 };
  }

  let currentValue = 0;

  // Determine current value based on achievement category and requirement type
  switch (achievement.category) {
    case 'creation':
      if (achievement.slug === 'first-steps' || achievement.slug === 'multi-agent') {
        currentValue = stats.total_agents_created;
      } else if (achievement.slug.includes('content')) {
        currentValue = stats.total_content_generated;
      }
      break;
    case 'publishing':
      currentValue = stats.total_posts_published;
      break;
    case 'engagement':
      if (achievement.requirement_type === 'milestone') {
        if (achievement.slug.includes('points')) {
          currentValue = stats.total_points;
        }
        // For post-specific engagement, we'd need additional data
      }
      break;
    case 'streak':
      if (achievement.requirement_type === 'streak') {
        currentValue = stats.current_streak_days;
      }
      break;
  }

  const percentage = Math.min(
    100,
    Math.floor((currentValue / achievement.requirement_value) * 100)
  );

  return { percentage, currentValue };
}

// =============================================================================
// LEADERBOARD ROUTES
// =============================================================================

/**
 * GET /api/gamification/leaderboard
 * Get leaderboard by period with caching
 */
gamification.get(
  '/leaderboard',
  zValidator(
    'query',
    z.object({
      period: z.string().optional().default('all_time').pipe(LeaderboardPeriodSchema),
      limit: z.string().optional().default('100').transform(Number).pipe(z.number().int().min(1).max(100)),
    })
  ),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const { period, limit } = c.req.valid('query');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);
      const cacheExpiry = 5 * 60 * 1000; // 5 minutes in milliseconds

      // Try to fetch cached leaderboard
      const { data: cachedData, error: cacheError } = await supabase
        .from('leaderboard_cache')
        .select('*')
        .eq('period', period)
        .order('rank', { ascending: true })
        .limit(limit);

      // Check if cache is valid (less than 5 minutes old)
      const now = new Date();
      const isCacheValid =
        cachedData &&
        cachedData.length > 0 &&
        cachedData[0]?.cached_at &&
        now.getTime() - new Date(cachedData[0].cached_at).getTime() < cacheExpiry;

      if (!cacheError && isCacheValid && cachedData) {
        // Return cached leaderboard
        const response = LeaderboardResponseSchema.parse({
          period,
          entries: cachedData.map(mapLeaderboardEntryToResponse),
          cachedAt: cachedData[0]?.cached_at || now.toISOString(),
        });
        return c.json(response, 200);
      }

      // Cache miss or stale - recalculate from user_stats
      const { data: statsData, error: statsError } = await supabase
        .from('user_stats')
        .select('wallet_address, total_points, tier')
        .order('total_points', { ascending: false })
        .limit(limit);

      if (statsError || !statsData) {
        return c.json(
          { error: 'Failed to fetch leaderboard', code: 'DATABASE_ERROR' },
          500
        );
      }

      // Fetch display names from users table
      const walletAddresses = statsData.map((s) => s.wallet_address);
      const { data: usersData } = await supabase
        .from('users')
        .select('wallet_address, display_name')
        .in('wallet_address', walletAddresses);

      const displayNameMap = new Map(
        usersData?.map((u) => [u.wallet_address, u.display_name]) || []
      );

      // Build leaderboard entries
      const entries = statsData.map((stat, index) => ({
        walletAddress: stat.wallet_address,
        displayName: displayNameMap.get(stat.wallet_address) || null,
        totalPoints: stat.total_points,
        rank: index + 1,
        tier: stat.tier,
      }));

      const response = LeaderboardResponseSchema.parse({
        period,
        entries,
        cachedAt: now.toISOString(),
      });

      return c.json(response, 200);
    } catch {
      return c.json(
        { error: 'Failed to fetch leaderboard', code: 'INTERNAL_ERROR' },
        500
      );
    }
  }
);

/**
 * GET /api/gamification/leaderboard/me
 * Get current user's leaderboard position with surrounding users
 */
gamification.get('/leaderboard/me', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Fetch current user's stats
    const { data: currentUserStats, error: userStatsError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('wallet_address', auth.walletAddress)
      .single();

    if (userStatsError || !currentUserStats) {
      return c.json(
        { error: 'User stats not found', code: 'NOT_FOUND' },
        404
      );
    }

    // Count users with higher points to determine rank
    const { count: higherCount, error: rankError } = await supabase
      .from('user_stats')
      .select('*', { count: 'exact', head: true })
      .gt('total_points', currentUserStats.total_points);

    if (rankError) {
      return c.json(
        { error: 'Failed to calculate rank', code: 'DATABASE_ERROR' },
        500
      );
    }

    const currentRank = (higherCount || 0) + 1;

    // Fetch display name
    const { data: currentUser } = await supabase
      .from('users')
      .select('display_name')
      .eq('wallet_address', auth.walletAddress)
      .single();

    // Fetch 2 users above (higher points)
    const { data: aboveData } = await supabase
      .from('user_stats')
      .select('wallet_address, total_points, tier')
      .gt('total_points', currentUserStats.total_points)
      .order('total_points', { ascending: true })
      .limit(2);

    // Fetch 2 users below (lower points)
    const { data: belowData } = await supabase
      .from('user_stats')
      .select('wallet_address, total_points, tier')
      .lt('total_points', currentUserStats.total_points)
      .order('total_points', { ascending: false })
      .limit(2);

    // Fetch display names for surrounding users
    const surroundingWallets = [
      ...(aboveData?.map((u) => u.wallet_address) || []),
      ...(belowData?.map((u) => u.wallet_address) || []),
    ];

    const { data: surroundingUsers } = await supabase
      .from('users')
      .select('wallet_address, display_name')
      .in('wallet_address', surroundingWallets);

    const displayNameMap = new Map(
      surroundingUsers?.map((u) => [u.wallet_address, u.display_name]) || []
    );

    // Build above entries (reverse order for correct ranking)
    const above = (aboveData || []).reverse().map((stat, index) => ({
      walletAddress: stat.wallet_address,
      displayName: displayNameMap.get(stat.wallet_address) || null,
      totalPoints: stat.total_points,
      rank: currentRank - (aboveData?.length || 0) + index,
      tier: stat.tier,
    }));

    // Build below entries
    const below = (belowData || []).map((stat, index) => ({
      walletAddress: stat.wallet_address,
      displayName: displayNameMap.get(stat.wallet_address) || null,
      totalPoints: stat.total_points,
      rank: currentRank + index + 1,
      tier: stat.tier,
    }));

    const response = LeaderboardPositionResponseSchema.parse({
      currentUser: {
        walletAddress: auth.walletAddress,
        displayName: currentUser?.display_name || null,
        totalPoints: currentUserStats.total_points,
        rank: currentRank,
        tier: currentUserStats.tier,
      },
      above,
      below,
    });

    return c.json(response, 200);
  } catch {
    return c.json(
      { error: 'Failed to fetch leaderboard position', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

export { gamification };
