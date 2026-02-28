/**
 * Pipeline Stage 4: Generate Content
 * Routes to appropriate model (text/image/video) for content generation
 */

import { generateText } from 'ai';
import * as fal from '@fal-ai/serverless-client';
import type { CharacterContext } from './context';
import type { ProgressCallback, TokenUsage } from './types';
import type { GenerationType } from '@/types/database';
import { getPrimaryModel } from '@/lib/ai/mastra';
import { getModelConfig } from '@/lib/ai/models';
import { traceClaudeCall, createTrace, traceGeneration } from '@/lib/ai/telemetry';

/**
 * Error thrown during content generation
 */
export class ContentGenerationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ContentGenerationError';
  }
}

/**
 * Result from content generation
 */
export interface GenerationResult {
  outputText?: string;
  outputUrl?: string;
  modelUsed: string;
  tokenUsage: TokenUsage;
  costUsd: number;
  latencyMs: number;
  cacheHit: boolean;
}

/**
 * Configure fal.ai client
 */
const configureFal = () => {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    throw new ContentGenerationError('FAL_KEY environment variable is required');
  }
  fal.config({ credentials: falKey });
};

/**
 * Generate text content using Claude
 */
const generateTextContent = async (
  enhancedPrompt: string,
  context: CharacterContext,
  onProgress: ProgressCallback
): Promise<GenerationResult> => {
  onProgress({
    stage: 'generating',
    message: 'Generating text with Claude',
  });

  const startTime = Date.now();
  const model = getPrimaryModel();
  const config = getModelConfig('text-generation');
  const trace = createTrace('text-generation', {
    characterId: context.dna.id,
    characterName: context.dna.name,
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error('Text generation timed out after 60s')), 60_000);

    const result = await traceClaudeCall(trace, 'generate-text', async () => {
      try {
        return await generateText({
          model,
          system: context.dna.systemPrompt,
          prompt: enhancedPrompt,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          abortSignal: controller.signal,
        } as never);
      } finally {
        clearTimeout(timeoutId);
      }
    });

    const latencyMs = Date.now() - startTime;
    const outputText = result.text.trim();

    // AI SDK generateText() returns usage with promptTokens/completionTokens
    const usage = result.usage as { promptTokens?: number; completionTokens?: number };
    const tokenUsage: TokenUsage = {
      input: usage.promptTokens || 0,
      output: usage.completionTokens || 0,
      cached: 0,
    };

    // Heuristic: if prompt tokens are low despite long system prompt, likely cached
    const cacheHit = (usage.promptTokens || 0) < 500;

    // Claude Sonnet 4 pricing (approx): $3/MTok input, $15/MTok output
    const costUsd =
      (tokenUsage.input / 1_000_000) * 3.0 +
      (tokenUsage.output / 1_000_000) * 15.0;

    // Log to Langfuse
    await traceGeneration({
      trace,
      name: 'text-generation',
      model: config.modelId,
      input: enhancedPrompt,
      output: outputText,
      tokenUsage,
      latencyMs,
      cacheHit,
    });

    return {
      outputText,
      modelUsed: config.modelId,
      tokenUsage,
      costUsd,
      latencyMs,
      cacheHit,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new ContentGenerationError(`Text generation failed: ${message}`);
  }
};

/**
 * Generate image content using fal.ai
 */
const generateImageContent = async (
  enhancedPrompt: string,
  context: CharacterContext,
  modelParams: Record<string, unknown>,
  onProgress: ProgressCallback
): Promise<GenerationResult> => {
  onProgress({
    stage: 'generating',
    message: 'Generating image with fal.ai',
  });

  const startTime = Date.now();
  const config = getModelConfig('image-generation');

  try {
    configureFal();

    // Build nano-banana-2 request.
    // Parameters differ from FLUX: no guidance_scale/num_inference_steps/image_size.
    // Uses aspect_ratio + resolution instead. visualStyleParams may contain FLUX
    // overrides; only forward nano-banana-2 compatible fields.
    const allowedNanoBananaParams = new Set([
      'aspect_ratio', 'resolution', 'output_format', 'safety_tolerance',
      'seed', 'enable_web_search',
    ]);
    const visualOverrides = Object.fromEntries(
      Object.entries(context.dna.visualStyleParams ?? {}).filter(([k]) =>
        allowedNanoBananaParams.has(k)
      )
    );
    const falRequest = {
      prompt: `${enhancedPrompt}. ${context.dna.visualStyle}`,
      aspect_ratio: (modelParams.aspectRatio as string) || '1:1',
      resolution: (modelParams.resolution as string) || '1K',
      num_images: 1,
      output_format: 'png',
      safety_tolerance: '4',
      ...visualOverrides,
    };

    onProgress({
      stage: 'generating',
      message: 'Submitting to fal.ai',
      metadata: { model: config.modelId },
    });

    const result = await fal.subscribe(config.modelId, {
      input: falRequest,
      logs: false,
    });

    const latencyMs = Date.now() - startTime;

    // fal.ai subscribe() returns untyped result; narrow to expected nano-banana-2 response shape
    const response = result as { images?: Array<{ url: string }> };
    const outputUrl = response.images?.[0]?.url;

    if (!outputUrl) {
      throw new ContentGenerationError('No image URL in fal.ai response');
    }

    // fal.ai Nano Banana 2 pricing: $0.08 per image at 1K resolution
    const costUsd = 0.08;

    return {
      outputUrl,
      modelUsed: config.modelId,
      tokenUsage: { input: 0, output: 0, cached: 0 }, // Images don't use tokens
      costUsd,
      latencyMs,
      cacheHit: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new ContentGenerationError(`Image generation failed: ${message}`);
  }
};

/**
 * Generate content based on generation type
 *
 * @param enhancedPrompt - Enhanced prompt from stage 3
 * @param context - Character context
 * @param generationType - Type of content to generate
 * @param modelParams - Model-specific parameters
 * @param onProgress - Progress callback
 * @returns Generation result with output and metrics
 * @throws ContentGenerationError if generation fails
 */
export const generateContent = async (
  enhancedPrompt: string,
  context: CharacterContext,
  generationType: GenerationType,
  modelParams: Record<string, unknown>,
  onProgress: ProgressCallback
): Promise<GenerationResult> => {
  switch (generationType) {
    case 'text':
      return generateTextContent(enhancedPrompt, context, onProgress);

    case 'image':
      return generateImageContent(
        enhancedPrompt,
        context,
        modelParams,
        onProgress
      );

    case 'video':
      throw new ContentGenerationError(
        'Video generation not yet supported'
      );

    default:
      throw new ContentGenerationError(
        `Unknown generation type: ${generationType}`
      );
  }
};
