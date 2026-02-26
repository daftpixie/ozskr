'use client';

/**
 * React Query hook for fetching a character's Tapestry social profile
 */

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

export const TapestryProfileSchema = z.object({
  id: z.string(),
  namespace: z.string(),
  username: z.string(),
  bio: z.string().optional(),
  image: z.string().optional(),
  created_at: z.string().optional(),
});

export type TapestryProfile = z.infer<typeof TapestryProfileSchema>;

export function useTapestryProfile(characterId: string) {
  return useQuery({
    queryKey: ['tapestry', 'profile', characterId],
    queryFn: async (): Promise<TapestryProfile | null> => {
      const res = await fetch(`/api/tapestry/profile/${characterId}`);
      if (!res.ok) return null;
      const data: unknown = await res.json();
      const parsed = z.object({ profile: TapestryProfileSchema }).safeParse(data);
      if (!parsed.success) return null;
      return parsed.data.profile;
    },
    enabled: !!characterId,
  });
}
