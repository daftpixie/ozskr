/**
 * Cost Tracker
 * Tracks AI inference and social publishing costs.
 * Stores metrics in Supabase platform_metrics table.
 */

import { logger } from '@/lib/utils/logger';
import { createSupabaseServerClient } from '@/lib/api/supabase';

type MetricType = 'ai_inference_cost' | 'social_publish_cost' | 'content_generation' | 'swap_executed' | 'user_signup';

interface MetricEntry {
  metric_type: MetricType;
  value: number;
  metadata: Record<string, unknown>;
}

async function insertMetric(entry: MetricEntry): Promise<void> {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      logger.warn('SUPABASE_SERVICE_ROLE_KEY not configured — skipping metric');
      return;
    }
    const supabase = createSupabaseServerClient(serviceRoleKey);
    const { error } = await supabase.from('platform_metrics').insert(entry);
    if (error) {
      logger.warn('Failed to insert metric', { error: error.message, type: entry.metric_type });
    }
  } catch (err) {
    logger.warn('Cost tracker error', { error: err instanceof Error ? err.message : 'Unknown' });
  }
}

/** Claude API pricing (per 1M tokens, as of 2026) */
const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
};

/**
 * Track an AI inference call (Claude API)
 */
export async function trackAiInferenceCost(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cached?: boolean;
}): Promise<void> {
  const pricing = CLAUDE_PRICING[params.model] ?? { input: 3.0, output: 15.0 };
  const cacheDiscount = params.cached ? 0.1 : 1.0; // 90% discount for cached prompts
  const cost =
    (params.inputTokens / 1_000_000) * pricing.input * cacheDiscount +
    (params.outputTokens / 1_000_000) * pricing.output;

  await insertMetric({
    metric_type: 'ai_inference_cost',
    value: cost,
    metadata: {
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      cached: params.cached ?? false,
    },
  });
}

/**
 * Track a fal.ai image/video generation call
 */
export async function trackFalCost(params: {
  model: string;
  estimatedCost: number;
}): Promise<void> {
  await insertMetric({
    metric_type: 'ai_inference_cost',
    value: params.estimatedCost,
    metadata: {
      provider: 'fal.ai',
      model: params.model,
    },
  });
}

/**
 * Track a social media publish action
 */
export async function trackSocialPublishCost(params: {
  provider: 'ayrshare' | 'twitter-direct';
  platforms: string[];
  estimatedCost: number;
}): Promise<void> {
  await insertMetric({
    metric_type: 'social_publish_cost',
    value: params.estimatedCost,
    metadata: {
      provider: params.provider,
      platforms: params.platforms,
      platformCount: params.platforms.length,
    },
  });
}

/**
 * Track a content generation event (count, not cost)
 */
export async function trackContentGeneration(params: {
  characterId: string;
  contentType: string;
}): Promise<void> {
  await insertMetric({
    metric_type: 'content_generation',
    value: 1,
    metadata: {
      characterId: params.characterId,
      contentType: params.contentType,
    },
  });
}

/**
 * Track a swap execution
 */
export async function trackSwapExecution(params: {
  inputMint: string;
  outputMint: string;
  amountLamports: string;
}): Promise<void> {
  await insertMetric({
    metric_type: 'swap_executed',
    value: 1,
    metadata: {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amountLamports: params.amountLamports,
    },
  });
}
