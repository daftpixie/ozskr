'use client';

/**
 * Agent Balance Hook
 *
 * Fetches the agent's active delegated USDC balance from
 * GET /api/delegation/:characterId and returns it as a human-readable
 * USDC float (micro-USDC / 1_000_000).
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/features/wallet/store';

// ---------------------------------------------------------------------------
// Response type (partial — only the fields we need)
// ---------------------------------------------------------------------------

interface DelegationAccount {
  remainingAmount: string; // micro-USDC as string
  delegationStatus: string;
}

interface DelegationResponse {
  delegation: {
    delegationAccounts: DelegationAccount[];
  };
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function fetchAgentDelegation(
  characterId: string,
  token: string
): Promise<number | null> {
  const response = await fetch(`/api/delegation/${characterId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    // 404 means no delegation exists — return null gracefully
    if (response.status === 404) return null;
    throw new Error(`Delegation fetch failed: ${response.status}`);
  }

  const data = (await response.json()) as DelegationResponse;
  const accounts = data.delegation?.delegationAccounts ?? [];

  // Find the first active account
  const active = accounts.find((a) => a.delegationStatus === 'active');
  if (!active) return null;

  const microUsdc = BigInt(active.remainingAmount);
  return Number(microUsdc) / 1_000_000;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAgentBalance(characterId: string | null): {
  remainingUsdc: number | null;
  isLoading: boolean;
} {
  const token = useAuthStore((state) => state.token);

  const result = useQuery({
    queryKey: ['agent-balance', characterId],
    queryFn: () => fetchAgentDelegation(characterId!, token!),
    enabled: characterId !== null && token !== null,
    staleTime: 30 * 1000, // 30 seconds — balance can change frequently
    retry: 1,
  });

  return {
    remainingUsdc: result.data ?? null,
    isLoading: result.isLoading,
  };
}
