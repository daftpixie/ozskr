/**
 * Content Generation Pipeline Orchestrator
 * Coordinates all pipeline stages with retry logic and observability
 */

import type {
  PipelineInput,
  PipelineResult,
  ProgressCallback,
  TokenUsage,
} from './types';
import { parseAndValidate, ValidationError } from './parse';
import { loadCharacterContext, ContextLoadError } from './context';
import { enhancePrompt, PromptEnhanceError } from './enhance';
import { generateContent, ContentGenerationError } from './generate';
import { qualityCheck, QualityCheckError } from './quality';
import { moderateContent, ModerationError } from './moderation';
import { storeAndNotify, StorageError } from './store';
import { createTrace, getLangfuse } from '@/lib/ai/telemetry';
import { createAuthenticatedClient } from '@/lib/api/supabase';

/**
 * Pipeline execution error
 */
export class PipelineError extends Error {
  constructor(
    message: string,
    public stage: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'PipelineError';
  }
}

/**
 * Run the complete content generation pipeline
 *
 * Orchestrates all stages:
 * 1. Parse & validate input
 * 2. Load character context
 * 3. Enhance prompt
 * 4. Generate content (with quality retry loop, max 2 retries)
 * 5. Quality check
 * 6. Content moderation
 * 7. Store & notify
 *
 * @param input - Pipeline input with generation details
 * @param onProgress - Progress callback for real-time updates
 * @returns Pipeline result with all metrics
 * @throws PipelineError if any stage fails
 */
export const runPipeline = async (
  input: PipelineInput,
  onProgress: ProgressCallback
): Promise<PipelineResult> => {
  const pipelineStartTime = Date.now();
  createTrace('content-generation-pipeline', {
    generationId: input.generationId,
    characterId: input.characterId,
    generationType: input.generationType,
  });

  try {
    // Stage 1: Parse & Validate
    const validatedInput = await parseAndValidate(input, onProgress);

    // Stage 2: Load Character Context
    const context = await loadCharacterContext(validatedInput, onProgress);

    // Stage 3: Enhance Prompt
    const enhanceResult = await enhancePrompt(
      validatedInput.inputPrompt,
      context,
      onProgress
    );

    // Stage 4: Generate Content (with quality retry loop)
    let generationResult;
    let qualityResult;
    let attempts = 0;
    const maxAttempts = 3;

    do {
      attempts++;

      onProgress({
        stage: 'generating',
        message: `Generation attempt ${attempts}/${maxAttempts}`,
      });

      generationResult = await generateContent(
        enhanceResult.enhancedPrompt,
        context,
        validatedInput.generationType,
        validatedInput.modelParams || {},
        onProgress
      );

      // Stage 5: Quality Check
      qualityResult = await qualityCheck(
        {
          text: generationResult.outputText,
          imageUrl: generationResult.outputUrl,
        },
        context,
        onProgress
      );

      if (!qualityResult.shouldRetry || attempts >= maxAttempts) {
        break;
      }

      onProgress({
        stage: 'quality_check',
        message: `Quality below threshold (${qualityResult.qualityScore.toFixed(2)}), retrying...`,
      });
    } while (attempts < maxAttempts);

    // Stage 6: Content Moderation
    const moderationResult = await moderateContent(
      {
        text: generationResult.outputText,
        imageUrl: generationResult.outputUrl,
      },
      onProgress
    );

    // Aggregate token usage (enhancement + generation)
    const totalTokenUsage: TokenUsage = {
      input: enhanceResult.tokenUsage.input + generationResult.tokenUsage.input,
      output:
        enhanceResult.tokenUsage.output + generationResult.tokenUsage.output,
      cached:
        enhanceResult.tokenUsage.cached + generationResult.tokenUsage.cached,
    };

    // Calculate total cost (enhancement + generation)
    // Enhancement cost (approx): $3/MTok input, $15/MTok output
    const enhancementCost =
      (enhanceResult.tokenUsage.input / 1_000_000) * 3.0 +
      (enhanceResult.tokenUsage.output / 1_000_000) * 15.0;
    const totalCost = enhancementCost + generationResult.costUsd;

    // Total latency
    const totalLatency = Date.now() - pipelineStartTime;

    // Cache hit if enhancement was cached (most expensive part)
    const cacheHit = enhanceResult.cacheHit;

    // Build result
    const result: PipelineResult = {
      generationId: input.generationId,
      outputText: generationResult.outputText,
      outputUrl: generationResult.outputUrl,
      enhancedPrompt: enhanceResult.enhancedPrompt,
      qualityScore: qualityResult.qualityScore,
      moderationStatus: moderationResult.status,
      moderationDetails: moderationResult.details,
      tokenUsage: totalTokenUsage,
      costUsd: totalCost,
      latencyMs: totalLatency,
      cacheHit,
      modelUsed: generationResult.modelUsed,
    };

    // Stage 7: Store & Notify
    await storeAndNotify(
      input.generationId,
      result,
      context,
      input.jwtToken,
      onProgress
    );

    // Flush Langfuse telemetry
    await getLangfuse().flushAsync();

    return result;
  } catch (error) {
    // Determine which stage failed
    let stage = 'unknown';
    let message = 'Pipeline failed';

    if (error instanceof ValidationError) {
      stage = 'parsing';
      message = error.message;
    } else if (error instanceof ContextLoadError) {
      stage = 'loading_context';
      message = error.message;
    } else if (error instanceof PromptEnhanceError) {
      stage = 'enhancing';
      message = error.message;
    } else if (error instanceof ContentGenerationError) {
      stage = 'generating';
      message = error.message;
    } else if (error instanceof QualityCheckError) {
      stage = 'quality_check';
      message = error.message;
    } else if (error instanceof ModerationError) {
      stage = 'moderating';
      message = error.message;
    } else if (error instanceof StorageError) {
      stage = 'storing';
      message = error.message;
    } else if (error instanceof Error) {
      message = error.message;
    }

    // Emit error progress event
    onProgress({
      stage: 'error',
      message: `Pipeline failed at stage ${stage}: ${message}`,
      metadata: { stage, error: message },
    });

    // Update generation record with error
    try {
      const supabase = createAuthenticatedClient(input.jwtToken);
      await supabase
        .from('content_generations')
        .update({
          moderation_status: 'rejected',
          moderation_details: {
            error: message,
            stage,
            timestamp: new Date().toISOString(),
          },
        })
        .eq('id', input.generationId);
    } catch {
      // Ignore errors in error handling
    }

    // Flush Langfuse
    await getLangfuse().flushAsync();

    throw new PipelineError(message, stage, error);
  }
};

// Re-export all types and stage functions
export * from './types';
export { parseAndValidate, ValidationError } from './parse';
export { loadCharacterContext, ContextLoadError } from './context';
export type { CharacterContext } from './context';
export { enhancePrompt, PromptEnhanceError } from './enhance';
export type { EnhanceResult } from './enhance';
export { generateContent, ContentGenerationError } from './generate';
export type { GenerationResult } from './generate';
export { qualityCheck, QualityCheckError } from './quality';
export type { QualityResult, ContentOutput } from './quality';
export { moderateContent, ModerationError } from './moderation';
export type { ModerationResult } from './moderation';
export { storeAndNotify, StorageError } from './store';
export { runEndorsementGuardrails, checkInvestmentLanguage, checkEndorsementDisclosure } from './endorsement-guardrails';
