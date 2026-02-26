'use client';

/**
 * React Query hooks for fetching a character's Tapestry social graph
 * (followers and following)
 */

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

export const TapestryGraphProfileSchema = z.object({
  id: z.string(),
  namespace: z.string(),
  username: z.string(),
  bio: z.string().optional(),
  image: z.string().optional(),
});

export type TapestryGraphProfile = z.infer<typeof TapestryGraphProfileSchema>;

export const TapestryGraphSchema = z.object({
  type: z.string(),
  profiles: z.array(TapestryGraphProfileSchema),
});

export type TapestryGraph = z.infer<typeof TapestryGraphSchema>;

export type GraphType = 'followers' | 'following';

export function useTapestryGraph(characterId: string, type: GraphType) {
  return useQuery({
    queryKey: ['tapestry', 'graph', characterId, type],
    queryFn: async (): Promise<TapestryGraph | null> => {
      const params = new URLSearchParams({ type });
      const res = await fetch(`/api/tapestry/graph/${characterId}?${params}`);
      if (!res.ok) return null;
      const data: unknown = await res.json();
      const parsed = TapestryGraphSchema.safeParse(data);
      if (!parsed.success) return null;
      return parsed.data;
    },
    enabled: !!characterId,
  });
}

export function useTapestryFollowers(characterId: string) {
  return useTapestryGraph(characterId, 'followers');
}

export function useTapestryFollowing(characterId: string) {
  return useTapestryGraph(characterId, 'following');
}
