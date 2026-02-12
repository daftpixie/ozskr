/**
 * Leaderboard Refresh
 * Materialized view refresh for leaderboard rankings by period
 */

import { createSupabaseServerClient } from '@/lib/api/supabase';
import { LeaderboardPeriod } from '@/types/database';
import { logger } from '@/lib/utils/logger';

/**
 * Get date range for a leaderboard period
 */
function getDateRangeForPeriod(period: LeaderboardPeriod): Date | null {
  const now = new Date();

  switch (period) {
    case LeaderboardPeriod.DAILY: {
      // Today (midnight)
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      return today;
    }
    case LeaderboardPeriod.WEEKLY: {
      // Last 7 days
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return weekAgo;
    }
    case LeaderboardPeriod.MONTHLY: {
      // Last 30 days
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return monthAgo;
    }
    case LeaderboardPeriod.ALL_TIME:
      // No date filter
      return null;
    default:
      return null;
  }
}

/**
 * Refresh leaderboard cache for a specific period
 *
 * This function:
 * 1. For `all_time`: ranks users by user_stats.total_points
 * 2. For `daily/weekly/monthly`: sums user_points.points_amount within the time window
 * 3. Deletes old cache entries for the period
 * 4. Inserts new ranked entries into leaderboard_cache
 *
 * @param period - Leaderboard period to refresh
 * @throws Error if database operations fail
 */
export async function refreshLeaderboard(period: LeaderboardPeriod): Promise<void> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  }

  const supabase = createSupabaseServerClient(serviceRoleKey);

  try {
    const now = new Date().toISOString();
    const dateThreshold = getDateRangeForPeriod(period);

    // 1. Fetch ranked users based on period
    let rankedUsers: Array<{
      wallet_address: string;
      display_name: string | null;
      total_points: number;
      tier: string;
    }> = [];

    if (period === LeaderboardPeriod.ALL_TIME) {
      // Rank by user_stats.total_points
      const { data: statsData, error: statsError } = await supabase
        .from('user_stats')
        .select('wallet_address, total_points, tier')
        .order('total_points', { ascending: false });

      if (statsError) {
        throw new Error(`Failed to fetch user_stats: ${statsError.message}`);
      }

      // Fetch display names
      const walletAddresses = statsData?.map((s) => s.wallet_address) || [];
      const { data: usersData } = await supabase
        .from('users')
        .select('wallet_address, display_name')
        .in('wallet_address', walletAddresses);

      const displayNameMap = new Map(
        usersData?.map((u) => [u.wallet_address, u.display_name]) || []
      );

      rankedUsers = (statsData || []).map((stat) => ({
        wallet_address: stat.wallet_address,
        display_name: displayNameMap.get(stat.wallet_address) || null,
        total_points: stat.total_points,
        tier: stat.tier,
      }));
    } else {
      // For time-based periods, sum user_points within the window
      if (!dateThreshold) {
        throw new Error(`Invalid period: ${period}`);
      }

      // Fetch points in the time window and group by wallet
      const { data: pointsData, error: pointsError } = await supabase
        .from('user_points')
        .select('wallet_address, points_amount')
        .gte('created_at', dateThreshold.toISOString());

      if (pointsError) {
        throw new Error(`Failed to fetch user_points: ${pointsError.message}`);
      }

      // Sum points by wallet
      const pointsByWallet = new Map<string, number>();
      for (const point of pointsData || []) {
        const current = pointsByWallet.get(point.wallet_address) || 0;
        pointsByWallet.set(point.wallet_address, current + point.points_amount);
      }

      // Fetch user tiers and display names
      const walletAddresses = Array.from(pointsByWallet.keys());
      if (walletAddresses.length === 0) {
        rankedUsers = [];
      } else {
        const { data: statsData } = await supabase
          .from('user_stats')
          .select('wallet_address, tier')
          .in('wallet_address', walletAddresses);

        const { data: usersData } = await supabase
          .from('users')
          .select('wallet_address, display_name')
          .in('wallet_address', walletAddresses);

        const tierMap = new Map(statsData?.map((s) => [s.wallet_address, s.tier]) || []);
        const displayNameMap = new Map(
          usersData?.map((u) => [u.wallet_address, u.display_name]) || []
        );

        // Build ranked list
        rankedUsers = Array.from(pointsByWallet.entries())
          .map(([wallet_address, total_points]) => ({
            wallet_address,
            display_name: displayNameMap.get(wallet_address) || null,
            total_points,
            tier: tierMap.get(wallet_address) || 'newcomer',
          }))
          .sort((a, b) => b.total_points - a.total_points);
      }
    }

    // 2. Delete old cache entries for this period
    const { error: deleteError } = await supabase
      .from('leaderboard_cache')
      .delete()
      .eq('period', period);

    if (deleteError) {
      logger.warn('Failed to delete old leaderboard cache (continuing)', {
        period,
        error: deleteError.message,
      });
    }

    // 3. Insert new ranked entries
    if (rankedUsers.length > 0) {
      const cacheEntries = rankedUsers.map((user, index) => ({
        wallet_address: user.wallet_address,
        display_name: user.display_name,
        total_points: user.total_points,
        rank: index + 1,
        tier: user.tier,
        period,
        cached_at: now,
      }));

      const { error: insertError } = await supabase
        .from('leaderboard_cache')
        .insert(cacheEntries);

      if (insertError) {
        throw new Error(`Failed to insert leaderboard cache: ${insertError.message}`);
      }
    }

    logger.info('Leaderboard refreshed successfully', {
      period,
      entriesCount: rankedUsers.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('refreshLeaderboard failed', {
      period,
      error: message,
    });
    throw error;
  }
}

/**
 * Refresh all leaderboard periods
 */
export async function refreshAllLeaderboards(): Promise<void> {
  const periods = [
    LeaderboardPeriod.DAILY,
    LeaderboardPeriod.WEEKLY,
    LeaderboardPeriod.MONTHLY,
    LeaderboardPeriod.ALL_TIME,
  ];

  const results = await Promise.allSettled(
    periods.map((period) => refreshLeaderboard(period))
  );

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    logger.warn('Some leaderboard refreshes failed', {
      failureCount: failures.length,
      totalPeriods: periods.length,
    });
  }
}
