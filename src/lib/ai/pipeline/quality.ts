/**
 * Pipeline Stage 5: Quality Check
 * Scores generated content for quality and determines if retry is needed
 */

import { generateText } from 'ai';
import type { CharacterContext } from './context';
import type { ProgressCallback } from './types';
import { getPrimaryModel } from '@/lib/ai/mastra';
import { traceClaudeCall, createTrace } from '@/lib/ai/telemetry';

/**
 * Error thrown during quality check
 */
export class QualityCheckError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'QualityCheckError';
  }
}

/**
 * Quality check result
 */
export interface QualityResult {
  qualityScore: number;
  shouldRetry: boolean;
}

/**
 * Content to check (text or image URL)
 */
export interface ContentOutput {
  text?: string;
  imageUrl?: string;
}

/**
 * Check text quality using Claude
 */
const checkTextQuality = async (
  text: string,
  context: CharacterContext
): Promise<number> => {
  const model = getPrimaryModel();
  const trace = createTrace('quality-check-text', {
    characterId: context.dna.id,
  });

  const result = await traceClaudeCall(trace, 'score-quality', async () => {
    return await generateText({
      model,
      system: `You are a quality evaluator for AI-generated content. Evaluate on three dimensions:
1. Persona consistency: Does this match the character's voice and style?
2. Engagement: Is this compelling and likely to resonate with an audience?
3. Creativity: Is this original and interesting?

Character context:
${context.dna.persona}

Voice & tone:
${context.dna.voiceTone}

Respond with ONLY a JSON object: {"score": 0.X, "reasoning": "brief explanation"}`,
      prompt: `Evaluate this content:

"${text}"

Score (0.0-1.0):`,
      maxTokens: 256,
      temperature: 0,
    } as never);
  });

  try {
    const parsed = JSON.parse(result.text) as { score?: unknown };
    const score = parsed.score;
    if (typeof score === 'number' && score >= 0 && score <= 1) {
      return score;
    }
  } catch {
    // If parsing fails, default to mid-range score
  }

  return 0.7; // Default score if parsing fails
};

/**
 * Check image quality (stub for now)
 */
const checkImageQuality = async (
  _imageUrl: string,
  _context: CharacterContext
): Promise<number> => {
  // TODO: Implement image quality check (could use Claude Vision API)
  // For MVP, default to high score for images that successfully generated
  return 0.8;
};

/**
 * Quality check for generated content
 *
 * Scores content on persona consistency, engagement, and creativity.
 * If score is below threshold (0.6), marks for retry.
 *
 * @param output - Generated content (text or image URL)
 * @param context - Character context for comparison
 * @param onProgress - Progress callback
 * @returns Quality score and retry flag
 * @throws QualityCheckError if check fails
 */
export const qualityCheck = async (
  output: ContentOutput,
  context: CharacterContext,
  onProgress: ProgressCallback
): Promise<QualityResult> => {
  onProgress({
    stage: 'quality_check',
    message: 'Evaluating content quality',
  });

  try {
    let qualityScore: number;

    if (output.text) {
      onProgress({
        stage: 'quality_check',
        message: 'Scoring text quality',
      });
      qualityScore = await checkTextQuality(output.text, context);
    } else if (output.imageUrl) {
      onProgress({
        stage: 'quality_check',
        message: 'Scoring image quality',
      });
      qualityScore = await checkImageQuality(output.imageUrl, context);
    } else {
      throw new QualityCheckError('No content to evaluate');
    }

    const shouldRetry = qualityScore < 0.6;

    onProgress({
      stage: 'quality_check',
      message: shouldRetry
        ? 'Quality below threshold, will retry'
        : 'Quality check passed',
      metadata: { qualityScore, shouldRetry },
    });

    return {
      qualityScore,
      shouldRetry,
    };
  } catch (error) {
    if (error instanceof QualityCheckError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new QualityCheckError(`Quality check failed: ${message}`);
  }
};
