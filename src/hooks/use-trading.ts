/**
 * React Query hooks for Trading API
 * Handles swap quotes, execution, history, and portfolio
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/features/wallet/store';
import type {
  SwapQuoteRequest,
  SwapExecuteRequest,
  SwapHistoryResponse,
  TokenBalance,
} from '@/types/trading';
import type { QuotePreview, SwapResult, SwapProgressCallback } from '@/features/trading/lib/swap-flow';
import type { Portfolio } from '@/features/trading/lib/portfolio';
import { getAllTokens, searchTokens as searchTokensUtil } from '@/lib/solana/token-list';

const API_BASE = '/api/trading';

/**
 * Fetch swap quote from Jupiter via API
 */
export function useSwapQuote(params: SwapQuoteRequest | null) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['swap-quote', params],
    queryFn: async () => {
      if (!params) throw new Error('Quote params required');

      const response = await fetch(`${API_BASE}/quote`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch quote');
      }

      // Server already validates with Zod — trust internal API shape
      const data: unknown = await response.json();
      return data as QuotePreview;
    },
    enabled: !!token && !!params,
    staleTime: 10_000, // 10 seconds
    refetchInterval: 30_000, // Refetch every 30s while active
  });
}

/**
 * Execute swap mutation
 */
export function useExecuteSwap(_onProgress?: SwapProgressCallback) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SwapExecuteRequest) => {
      const response = await fetch(`${API_BASE}/swap`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to execute swap');
      }

      // Server already validates with Zod — trust internal API shape
      const data: unknown = await response.json();
      return data as SwapResult;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['swap-history'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['token-balance'] });
    },
  });
}

/**
 * Fetch swap history with pagination
 */
export function useSwapHistory(page = 1, limit = 20) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['swap-history', page, limit],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE}/history?page=${page}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch swap history');
      }

      const data: unknown = await response.json();
      return data as { swaps: SwapHistoryResponse[]; total: number };
    },
    enabled: !!token,
  });
}

/**
 * Fetch portfolio for wallet address
 */
export function usePortfolio(walletAddress: string | undefined) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['portfolio', walletAddress],
    queryFn: async () => {
      if (!walletAddress) throw new Error('Wallet address required');

      const response = await fetch(`${API_BASE}/portfolio/${walletAddress}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch portfolio');
      }

      const data: unknown = await response.json();
      return data as Portfolio;
    },
    enabled: !!token && !!walletAddress,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 30_000, // Auto-refresh every 30s
  });
}

/**
 * Get all available tokens
 */
export function useTokenList() {
  return useQuery({
    queryKey: ['token-list'],
    queryFn: async () => {
      return getAllTokens();
    },
    staleTime: Infinity, // Token list rarely changes
  });
}

/**
 * Search tokens client-side
 */
export function useTokenSearch(query: string) {
  return useQuery({
    queryKey: ['token-search', query],
    queryFn: async () => {
      return searchTokensUtil(query);
    },
    enabled: query.length > 0,
    staleTime: Infinity,
  });
}

/**
 * Fetch single token balance
 */
export function useTokenBalance(
  walletAddress: string | undefined,
  mint: string | undefined
) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['token-balance', walletAddress, mint],
    queryFn: async () => {
      if (!walletAddress || !mint) throw new Error('Wallet and mint required');

      const response = await fetch(
        `${API_BASE}/balance/${walletAddress}/${mint}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch token balance');
      }

      const data: unknown = await response.json();
      return data as TokenBalance;
    },
    enabled: !!token && !!walletAddress && !!mint,
    staleTime: 10_000, // 10 seconds
  });
}
