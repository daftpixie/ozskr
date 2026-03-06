/**
 * fal.ai Pricing Client
 *
 * Fetches live model prices from the fal.ai pricing API.
 * Results are cached in-process for 5 minutes to avoid hammering the upstream
 * endpoint on every request.  If the API is unavailable or returns an error,
 * the client falls back to hardcoded prices silently — it never throws.
 *
 * SECURITY: FAL_KEY is read server-side only.  This module must never be
 * imported from client-side code.
 */

import { logger } from '@/lib/utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FalModelPrice {
  endpointId: string;
  unitPrice: number;   // USD per unit
  unit: string;        // 'image' | 'second' | 'megapixel'
  currency: 'USD';
}

interface FalPricingApiEntry {
  endpoint_id: string;
  unit_price: number;
  unit: string;
  currency: string;
}

interface FalPricingApiResponse {
  prices: FalPricingApiEntry[];
}

// ---------------------------------------------------------------------------
// Fallback prices (used when the API is unreachable or returns an error)
// ---------------------------------------------------------------------------

export const FALLBACK_FAL_PRICES: Record<string, FalModelPrice> = {
  'fal-ai/nano-banana': {
    endpointId: 'fal-ai/nano-banana',
    unitPrice: 0.04,
    unit: 'image',
    currency: 'USD',
  },
  'fal-ai/nano-banana-2': {
    endpointId: 'fal-ai/nano-banana-2',
    unitPrice: 0.08,
    unit: 'image',
    currency: 'USD',
  },
  'fal-ai/nano-banana-pro': {
    endpointId: 'fal-ai/nano-banana-pro',
    unitPrice: 0.12,
    unit: 'image',
    currency: 'USD',
  },
  'fal-ai/veo3/fast': {
    endpointId: 'fal-ai/veo3/fast',
    unitPrice: 0.12,
    unit: 'second',
    currency: 'USD',
  },
  'fal-ai/veo3': {
    endpointId: 'fal-ai/veo3',
    unitPrice: 0.15,
    unit: 'second',
    currency: 'USD',
  },
  'fal-ai/veo3.1/fast': {
    endpointId: 'fal-ai/veo3.1/fast',
    unitPrice: 0.18,
    unit: 'second',
    currency: 'USD',
  },
  'fal-ai/veo3.1': {
    endpointId: 'fal-ai/veo3.1',
    unitPrice: 0.22,
    unit: 'second',
    currency: 'USD',
  },
};

// ---------------------------------------------------------------------------
// In-process cache (5-minute TTL)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  prices: Map<string, FalModelPrice>;
  fetchedAt: number;
}

let _cache: CacheEntry | null = null;

function isCacheValid(): boolean {
  return _cache !== null && Date.now() - _cache.fetchedAt < CACHE_TTL_MS;
}

// ---------------------------------------------------------------------------
// API fetch (internal)
// ---------------------------------------------------------------------------

async function fetchFromApi(endpointIds: string[]): Promise<Map<string, FalModelPrice>> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    logger.warn('FAL_KEY not set — using fallback fal.ai prices');
    return buildFallbackMap(endpointIds);
  }

  const params = endpointIds.map((id) => `endpoint_ids=${encodeURIComponent(id)}`).join('&');
  const url = `https://api.fal.ai/billing/pricing?${params}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Key ${falKey}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    logger.warn('fal.ai pricing API unreachable — using fallback prices', {
      error: err instanceof Error ? err.message : String(err),
    });
    return buildFallbackMap(endpointIds);
  }

  if (!response.ok) {
    logger.warn('fal.ai pricing API returned non-OK status — using fallback prices', {
      status: response.status,
    });
    return buildFallbackMap(endpointIds);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    logger.warn('fal.ai pricing API returned invalid JSON — using fallback prices', {
      error: err instanceof Error ? err.message : String(err),
    });
    return buildFallbackMap(endpointIds);
  }

  if (!isValidPricingResponse(body)) {
    logger.warn('fal.ai pricing API response did not match expected shape — using fallback prices');
    return buildFallbackMap(endpointIds);
  }

  const priceMap = new Map<string, FalModelPrice>();
  for (const entry of body.prices) {
    priceMap.set(entry.endpoint_id, {
      endpointId: entry.endpoint_id,
      unitPrice: entry.unit_price,
      unit: entry.unit,
      currency: 'USD',
    });
  }

  // Fill in any missing endpoints with fallback values
  for (const id of endpointIds) {
    if (!priceMap.has(id) && FALLBACK_FAL_PRICES[id]) {
      priceMap.set(id, FALLBACK_FAL_PRICES[id]);
    }
  }

  return priceMap;
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isValidPricingResponse(value: unknown): value is FalPricingApiResponse {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj['prices'])) return false;
  return (obj['prices'] as unknown[]).every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>)['endpoint_id'] === 'string' &&
      typeof (item as Record<string, unknown>)['unit_price'] === 'number' &&
      typeof (item as Record<string, unknown>)['unit'] === 'string'
  );
}

// ---------------------------------------------------------------------------
// Fallback map builder
// ---------------------------------------------------------------------------

function buildFallbackMap(endpointIds: string[]): Map<string, FalModelPrice> {
  const map = new Map<string, FalModelPrice>();
  for (const id of endpointIds) {
    const fallback = FALLBACK_FAL_PRICES[id];
    if (fallback) {
      map.set(id, fallback);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch prices for multiple fal.ai endpoint IDs.
 * Results are cached for 5 minutes.  Falls back gracefully on any error.
 */
export async function getFalModelPrices(endpointIds: string[]): Promise<Map<string, FalModelPrice>> {
  if (isCacheValid()) {
    return _cache!.prices;
  }

  const prices = await fetchFromApi(endpointIds);
  _cache = { prices, fetchedAt: Date.now() };
  return prices;
}

/**
 * Fetch the price for a single fal.ai endpoint ID.
 * Returns null if the endpoint is unknown even in fallback prices.
 */
export async function getFalModelPrice(endpointId: string): Promise<FalModelPrice | null> {
  const prices = await getFalModelPrices([endpointId]);
  return prices.get(endpointId) ?? null;
}
