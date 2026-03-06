/**
 * Tests for Pricing Calculator
 *
 * Verifies: per-category quotes, 20% markup math, USDC lamport conversion,
 * video duration × resolution multiplier, and composite categories.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock references
// ---------------------------------------------------------------------------
const { mockGetFalModelPrice } = vi.hoisted(() => ({
  mockGetFalModelPrice: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('./fal-pricing-client', () => ({
  getFalModelPrice: mockGetFalModelPrice,
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------
import { getQuote, PLATFORM_MARKUP } from './pricing-calculator';
import { estimateClaudeCost, CLAUDE_PRICING } from './claude-cost-estimator';
import type { ClaudeModel } from './claude-cost-estimator';

// ---------------------------------------------------------------------------
// Constants (mirror the private constants in pricing-calculator.ts)
// ---------------------------------------------------------------------------

const DEFAULT_TEXT_MODEL: ClaudeModel = 'claude-sonnet-4-6';
const DEFAULT_PROMPT_TOKENS = 800;
const DEFAULT_OUTPUT_TOKENS = 400;
const DEFAULT_VIDEO_DURATION_SEC = 5;
const RESOLUTION_MULTIPLIER: Record<string, number> = {
  '720p': 1.0,
  '1080p': 1.4,
  '4K': 2.0,
};

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function applyMarkup(base: number): number {
  return Math.ceil(base * 1.2 * 1_000_000) / 1_000_000;
}

function toUsdc6Lamports(usd: number): bigint {
  return BigInt(Math.ceil(usd * 1_000_000));
}

function textBaseCost(
  model: ClaudeModel = DEFAULT_TEXT_MODEL,
  tokens: number = DEFAULT_PROMPT_TOKENS
): number {
  return estimateClaudeCost({
    model,
    estimatedInputTokens: tokens,
    estimatedOutputTokens: DEFAULT_OUTPUT_TOKENS,
  });
}

// ---------------------------------------------------------------------------
// Test image price: $0.04/image (fal-ai/nano-banana default)
// ---------------------------------------------------------------------------

const MOCK_IMAGE_PRICE = 0.04;
const MOCK_VIDEO_PRICE_PER_SEC = 0.12;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pricing-calculator: getQuote', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: return image price for image models, video price for video models
    mockGetFalModelPrice.mockImplementation((modelId: string) => {
      if (modelId.includes('veo')) {
        return Promise.resolve({
          endpointId: modelId,
          unitPrice: MOCK_VIDEO_PRICE_PER_SEC,
          unit: 'second',
          currency: 'USD' as const,
        });
      }
      return Promise.resolve({
        endpointId: modelId,
        unitPrice: MOCK_IMAGE_PRICE,
        unit: 'image',
        currency: 'USD' as const,
      });
    });
  });

  // -------------------------------------------------------------------------
  // Text
  // -------------------------------------------------------------------------

  describe("category: 'text'", () => {
    it('should return correct base cost + 20% markup', async () => {
      const quote = await getQuote({ category: 'text' });

      const expectedBase = textBaseCost();
      const expectedPlatform = applyMarkup(expectedBase);

      expect(quote.category).toBe('text');
      expect(quote.baseCostUsd).toBe(expectedBase);
      expect(quote.markupPercent).toBe(20);
      expect(quote.platformCostUsd).toBe(expectedPlatform);
      expect(quote.platformCostUsdc).toBe(expectedPlatform);
    });

    it('should compute platformCostLamports as BigInt(Math.ceil(platformCostUsd * 1_000_000))', async () => {
      const quote = await getQuote({ category: 'text' });

      const expected = toUsdc6Lamports(quote.platformCostUsd);
      expect(quote.platformCostLamports).toBe(expected);
      expect(typeof quote.platformCostLamports).toBe('bigint');
    });

    it('should use the specified textModel when provided', async () => {
      const quote = await getQuote({
        category: 'text',
        textModel: 'claude-haiku-4-5-20251001',
      });

      const haikuBase = estimateClaudeCost({
        model: 'claude-haiku-4-5-20251001',
        estimatedInputTokens: DEFAULT_PROMPT_TOKENS,
        estimatedOutputTokens: DEFAULT_OUTPUT_TOKENS,
      });

      expect(quote.baseCostUsd).toBe(haikuBase);
    });

    it('should use the specified estimatedPromptTokens', async () => {
      const tokens = 2000;
      const quote = await getQuote({ category: 'text', estimatedPromptTokens: tokens });

      const expectedBase = estimateClaudeCost({
        model: DEFAULT_TEXT_MODEL,
        estimatedInputTokens: tokens,
        estimatedOutputTokens: DEFAULT_OUTPUT_TOKENS,
      });

      expect(quote.baseCostUsd).toBe(expectedBase);
    });

    it('should include anthropic in the models breakdown', async () => {
      const quote = await getQuote({ category: 'text' });

      expect(quote.models).toHaveLength(1);
      expect(quote.models[0].provider).toBe('anthropic');
      expect(quote.models[0].unit).toBe('tokens');
    });

    it('markup should be exactly 20%', async () => {
      const quote = await getQuote({ category: 'text' });

      // platformCostUsd = ceil(baseCostUsd * 1.20 * 1_000_000) / 1_000_000
      // So: platformCostUsd >= baseCostUsd * 1.20
      expect(quote.platformCostUsd).toBeGreaterThanOrEqual(
        quote.baseCostUsd * (1 + PLATFORM_MARKUP) - 0.000001
      );
    });
  });

  // -------------------------------------------------------------------------
  // Image
  // -------------------------------------------------------------------------

  describe("category: 'image'", () => {
    it('should return correct fal.ai price + 20% markup', async () => {
      const quote = await getQuote({ category: 'image' });

      const expectedPlatform = applyMarkup(MOCK_IMAGE_PRICE);

      expect(quote.category).toBe('image');
      expect(quote.baseCostUsd).toBe(MOCK_IMAGE_PRICE);
      expect(quote.platformCostUsd).toBe(expectedPlatform);
      expect(quote.markupPercent).toBe(20);
    });

    it('should compute platformCostLamports correctly for image', async () => {
      const quote = await getQuote({ category: 'image' });

      expect(quote.platformCostLamports).toBe(toUsdc6Lamports(quote.platformCostUsd));
    });

    it('should call getFalModelPrice with the default image model', async () => {
      await getQuote({ category: 'image' });

      expect(mockGetFalModelPrice).toHaveBeenCalledWith('fal-ai/nano-banana');
    });

    it('should call getFalModelPrice with the specified image model', async () => {
      await getQuote({ category: 'image', imageModel: 'fal-ai/nano-banana-pro' });

      expect(mockGetFalModelPrice).toHaveBeenCalledWith('fal-ai/nano-banana-pro');
    });

    it('should include fal.ai in the models breakdown', async () => {
      const quote = await getQuote({ category: 'image' });

      expect(quote.models).toHaveLength(1);
      expect(quote.models[0].provider).toBe('fal.ai');
    });
  });

  // -------------------------------------------------------------------------
  // Image + Text
  // -------------------------------------------------------------------------

  describe("category: 'image-text'", () => {
    it('should sum text + image costs for baseCostUsd', async () => {
      const quote = await getQuote({ category: 'image-text' });

      const textCost = textBaseCost();
      const expectedBase = MOCK_IMAGE_PRICE + textCost;
      const expectedPlatform = applyMarkup(expectedBase);

      expect(quote.category).toBe('image-text');
      expect(quote.baseCostUsd).toBeCloseTo(expectedBase, 8);
      expect(quote.platformCostUsd).toBe(expectedPlatform);
    });

    it('should compute platformCostLamports correctly for image-text', async () => {
      const quote = await getQuote({ category: 'image-text' });

      expect(quote.platformCostLamports).toBe(toUsdc6Lamports(quote.platformCostUsd));
    });

    it('should include both fal.ai and anthropic in models breakdown', async () => {
      const quote = await getQuote({ category: 'image-text' });

      const providers = quote.models.map((m) => m.provider);
      expect(providers).toContain('fal.ai');
      expect(providers).toContain('anthropic');
      expect(quote.models).toHaveLength(2);
    });

    it('should use specified imageModel and textModel', async () => {
      await getQuote({
        category: 'image-text',
        imageModel: 'fal-ai/nano-banana-2',
        textModel: 'claude-haiku-4-5-20251001',
      });

      expect(mockGetFalModelPrice).toHaveBeenCalledWith('fal-ai/nano-banana-2');
    });
  });

  // -------------------------------------------------------------------------
  // Video
  // -------------------------------------------------------------------------

  describe("category: 'video'", () => {
    it('should multiply per-second price × duration × resolution multiplier', async () => {
      const quote = await getQuote({ category: 'video' });

      const expectedBase =
        MOCK_VIDEO_PRICE_PER_SEC * DEFAULT_VIDEO_DURATION_SEC * RESOLUTION_MULTIPLIER['720p'];
      const expectedPlatform = applyMarkup(expectedBase);

      expect(quote.category).toBe('video');
      expect(quote.baseCostUsd).toBeCloseTo(expectedBase, 8);
      expect(quote.platformCostUsd).toBe(expectedPlatform);
    });

    it('should apply 1080p resolution multiplier (1.4x)', async () => {
      const quoteHd = await getQuote({ category: 'video', videoResolution: '720p' });
      const quoteFhd = await getQuote({ category: 'video', videoResolution: '1080p' });

      expect(quoteFhd.baseCostUsd).toBeCloseTo(quoteHd.baseCostUsd * 1.4, 6);
    });

    it('should apply 4K resolution multiplier (2.0x)', async () => {
      const quoteHd = await getQuote({ category: 'video', videoResolution: '720p' });
      const quote4k = await getQuote({ category: 'video', videoResolution: '4K' });

      expect(quote4k.baseCostUsd).toBeCloseTo(quoteHd.baseCostUsd * 2.0, 6);
    });

    it('should scale cost linearly with duration', async () => {
      const quote5s = await getQuote({ category: 'video', videoDurationSec: 5 });
      const quote10s = await getQuote({ category: 'video', videoDurationSec: 10 });

      expect(quote10s.baseCostUsd).toBeCloseTo(quote5s.baseCostUsd * 2, 6);
    });

    it('should compute platformCostLamports correctly for video', async () => {
      const quote = await getQuote({ category: 'video' });

      expect(quote.platformCostLamports).toBe(toUsdc6Lamports(quote.platformCostUsd));
    });

    it('should call getFalModelPrice with the default video model', async () => {
      await getQuote({ category: 'video' });

      expect(mockGetFalModelPrice).toHaveBeenCalledWith('fal-ai/veo3/fast');
    });

    it('should include fal.ai in models breakdown for video', async () => {
      const quote = await getQuote({ category: 'video' });

      expect(quote.models[0].provider).toBe('fal.ai');
      expect(quote.models[0].unit).toBe('second');
    });
  });

  // -------------------------------------------------------------------------
  // Video + Text
  // -------------------------------------------------------------------------

  describe("category: 'video-text'", () => {
    it('should sum video + text costs for baseCostUsd', async () => {
      const quote = await getQuote({ category: 'video-text' });

      const videoCost =
        MOCK_VIDEO_PRICE_PER_SEC * DEFAULT_VIDEO_DURATION_SEC * RESOLUTION_MULTIPLIER['720p'];
      const textCost = textBaseCost();
      const expectedBase = videoCost + textCost;
      const expectedPlatform = applyMarkup(expectedBase);

      expect(quote.category).toBe('video-text');
      expect(quote.baseCostUsd).toBeCloseTo(expectedBase, 8);
      expect(quote.platformCostUsd).toBe(expectedPlatform);
    });

    it('should compute platformCostLamports correctly for video-text', async () => {
      const quote = await getQuote({ category: 'video-text' });

      expect(quote.platformCostLamports).toBe(toUsdc6Lamports(quote.platformCostUsd));
    });

    it('should include both fal.ai and anthropic in models breakdown for video-text', async () => {
      const quote = await getQuote({ category: 'video-text' });

      const providers = quote.models.map((m) => m.provider);
      expect(providers).toContain('fal.ai');
      expect(providers).toContain('anthropic');
      expect(quote.models).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // platformCostLamports invariant across all categories
  // -------------------------------------------------------------------------

  describe('platformCostLamports invariant', () => {
    const categories = ['text', 'image', 'image-text', 'video', 'video-text'] as const;

    for (const category of categories) {
      it(`should equal BigInt(Math.ceil(platformCostUsd * 1_000_000)) for '${category}'`, async () => {
        const quote = await getQuote({ category });
        const expected = BigInt(Math.ceil(quote.platformCostUsd * 1_000_000));
        expect(quote.platformCostLamports).toBe(expected);
      });
    }
  });

  // -------------------------------------------------------------------------
  // Markup invariant
  // -------------------------------------------------------------------------

  describe('markup invariant', () => {
    it('should always report markupPercent as 20', async () => {
      for (const category of ['text', 'image', 'image-text', 'video', 'video-text'] as const) {
        const quote = await getQuote({ category });
        expect(quote.markupPercent).toBe(20);
      }
    });

    it('platformCostUsd should always be >= baseCostUsd * 1.2', async () => {
      const quote = await getQuote({ category: 'image' });
      // Allow for floating point tolerance of 1 micro-dollar
      expect(quote.platformCostUsd).toBeGreaterThanOrEqual(
        quote.baseCostUsd * 1.2 - 0.000001
      );
    });
  });
});
