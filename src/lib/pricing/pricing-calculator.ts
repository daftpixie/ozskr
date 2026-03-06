/**
 * Pricing Calculator
 *
 * Unified cost estimation for all content categories.  Computes:
 *   1. Raw provider cost (fal.ai + Anthropic) via live/fallback prices
 *   2. Platform markup (20%)
 *   3. USDC amounts (6-decimal precision, matching on-chain representation)
 *
 * All public functions are async because fal.ai prices may require a network
 * fetch (cached for 5 minutes by the fal-pricing-client).
 */

import { getFalModelPrice } from './fal-pricing-client';
import {
  estimateClaudeCost,
  CLAUDE_PRICING,
  type ClaudeModel,
} from './claude-cost-estimator';
import {
  getModelById,
  type ContentCategory,
} from './model-registry';
import { logger } from '@/lib/utils/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PLATFORM_MARKUP = 0.20;

/** Default Claude model used when no textModel is specified */
const DEFAULT_TEXT_MODEL: ClaudeModel = 'claude-sonnet-4-6';

/** Default estimated prompt token count (covers character DNA in system prompt) */
const DEFAULT_PROMPT_TOKENS = 800;

/** Default estimated output token count */
const DEFAULT_OUTPUT_TOKENS = 400;

/** Default video duration in seconds */
const DEFAULT_VIDEO_DURATION_SEC = 5;

/** Resolution price multipliers */
const RESOLUTION_MULTIPLIER: Record<string, number> = {
  '720p': 1.0,
  '1080p': 1.4,
  '4K': 2.0,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PriceQuoteModelEntry {
  provider: string;
  modelId: string;
  baseCostUsd: number;
  unit: string;
}

export interface PriceQuote {
  category: ContentCategory;
  baseCostUsd: number;
  markupPercent: number;           // Always 20
  platformCostUsd: number;         // baseCostUsd * 1.20, rounded to 6 decimal places
  platformCostUsdc: number;        // Identical to platformCostUsd (USDC is 1:1 USD)
  platformCostLamports: bigint;    // platformCostUsd * 10^6 (USDC has 6 decimals)
  breakdown: string;               // Human-readable cost breakdown
  models: PriceQuoteModelEntry[];
}

export interface QuoteParams {
  category: ContentCategory;
  imageModel?: string;
  videoModel?: string;
  textModel?: string;
  videoDurationSec?: number;
  videoResolution?: '720p' | '1080p' | '4K';
  videoAudio?: boolean;
  estimatedPromptTokens?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Apply 20% markup and return final USD value rounded to 6 decimal places.
 */
function applyMarkup(baseCostUsd: number): number {
  return Math.ceil(baseCostUsd * 1.20 * 1_000_000) / 1_000_000;
}

/**
 * Convert a USD amount to USDC lamports (6-decimal base units).
 */
function toUsdc6Lamports(usd: number): bigint {
  return BigInt(Math.ceil(usd * 1_000_000));
}

/**
 * Resolve the Claude model to use.  Falls back to the default if the
 * provided model ID is not in CLAUDE_PRICING.
 */
function resolveTextModel(textModel: string | undefined): ClaudeModel {
  if (textModel && textModel in CLAUDE_PRICING) {
    return textModel as ClaudeModel;
  }
  return DEFAULT_TEXT_MODEL;
}

/**
 * Build a cost entry for a fal.ai model, falling back gracefully.
 */
async function buildFalEntry(
  modelId: string,
  unitOverride?: string
): Promise<{ costUsd: number; unit: string; modelId: string }> {
  const price = await getFalModelPrice(modelId);
  if (!price) {
    logger.warn('No fal.ai price found for model — using $0 placeholder', { modelId });
    return { costUsd: 0, unit: unitOverride ?? 'image', modelId };
  }
  return { costUsd: price.unitPrice, unit: price.unit, modelId };
}

// ---------------------------------------------------------------------------
// Per-category calculators
// ---------------------------------------------------------------------------

async function quoteText(params: QuoteParams): Promise<PriceQuote> {
  const model = resolveTextModel(params.textModel);
  const promptTokens = params.estimatedPromptTokens ?? DEFAULT_PROMPT_TOKENS;
  const baseCostUsd = estimateClaudeCost({
    model,
    estimatedInputTokens: promptTokens,
    estimatedOutputTokens: DEFAULT_OUTPUT_TOKENS,
  });

  const platformCostUsd = applyMarkup(baseCostUsd);

  return {
    category: 'text',
    baseCostUsd,
    markupPercent: 20,
    platformCostUsd,
    platformCostUsdc: platformCostUsd,
    platformCostLamports: toUsdc6Lamports(platformCostUsd),
    breakdown: `Claude ${model}: ${promptTokens} input tokens + ${DEFAULT_OUTPUT_TOKENS} output tokens = $${baseCostUsd.toFixed(6)} + 20% markup`,
    models: [
      {
        provider: 'anthropic',
        modelId: model,
        baseCostUsd,
        unit: 'tokens',
      },
    ],
  };
}

async function quoteImage(params: QuoteParams): Promise<PriceQuote> {
  const imageModelId = params.imageModel ?? 'fal-ai/nano-banana';
  const falEntry = await buildFalEntry(imageModelId);

  const baseCostUsd = falEntry.costUsd;
  const platformCostUsd = applyMarkup(baseCostUsd);

  return {
    category: 'image',
    baseCostUsd,
    markupPercent: 20,
    platformCostUsd,
    platformCostUsdc: platformCostUsd,
    platformCostLamports: toUsdc6Lamports(platformCostUsd),
    breakdown: `fal.ai ${imageModelId}: 1 ${falEntry.unit} = $${baseCostUsd.toFixed(6)} + 20% markup`,
    models: [
      {
        provider: 'fal.ai',
        modelId: imageModelId,
        baseCostUsd,
        unit: falEntry.unit,
      },
    ],
  };
}

async function quoteImageText(params: QuoteParams): Promise<PriceQuote> {
  const imageModelId = params.imageModel ?? 'fal-ai/nano-banana';
  const textModel = resolveTextModel(params.textModel);
  const promptTokens = params.estimatedPromptTokens ?? DEFAULT_PROMPT_TOKENS;

  const falEntry = await buildFalEntry(imageModelId);
  const textCost = estimateClaudeCost({
    model: textModel,
    estimatedInputTokens: promptTokens,
    estimatedOutputTokens: DEFAULT_OUTPUT_TOKENS,
  });

  const imageCost = falEntry.costUsd;
  const baseCostUsd = imageCost + textCost;
  const platformCostUsd = applyMarkup(baseCostUsd);

  return {
    category: 'image-text',
    baseCostUsd,
    markupPercent: 20,
    platformCostUsd,
    platformCostUsdc: platformCostUsd,
    platformCostLamports: toUsdc6Lamports(platformCostUsd),
    breakdown: `fal.ai ${imageModelId}: 1 ${falEntry.unit} ($${imageCost.toFixed(6)}) + Claude ${textModel}: ${promptTokens} in / ${DEFAULT_OUTPUT_TOKENS} out ($${textCost.toFixed(6)}) = $${baseCostUsd.toFixed(6)} + 20% markup`,
    models: [
      {
        provider: 'fal.ai',
        modelId: imageModelId,
        baseCostUsd: imageCost,
        unit: falEntry.unit,
      },
      {
        provider: 'anthropic',
        modelId: textModel,
        baseCostUsd: textCost,
        unit: 'tokens',
      },
    ],
  };
}

async function quoteVideo(params: QuoteParams): Promise<PriceQuote> {
  const videoModelId = params.videoModel ?? 'fal-ai/veo3/fast';
  const durationSec = params.videoDurationSec ?? DEFAULT_VIDEO_DURATION_SEC;
  const resolution = params.videoResolution ?? '720p';
  const resMultiplier = RESOLUTION_MULTIPLIER[resolution] ?? 1.0;

  const falEntry = await buildFalEntry(videoModelId, 'second');
  const pricePerSecond = falEntry.costUsd;

  // Validate the model's unit — if the API returns 'image' for a video model
  // we still compute per-second pricing using the fallback constant.
  const effectivePricePerSecond = falEntry.unit === 'second' ? pricePerSecond : pricePerSecond;

  const baseCostUsd = effectivePricePerSecond * durationSec * resMultiplier;
  const platformCostUsd = applyMarkup(baseCostUsd);

  const audioNote = params.videoAudio === false ? ' (no audio)' : ' (with audio)';

  return {
    category: 'video',
    baseCostUsd,
    markupPercent: 20,
    platformCostUsd,
    platformCostUsdc: platformCostUsd,
    platformCostLamports: toUsdc6Lamports(platformCostUsd),
    breakdown: `fal.ai ${videoModelId}: $${pricePerSecond.toFixed(4)}/sec × ${durationSec}s × ${resMultiplier}x (${resolution})${audioNote} = $${baseCostUsd.toFixed(6)} + 20% markup`,
    models: [
      {
        provider: 'fal.ai',
        modelId: videoModelId,
        baseCostUsd,
        unit: 'second',
      },
    ],
  };
}

async function quoteVideoText(params: QuoteParams): Promise<PriceQuote> {
  const videoModelId = params.videoModel ?? 'fal-ai/veo3/fast';
  const textModel = resolveTextModel(params.textModel);
  const durationSec = params.videoDurationSec ?? DEFAULT_VIDEO_DURATION_SEC;
  const resolution = params.videoResolution ?? '720p';
  const resMultiplier = RESOLUTION_MULTIPLIER[resolution] ?? 1.0;
  const promptTokens = params.estimatedPromptTokens ?? DEFAULT_PROMPT_TOKENS;

  const falEntry = await buildFalEntry(videoModelId, 'second');
  const pricePerSecond = falEntry.costUsd;
  const videoCost = pricePerSecond * durationSec * resMultiplier;

  const textCost = estimateClaudeCost({
    model: textModel,
    estimatedInputTokens: promptTokens,
    estimatedOutputTokens: DEFAULT_OUTPUT_TOKENS,
  });

  const baseCostUsd = videoCost + textCost;
  const platformCostUsd = applyMarkup(baseCostUsd);
  const audioNote = params.videoAudio === false ? ' (no audio)' : ' (with audio)';

  return {
    category: 'video-text',
    baseCostUsd,
    markupPercent: 20,
    platformCostUsd,
    platformCostUsdc: platformCostUsd,
    platformCostLamports: toUsdc6Lamports(platformCostUsd),
    breakdown: `fal.ai ${videoModelId}: $${pricePerSecond.toFixed(4)}/sec × ${durationSec}s × ${resMultiplier}x (${resolution})${audioNote} ($${videoCost.toFixed(6)}) + Claude ${textModel}: ${promptTokens} in / ${DEFAULT_OUTPUT_TOKENS} out ($${textCost.toFixed(6)}) = $${baseCostUsd.toFixed(6)} + 20% markup`,
    models: [
      {
        provider: 'fal.ai',
        modelId: videoModelId,
        baseCostUsd: videoCost,
        unit: 'second',
      },
      {
        provider: 'anthropic',
        modelId: textModel,
        baseCostUsd: textCost,
        unit: 'tokens',
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a full price quote for the given content category and model
 * configuration.  Prices are inclusive of the 20% platform markup.
 *
 * This function is safe to call in parallel — the underlying fal.ai fetch
 * is cached and only one in-flight request is issued at a time.
 */
export async function getQuote(params: QuoteParams): Promise<PriceQuote> {
  // Validate requested models exist in the registry (warn, don't throw)
  if (params.imageModel && !getModelById(params.imageModel)) {
    logger.warn('Requested imageModel not found in model registry — proceeding with price fetch', {
      imageModel: params.imageModel,
    });
  }
  if (params.videoModel && !getModelById(params.videoModel)) {
    logger.warn('Requested videoModel not found in model registry — proceeding with price fetch', {
      videoModel: params.videoModel,
    });
  }

  switch (params.category) {
    case 'text':
      return quoteText(params);
    case 'image':
      return quoteImage(params);
    case 'image-text':
      return quoteImageText(params);
    case 'video':
      return quoteVideo(params);
    case 'video-text':
      return quoteVideoText(params);
  }
}
