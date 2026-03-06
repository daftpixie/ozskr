'use client';

/**
 * Pricing Hook
 *
 * React Query wrapper for GET /api/services/pricing.
 * Fetches a live PriceQuote for the current model/category selection.
 * Cache TTL matches the server-side 5-minute cache on fal.ai prices.
 */

import { useQuery } from '@tanstack/react-query';
import type { ContentCategory } from '@/lib/pricing/model-registry';

// Re-export so consumers only need to import from this module
export type { PriceQuote } from '@/lib/pricing/pricing-calculator';

// ---------------------------------------------------------------------------
// Param type
// ---------------------------------------------------------------------------

export interface UsePricingParams {
  category: ContentCategory;
  imageModel?: string;
  videoModel?: string;
  textModel?: string;
  videoDuration?: number;
  videoResolution?: '720p' | '1080p' | '4K';
  videoAudio?: boolean;
}

// ---------------------------------------------------------------------------
// Wire response type — platformCostLamports arrives as a string over the wire
// ---------------------------------------------------------------------------

interface PriceQuoteWire {
  category: ContentCategory;
  baseCostUsd: number;
  markupPercent: number;
  platformCostUsd: number;
  platformCostUsdc: number;
  platformCostLamports: string; // BigInt serialized to string on the server
  breakdown: string;
  models: Array<{
    provider: string;
    modelId: string;
    baseCostUsd: number;
    unit: string;
  }>;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function fetchPricing(params: UsePricingParams): Promise<import('@/lib/pricing/pricing-calculator').PriceQuote> {
  const search = new URLSearchParams();
  search.set('category', params.category);
  if (params.imageModel) search.set('imageModel', params.imageModel);
  if (params.videoModel) search.set('videoModel', params.videoModel);
  if (params.textModel) search.set('textModel', params.textModel);
  if (params.videoDuration !== undefined) {
    search.set('videoDuration', String(params.videoDuration));
  }
  if (params.videoResolution) search.set('videoResolution', params.videoResolution);
  if (params.videoAudio !== undefined) {
    search.set('videoAudio', params.videoAudio ? 'true' : 'false');
  }

  const response = await fetch(`/api/services/pricing?${search.toString()}`);
  if (!response.ok) {
    throw new Error(`Pricing fetch failed: ${response.status}`);
  }

  const wire = (await response.json()) as PriceQuoteWire;

  // Rehydrate BigInt from the string the server serialized
  return {
    ...wire,
    platformCostLamports: BigInt(wire.platformCostLamports),
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePricing(params: UsePricingParams | null): {
  data: import('@/lib/pricing/pricing-calculator').PriceQuote | undefined;
  isLoading: boolean;
  error: Error | null;
} {
  const result = useQuery({
    queryKey: ['pricing', params],
    queryFn: () => fetchPricing(params!),
    enabled: params !== null,
    staleTime: 5 * 60 * 1000, // 5 minutes — matches server cache TTL
    retry: 1,
  });

  return {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error,
  };
}
