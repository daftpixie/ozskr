/**
 * Cost Tracker Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('@/lib/api/supabase', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  trackAiInferenceCost,
  trackFalCost,
  trackSocialPublishCost,
  trackContentGeneration,
  trackSwapExecution,
} from './cost-tracker';

describe('Cost Tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  describe('trackAiInferenceCost', () => {
    it('should calculate and store Claude API costs', async () => {
      await trackAiInferenceCost({
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(mockFrom).toHaveBeenCalledWith('platform_metrics');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metric_type: 'ai_inference_cost',
          metadata: expect.objectContaining({
            model: 'claude-sonnet-4-5-20250929',
            inputTokens: 1000,
            outputTokens: 500,
            cached: false,
          }),
        })
      );

      // Verify cost calculation: (1000/1M)*3.0 + (500/1M)*15.0 = 0.003 + 0.0075 = 0.0105
      const insertedValue = mockInsert.mock.calls[0][0].value;
      expect(insertedValue).toBeCloseTo(0.0105, 4);
    });

    it('should apply cache discount', async () => {
      await trackAiInferenceCost({
        model: 'claude-sonnet-4-5-20250929',
        inputTokens: 1000,
        outputTokens: 500,
        cached: true,
      });

      // Cached: (1000/1M)*3.0*0.1 + (500/1M)*15.0 = 0.0003 + 0.0075 = 0.0078
      const insertedValue = mockInsert.mock.calls[0][0].value;
      expect(insertedValue).toBeCloseTo(0.0078, 4);
    });
  });

  describe('trackFalCost', () => {
    it('should store fal.ai generation cost', async () => {
      await trackFalCost({ model: 'flux-pro', estimatedCost: 0.05 });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metric_type: 'ai_inference_cost',
          value: 0.05,
          metadata: { provider: 'fal.ai', model: 'flux-pro' },
        })
      );
    });
  });

  describe('trackSocialPublishCost', () => {
    it('should store Ayrshare publish cost', async () => {
      await trackSocialPublishCost({
        provider: 'ayrshare',
        platforms: ['twitter', 'linkedin'],
        estimatedCost: 0.02,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metric_type: 'social_publish_cost',
          value: 0.02,
          metadata: {
            provider: 'ayrshare',
            platforms: ['twitter', 'linkedin'],
            platformCount: 2,
          },
        })
      );
    });

    it('should store zero cost for twitter-direct', async () => {
      await trackSocialPublishCost({
        provider: 'twitter-direct',
        platforms: ['twitter'],
        estimatedCost: 0,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metric_type: 'social_publish_cost',
          value: 0,
          metadata: expect.objectContaining({ provider: 'twitter-direct' }),
        })
      );
    });
  });

  describe('trackContentGeneration', () => {
    it('should store content generation event', async () => {
      await trackContentGeneration({
        characterId: 'char-123',
        contentType: 'tweet',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metric_type: 'content_generation',
          value: 1,
          metadata: { characterId: 'char-123', contentType: 'tweet' },
        })
      );
    });
  });

  describe('trackSwapExecution', () => {
    it('should store swap execution event', async () => {
      await trackSwapExecution({
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amountLamports: '1000000000',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          metric_type: 'swap_executed',
          value: 1,
        })
      );
    });
  });

  describe('graceful degradation', () => {
    it('should not throw when service role key is missing', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      await expect(
        trackAiInferenceCost({ model: 'test', inputTokens: 100, outputTokens: 50 })
      ).resolves.toBeUndefined();
    });
  });
});
