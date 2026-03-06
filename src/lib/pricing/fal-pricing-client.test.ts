/**
 * Tests for fal.ai Pricing Client
 *
 * Verifies: successful price fetch, non-OK response fallback,
 * network error fallback, unknown model null return, and in-process caching.
 *
 * Cache isolation strategy: vi.resetModules() + dynamic import before each test
 * so the module-level cache always starts empty.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the logger at module level (must be hoisted)
// ---------------------------------------------------------------------------
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOkResponse(prices: unknown[]): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ prices }),
  } as unknown as Response;
}

function makeErrorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({}),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
//
// Each test:
//   1. Resets modules so the module-level cache starts empty
//   2. Stubs global.fetch
//   3. Dynamically imports the module under test
// ---------------------------------------------------------------------------

describe('fal-pricing-client: getFalModelPrice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.FAL_KEY = 'test-fal-key';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.FAL_KEY;
    vi.resetModules();
  });

  async function importFresh() {
    // Each call after resetModules() gives a fresh module with empty cache
    const mod = await import('./fal-pricing-client');
    return mod;
  }

  it('should return parsed price when API succeeds', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      makeOkResponse([
        {
          endpoint_id: 'fal-ai/nano-banana',
          unit_price: 0.035,
          unit: 'image',
          currency: 'USD',
        },
      ])
    );

    vi.resetModules();
    const { getFalModelPrice } = await importFresh();
    const price = await getFalModelPrice('fal-ai/nano-banana');

    expect(price).not.toBeNull();
    expect(price?.endpointId).toBe('fal-ai/nano-banana');
    expect(price?.unitPrice).toBe(0.035);
    expect(price?.unit).toBe('image');
    expect(price?.currency).toBe('USD');
  });

  it('should fall back to FALLBACK_FAL_PRICES on non-OK response without throwing', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(makeErrorResponse(503));

    vi.resetModules();
    const { getFalModelPrice, FALLBACK_FAL_PRICES } = await importFresh();
    const price = await getFalModelPrice('fal-ai/veo3/fast');

    expect(price).not.toBeNull();
    expect(price?.endpointId).toBe('fal-ai/veo3/fast');
    expect(price?.unitPrice).toBe(FALLBACK_FAL_PRICES['fal-ai/veo3/fast'].unitPrice);
  });

  it('should fall back to FALLBACK_FAL_PRICES on network error without throwing', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    vi.resetModules();
    const { getFalModelPrice, FALLBACK_FAL_PRICES } = await importFresh();
    const price = await getFalModelPrice('fal-ai/nano-banana-2');

    expect(price).not.toBeNull();
    expect(price?.unitPrice).toBe(FALLBACK_FAL_PRICES['fal-ai/nano-banana-2'].unitPrice);
  });

  it('should return null for unknown model ID not in fallback', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(makeOkResponse([]));

    vi.resetModules();
    const { getFalModelPrice } = await importFresh();
    const price = await getFalModelPrice('fal-ai/completely-unknown-model');

    expect(price).toBeNull();
  });

  it('should cache results and not re-fetch within the 5-minute TTL', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      makeOkResponse([
        {
          endpoint_id: 'fal-ai/nano-banana-pro',
          unit_price: 0.12,
          unit: 'image',
          currency: 'USD',
        },
      ])
    );

    vi.resetModules();
    const { getFalModelPrice } = await importFresh();

    // First call — populates cache
    const firstResult = await getFalModelPrice('fal-ai/nano-banana-pro');
    expect(firstResult?.unitPrice).toBe(0.12);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Advance time by less than TTL — cache is still valid
    vi.advanceTimersByTime(CACHE_TTL_MS - 1000);

    // Second call — should use cache, no new fetch
    const secondResult = await getFalModelPrice('fal-ai/nano-banana-pro');
    expect(secondResult?.unitPrice).toBe(0.12);

    // fetch must still have been called only once
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('should re-fetch after the cache TTL expires', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        makeOkResponse([
          { endpoint_id: 'fal-ai/veo3', unit_price: 0.15, unit: 'second', currency: 'USD' },
        ])
      )
      .mockResolvedValueOnce(
        makeOkResponse([
          { endpoint_id: 'fal-ai/veo3', unit_price: 0.16, unit: 'second', currency: 'USD' },
        ])
      );

    vi.resetModules();
    const { getFalModelPrice } = await importFresh();

    // First call
    await getFalModelPrice('fal-ai/veo3');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Advance past TTL
    vi.advanceTimersByTime(CACHE_TTL_MS + 1000);

    const refreshed = await getFalModelPrice('fal-ai/veo3');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(refreshed?.unitPrice).toBe(0.16);
  });

  it('should fall back gracefully when FAL_KEY is not set', async () => {
    delete process.env.FAL_KEY;
    const fetchSpy = vi.spyOn(global, 'fetch');

    vi.resetModules();
    const { getFalModelPrice, FALLBACK_FAL_PRICES } = await importFresh();
    const price = await getFalModelPrice('fal-ai/nano-banana');

    // Should return fallback, not throw
    expect(price).not.toBeNull();
    expect(price?.unitPrice).toBe(FALLBACK_FAL_PRICES['fal-ai/nano-banana'].unitPrice);
    // Should not have called fetch because key is absent
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should return prices for all fallback endpoint IDs when batch-fetching after network error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new TypeError('Network error'));

    vi.resetModules();
    const { getFalModelPrices, FALLBACK_FAL_PRICES } = await importFresh();

    const endpointIds = Object.keys(FALLBACK_FAL_PRICES);
    const prices = await getFalModelPrices(endpointIds);

    for (const id of endpointIds) {
      expect(prices.has(id)).toBe(true);
      expect(prices.get(id)?.unitPrice).toBe(FALLBACK_FAL_PRICES[id].unitPrice);
    }
  });
});
