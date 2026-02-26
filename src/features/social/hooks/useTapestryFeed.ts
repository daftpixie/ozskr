'use client';

/**
 * React Query hook for fetching a character's Tapestry content feed
 */

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

export const TapestryContentItemSchema = z.object({
  id: z.string(),
  contentId: z.string().optional(),
  contentText: z.string().optional(),
  platform: z.string().optional(),
  created_at: z.number().optional(),
});

export type TapestryContentItem = z.infer<typeof TapestryContentItemSchema>;

export const TapestryFeedSchema = z.object({
  contents: z.array(TapestryContentItemSchema),
  page: z.number(),
  limit: z.number(),
});

export type TapestryFeed = z.infer<typeof TapestryFeedSchema>;

export function useTapestryFeed(characterId: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['tapestry', 'feed', characterId, page, limit],
    queryFn: async (): Promise<TapestryFeed | null> => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      const res = await fetch(`/api/tapestry/feed/${characterId}?${params}`);
      if (!res.ok) return null;
      const data: unknown = await res.json();
      const parsed = TapestryFeedSchema.safeParse(data);
      if (!parsed.success) return null;
      return parsed.data;
    },
    enabled: !!characterId,
  });
}
