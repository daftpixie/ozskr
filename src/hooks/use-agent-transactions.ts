'use client';

import { useQuery } from '@tanstack/react-query';
import { createSupabaseClient } from '@/lib/api/supabase';

// =============================================================================
// Types
// =============================================================================

export interface AgentServiceUsageRow {
  id: string;
  service_id: string;
  price_usdc: number;
  provider_cost_usdc: number;
  latency_ms: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Fetches the last 5 service usage rows for a given character from
 * agent_service_usage. The table is not yet in the generated Supabase types,
 * so we use a raw REST fetch against the Supabase PostgREST endpoint to avoid
 * `as any` on the typed client.
 *
 * Reads the public anon key from env — RLS on agent_service_usage must permit
 * the authenticated session to read its own rows.
 */
export function useAgentTransactions(characterId: string | null) {
  return useQuery({
    queryKey: ['agent-transactions', characterId],
    queryFn: async (): Promise<AgentServiceUsageRow[]> => {
      if (!characterId) return [];

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase environment variables');
      }

      // Use createSupabaseClient for auth/session, but query via PostgREST URL
      // to sidestep the lack of generated types for agent_service_usage.
      const supabase = createSupabaseClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = (supabase as any).from('agent_service_usage');
      const { data, error } = await table
        .select('id, service_id, price_usdc, provider_cost_usdc, latency_ms, success, error_message, created_at')
        .eq('character_id', characterId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        const msg = typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Unknown error fetching service usage';
        throw new Error(msg);
      }

      if (!Array.isArray(data)) return [];

      return (data as unknown[]).map((row) => {
        if (typeof row !== 'object' || row === null) {
          throw new Error('Unexpected row shape from agent_service_usage');
        }
        const r = row as Record<string, unknown>;
        return {
          id: String(r['id'] ?? ''),
          service_id: String(r['service_id'] ?? ''),
          price_usdc: typeof r['price_usdc'] === 'number' ? r['price_usdc'] : 0,
          provider_cost_usdc: typeof r['provider_cost_usdc'] === 'number' ? r['provider_cost_usdc'] : 0,
          latency_ms: typeof r['latency_ms'] === 'number' ? r['latency_ms'] : 0,
          success: r['success'] === true,
          error_message: typeof r['error_message'] === 'string' ? r['error_message'] : null,
          created_at: String(r['created_at'] ?? ''),
        } satisfies AgentServiceUsageRow;
      });
    },
    enabled: !!characterId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
