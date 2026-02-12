/**
 * React Query hooks for Gamification API
 * Handles fetching user stats, points, achievements, and leaderboard data
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/wallet/store';
import { QUERY_STALE_TIMES } from '@/lib/query-config';
import {
  UserStatsResponseSchema,
  UserPointsPaginatedResponseSchema,
  AllAchievementsResponseSchema,
  LeaderboardResponseSchema,
  LeaderboardPositionResponseSchema,
} from '@/types/gamification';
import { LeaderboardPeriod } from '@/types/database';

const API_BASE = '/api/gamification';

interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Get user stats with tier progress
 */
export function useUserStats() {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['gamification', 'stats'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/me/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch user stats');
      }

      const data: unknown = await response.json();
      return UserStatsResponseSchema.parse(data);
    },
    enabled: !!token,
    staleTime: QUERY_STALE_TIMES.GAMIFICATION_STATS,
  });
}

/**
 * Get user points history with pagination
 */
export function useUserPoints(params?: PaginationParams) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['gamification', 'points', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());

      const url = `${API_BASE}/me/points?${searchParams.toString()}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch user points');
      }

      const data: unknown = await response.json();
      return UserPointsPaginatedResponseSchema.parse(data);
    },
    enabled: !!token,
  });
}

/**
 * Get all achievements (unlocked and locked with progress)
 */
export function useAchievements() {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['gamification', 'achievements'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/me/achievements`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch achievements');
      }

      const data: unknown = await response.json();
      return AllAchievementsResponseSchema.parse(data);
    },
    enabled: !!token,
    staleTime: QUERY_STALE_TIMES.ACHIEVEMENTS,
  });
}

/**
 * Get leaderboard for a specific period
 */
export function useLeaderboard(
  period: LeaderboardPeriod = LeaderboardPeriod.ALL_TIME,
  limit = 100
) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['gamification', 'leaderboard', period, limit],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('period', period);
      searchParams.set('limit', limit.toString());

      const url = `${API_BASE}/leaderboard?${searchParams.toString()}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch leaderboard');
      }

      const data: unknown = await response.json();
      return LeaderboardResponseSchema.parse(data);
    },
    enabled: !!token,
    staleTime: QUERY_STALE_TIMES.LEADERBOARD,
    refetchInterval: QUERY_STALE_TIMES.LEADERBOARD,
  });
}

/**
 * Get current user's leaderboard position with surrounding users
 */
export function useLeaderboardPosition() {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['gamification', 'leaderboard', 'position'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/leaderboard/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch leaderboard position');
      }

      const data: unknown = await response.json();
      return LeaderboardPositionResponseSchema.parse(data);
    },
    enabled: !!token,
    staleTime: QUERY_STALE_TIMES.LEADERBOARD,
  });
}
