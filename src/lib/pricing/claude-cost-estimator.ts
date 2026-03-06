/**
 * Claude Cost Estimator
 *
 * Token-based cost estimation for Anthropic Claude models.
 * Uses official per-million-token pricing with prompt-caching awareness.
 *
 * All prices are in USD.
 */

// ---------------------------------------------------------------------------
// Pricing table (USD per million tokens)
// ---------------------------------------------------------------------------

export const CLAUDE_PRICING = {
  'claude-sonnet-4-6': {
    inputPerMillionTokens: 3.00,
    outputPerMillionTokens: 15.00,
    cachedInputPerMillionTokens: 0.30,
  },
  'claude-haiku-4-5-20251001': {
    inputPerMillionTokens: 0.80,
    outputPerMillionTokens: 4.00,
    cachedInputPerMillionTokens: 0.08,
  },
} as const;

export type ClaudeModel = keyof typeof CLAUDE_PRICING;

// ---------------------------------------------------------------------------
// Estimator
// ---------------------------------------------------------------------------

/**
 * Estimate the USD cost of a Claude API call.
 *
 * @param params.model - The Claude model ID (must be a key of CLAUDE_PRICING)
 * @param params.estimatedInputTokens - Total input tokens in the request
 * @param params.estimatedOutputTokens - Expected output tokens in the response
 * @param params.cacheHitRatio - Fraction of input tokens served from cache.
 *   Default 0.7 (character DNA / system prompts are typically cached).
 *   Pass 0.0 for a no-cache worst-case estimate.
 * @returns Estimated cost in USD (rounded to 8 decimal places)
 */
export function estimateClaudeCost(params: {
  model: ClaudeModel;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  cacheHitRatio?: number;
}): number {
  const { model, estimatedInputTokens, estimatedOutputTokens, cacheHitRatio = 0.7 } = params;

  const pricing = CLAUDE_PRICING[model];

  // Split input tokens into cached vs. uncached
  const cachedTokens = estimatedInputTokens * cacheHitRatio;
  const uncachedTokens = estimatedInputTokens * (1 - cacheHitRatio);

  const cachedInputCost = (cachedTokens / 1_000_000) * pricing.cachedInputPerMillionTokens;
  const uncachedInputCost = (uncachedTokens / 1_000_000) * pricing.inputPerMillionTokens;
  const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.outputPerMillionTokens;

  const totalCost = cachedInputCost + uncachedInputCost + outputCost;

  // Round to 8 decimal places to avoid floating-point noise
  return Math.round(totalCost * 1e8) / 1e8;
}
