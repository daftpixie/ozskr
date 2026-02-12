/**
 * React Query hooks for Analytics API
 * Handles fetching analytics data for characters and overview
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/wallet/store';
import { QUERY_STALE_TIMES } from '@/lib/query-config';
import {
  AnalyticsSummaryResponse,
  AnalyticsSnapshotResponse,
  AnalyticsHistoryQuery,
} from '@/types/social';
import { z } from 'zod';

const API_BASE = '/api/analytics';

const AnalyticsHistoryResponseSchema = z.object({
  history: z.array(z.unknown()),
  granularity: z.enum(['day', 'week', 'month']),
});

interface AnalyticsOverviewResponse {
  totalCharacters: number;
  totalGenerations: number;
  totalPosts: number;
  totalEngagement: Record<string, number>;
  avgQualityScore: number | null;
}

/**
 * Get aggregated analytics summary for a character
 */
export function useAnalyticsSummary(characterId: string | undefined) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['analytics-summary', characterId],
    queryFn: async () => {
      if (!characterId) throw new Error('Character ID is required');

      const response = await fetch(`${API_BASE}/characters/${characterId}/summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch analytics summary');
      }

      const data: unknown = await response.json();
      return data as AnalyticsSummaryResponse;
    },
    enabled: !!token && !!characterId,
    staleTime: QUERY_STALE_TIMES.ANALYTICS,
  });
}

/**
 * Get time-series analytics history for a character
 */
export function useAnalyticsHistory(
  characterId: string | undefined,
  params?: AnalyticsHistoryQuery
) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['analytics-history', characterId, params],
    queryFn: async () => {
      if (!characterId) throw new Error('Character ID is required');

      const searchParams = new URLSearchParams();
      if (params?.startDate) searchParams.set('startDate', params.startDate);
      if (params?.endDate) searchParams.set('endDate', params.endDate);
      if (params?.granularity) searchParams.set('granularity', params.granularity);

      const url = `${API_BASE}/characters/${characterId}/history?${searchParams.toString()}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch analytics history');
      }

      const data: unknown = await response.json();
      const parsed = AnalyticsHistoryResponseSchema.parse(data);
      return {
        history: parsed.history as AnalyticsSnapshotResponse[],
        granularity: parsed.granularity,
      };
    },
    enabled: !!token && !!characterId,
    staleTime: QUERY_STALE_TIMES.ANALYTICS,
  });
}

/**
 * Get overview analytics for all user's characters
 */
export function useAnalyticsOverview() {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['analytics-overview'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/overview`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch analytics overview');
      }

      const data: unknown = await response.json();
      return data as AnalyticsOverviewResponse;
    },
    enabled: !!token,
    staleTime: QUERY_STALE_TIMES.ANALYTICS,
  });
}
