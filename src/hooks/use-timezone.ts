'use client';

/**
 * useTimezone
 * Returns the active IANA timezone string for calendar display and date math.
 *
 * Priority:
 *   1. users.timezone stored in Supabase (saved user preference)
 *   2. Browser IANA timezone (Intl.DateTimeFormat) — fallback while loading or unauthenticated
 */

import { useQuery } from '@tanstack/react-query';
import { createSupabaseClient } from '@/lib/api/supabase';
import { useAuthStore } from '@/features/wallet/store';

const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function useTimezone(): string {
  const walletAddress = useAuthStore((s) => s.user?.walletAddress ?? null);

  const { data } = useQuery({
    queryKey: ['user-timezone', walletAddress],
    queryFn: async () => {
      if (!walletAddress) return null;
      const supabase = createSupabaseClient();
      const { data: user } = await supabase
        .from('users')
        .select('timezone')
        .eq('wallet_address', walletAddress)
        .single();
      return user?.timezone ?? null;
    },
    enabled: !!walletAddress,
    staleTime: 5 * 60 * 1000, // 5 min — timezone rarely changes
  });

  return data ?? BROWSER_TIMEZONE;
}
