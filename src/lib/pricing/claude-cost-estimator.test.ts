/**
 * Tests for Claude Cost Estimator
 *
 * Verifies: token-based cost math, cacheHitRatio variants, and both model keys.
 */

import { describe, it, expect } from 'vitest';
import { estimateClaudeCost, CLAUDE_PRICING } from './claude-cost-estimator';
import type { ClaudeModel } from './claude-cost-estimator';

// ---------------------------------------------------------------------------
// Helper: compute expected cost independently for cross-checking
// ---------------------------------------------------------------------------

function computeExpected(
  model: ClaudeModel,
  inputTokens: number,
  outputTokens: number,
  cacheHitRatio: number
): number {
  const pricing = CLAUDE_PRICING[model];
  const cached = inputTokens * cacheHitRatio;
  const uncached = inputTokens * (1 - cacheHitRatio);
  const cost =
    (cached / 1_000_000) * pricing.cachedInputPerMillionTokens +
    (uncached / 1_000_000) * pricing.inputPerMillionTokens +
    (outputTokens / 1_000_000) * pricing.outputPerMillionTokens;
  return Math.round(cost * 1e8) / 1e8;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('estimateClaudeCost', () => {
  describe('with claude-sonnet-4-6', () => {
    const model: ClaudeModel = 'claude-sonnet-4-6';

    it('should produce expected cost with known token counts and default cacheHitRatio (0.7)', () => {
      const inputTokens = 1000;
      const outputTokens = 500;

      const result = estimateClaudeCost({
        model,
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: outputTokens,
      });

      const expected = computeExpected(model, inputTokens, outputTokens, 0.7);
      expect(result).toBe(expected);

      // Spot-check the arithmetic:
      // cached   = 700 tokens @ $0.30/M  = (700/1_000_000)*0.30 = 0.00021
      // uncached = 300 tokens @ $3.00/M  = (300/1_000_000)*3.00 = 0.0009
      // output   = 500 tokens @ $15.00/M = (500/1_000_000)*15.0 = 0.0075
      // total    = 0.00861 (rounded to 8dp)
      expect(result).toBeCloseTo(0.00861, 8);
    });

    it('should use only uncached pricing when cacheHitRatio=0', () => {
      const inputTokens = 1_000_000;
      const outputTokens = 0;

      const result = estimateClaudeCost({
        model,
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: outputTokens,
        cacheHitRatio: 0,
      });

      // All 1M tokens uncached @ $3.00/M = $3.00
      expect(result).toBe(3.0);
    });

    it('should use only cached pricing when cacheHitRatio=1', () => {
      const inputTokens = 1_000_000;
      const outputTokens = 0;

      const result = estimateClaudeCost({
        model,
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: outputTokens,
        cacheHitRatio: 1,
      });

      // All 1M tokens cached @ $0.30/M = $0.30
      expect(result).toBe(0.3);
    });

    it('should split input tokens correctly with default cacheHitRatio=0.7', () => {
      const inputTokens = 10_000;
      const outputTokens = 2_000;

      const result = estimateClaudeCost({
        model,
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: outputTokens,
      });

      const expected = computeExpected(model, inputTokens, outputTokens, 0.7);
      expect(result).toBe(expected);
    });

    it('should return a non-negative cost for zero tokens', () => {
      const result = estimateClaudeCost({
        model,
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
      });
      expect(result).toBe(0);
    });

    it('should round result to 8 decimal places', () => {
      const result = estimateClaudeCost({
        model,
        estimatedInputTokens: 1,
        estimatedOutputTokens: 1,
        cacheHitRatio: 0.5,
      });

      const str = result.toString();
      const decimalPart = str.split('.')[1] ?? '';
      expect(decimalPart.length).toBeLessThanOrEqual(8);
    });
  });

  describe('with claude-haiku-4-5-20251001', () => {
    const model: ClaudeModel = 'claude-haiku-4-5-20251001';

    it('should produce expected cost with known token counts and cacheHitRatio=0', () => {
      const inputTokens = 1_000_000;
      const outputTokens = 1_000_000;

      const result = estimateClaudeCost({
        model,
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: outputTokens,
        cacheHitRatio: 0,
      });

      // input: 1M @ $0.80/M = $0.80
      // output: 1M @ $4.00/M = $4.00
      // total = $4.80
      expect(result).toBe(4.8);
    });

    it('should produce expected cost with cacheHitRatio=1', () => {
      const inputTokens = 1_000_000;
      const outputTokens = 0;

      const result = estimateClaudeCost({
        model,
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: outputTokens,
        cacheHitRatio: 1,
      });

      // 1M cached @ $0.08/M = $0.08
      expect(result).toBe(0.08);
    });

    it('should split correctly with default cacheHitRatio=0.7', () => {
      const inputTokens = 800;
      const outputTokens = 400;

      const result = estimateClaudeCost({
        model,
        estimatedInputTokens: inputTokens,
        estimatedOutputTokens: outputTokens,
      });

      const expected = computeExpected(model, inputTokens, outputTokens, 0.7);
      expect(result).toBe(expected);
    });

    it('should be cheaper than claude-sonnet-4-6 for the same inputs', () => {
      const params = {
        estimatedInputTokens: 1000,
        estimatedOutputTokens: 500,
        cacheHitRatio: 0 as const,
      };

      const sonnet = estimateClaudeCost({ model: 'claude-sonnet-4-6', ...params });
      const haiku = estimateClaudeCost({ model: 'claude-haiku-4-5-20251001', ...params });

      expect(haiku).toBeLessThan(sonnet);
    });
  });

  describe('edge cases', () => {
    it('should handle very large token counts without overflow', () => {
      const result = estimateClaudeCost({
        model: 'claude-sonnet-4-6',
        estimatedInputTokens: 100_000_000,
        estimatedOutputTokens: 50_000_000,
        cacheHitRatio: 0,
      });

      // input: 100M @ $3/M = $300
      // output: 50M @ $15/M = $750
      // total = $1050
      expect(result).toBe(1050);
    });

    it('should be deterministic — same inputs always produce same output', () => {
      const params = {
        model: 'claude-sonnet-4-6' as ClaudeModel,
        estimatedInputTokens: 1234,
        estimatedOutputTokens: 567,
        cacheHitRatio: 0.7,
      };

      const a = estimateClaudeCost(params);
      const b = estimateClaudeCost(params);
      expect(a).toBe(b);
    });
  });
});
