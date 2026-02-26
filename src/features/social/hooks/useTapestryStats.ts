'use client';

/**
 * React Query hook for fetching a character's Tapestry social stats
 */

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

export const TapestryStatsSchema = z.object({
  followers: z.number(),
  following: z.number(),
  contentCount: z.number(),
});

export type TapestryStats = z.infer<typeof TapestryStatsSchema>;

export function useTapestryStats(characterId: string) {
  return useQuery({
    queryKey: ['tapestry', 'stats', characterId],
    queryFn: async (): Promise<TapestryStats | null> => {
      const res = await fetch(`/api/tapestry/stats/${characterId}`);
      if (!res.ok) return null;
      const data: unknown = await res.json();
      const parsed = z
        .object({ stats: TapestryStatsSchema })
        .safeParse(data);
      if (!parsed.success) return null;
      return parsed.data.stats;
    },
    enabled: !!characterId,
  });
}
