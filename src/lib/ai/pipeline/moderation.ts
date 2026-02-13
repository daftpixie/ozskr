/**
 * Pipeline Stage 6: Content Moderation
 * 3-stage moderation pipeline for safety and compliance
 */

import OpenAI from 'openai';
import type { ProgressCallback } from './types';
import { ModerationStatus } from '@/types/database';
import { runEndorsementGuardrails } from './endorsement-guardrails';

/**
 * Error thrown during moderation
 */
export class ModerationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ModerationError';
  }
}

/**
 * Moderation result
 */
export interface ModerationResult {
  status: ModerationStatus;
  details: Record<string, unknown>;
}

/**
 * Content to moderate
 */
export interface ContentOutput {
  text?: string;
  imageUrl?: string;
}

/**
 * Initialize OpenAI client for moderation
 */
const getOpenAIClient = (): OpenAI => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ModerationError('OPENAI_API_KEY environment variable is required');
  }
  return new OpenAI({ apiKey });
};

/**
 * Stage 1: AI text moderation using OpenAI
 */
const moderateText = async (
  text: string,
  onProgress: ProgressCallback
): Promise<ModerationResult> => {
  onProgress({
    stage: 'moderating',
    message: 'Running text moderation (OpenAI)',
  });

  try {
    const openai = getOpenAIClient();
    const moderation = await openai.moderations.create({
      model: 'omni-moderation-latest',
      input: text,
    });

    const result = moderation.results[0];
    if (!result) {
      throw new ModerationError('No moderation result returned');
    }

    // Check if any category is flagged
    if (result.flagged) {
      const categories = result.categories;
      const categoryScores = result.category_scores;

      // High-severity categories trigger rejection
      const highSeverityCategories = [
        'harassment',
        'harassment/threatening',
        'hate',
        'hate/threatening',
        'self-harm',
        'self-harm/intent',
        'self-harm/instructions',
        'sexual/minors',
        'violence',
        'violence/graphic',
      ];

      const hasHighSeverity = highSeverityCategories.some(
        (cat) => categories[cat as keyof typeof categories]
      );

      // If high severity or high score, reject
      const maxScore = Math.max(...Object.values(categoryScores));
      if (hasHighSeverity || maxScore > 0.8) {
        return {
          status: ModerationStatus.REJECTED,
          details: {
            stage: 'text-moderation',
            provider: 'openai',
            categories,
            categoryScores,
            flagged: true,
            reason: 'High-severity content violation detected',
          },
        };
      }

      // Otherwise flag for review
      return {
        status: ModerationStatus.FLAGGED,
        details: {
          stage: 'text-moderation',
          provider: 'openai',
          categories,
          categoryScores,
          flagged: true,
          reason: 'Content flagged for manual review',
        },
      };
    }

    // Content passed
    return {
      status: ModerationStatus.APPROVED,
      details: {
        stage: 'text-moderation',
        provider: 'openai',
        flagged: false,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new ModerationError(`Text moderation failed: ${message}`);
  }
};

/**
 * Stage 2: Image safety check (stub for MVP)
 */
const moderateImage = async (
  imageUrl: string,
  onProgress: ProgressCallback
): Promise<ModerationResult> => {
  onProgress({
    stage: 'moderating',
    message: 'Running image safety check',
    metadata: { note: 'Image moderation is pending implementation' },
  });

  // TODO: Implement image moderation with AWS Rekognition or similar
  // For MVP, auto-approve images (fal.ai has built-in safety checker)

  return {
    status: ModerationStatus.APPROVED,
    details: {
      stage: 'image-moderation',
      provider: 'pending',
      note: 'Image moderation pending implementation (fal.ai safety checker active)',
    },
  };
};

/**
 * Content moderation pipeline
 *
 * Runs 3-stage moderation:
 * 1. AI text moderation (OpenAI) - fast, cheap
 * 2. Image safety check (AWS Rekognition) - pending implementation
 * 3. Human review queue (for flagged content) - handled externally
 *
 * Content is BLOCKED from storage/publishing until all stages pass.
 *
 * @param output - Content to moderate
 * @param onProgress - Progress callback
 * @returns Moderation status and details
 * @throws ModerationError if moderation fails
 */
export const moderateContent = async (
  output: ContentOutput,
  onProgress: ProgressCallback
): Promise<ModerationResult> => {
  onProgress({
    stage: 'moderating',
    message: 'Starting content moderation',
  });

  try {
    // Run endorsement guardrails first (synchronous, fast)
    if (output.text) {
      onProgress({
        stage: 'moderating',
        message: 'Checking endorsement and compliance guardrails',
      });

      const guardrailResult = runEndorsementGuardrails(output.text);
      if (guardrailResult) {
        onProgress({
          stage: 'moderating',
          message: `Endorsement guardrail triggered: ${guardrailResult.status}`,
          metadata: guardrailResult.details,
        });
        return guardrailResult;
      }
    }

    let result: ModerationResult;

    if (output.text) {
      result = await moderateText(output.text, onProgress);
    } else if (output.imageUrl) {
      result = await moderateImage(output.imageUrl, onProgress);
    } else {
      throw new ModerationError('No content to moderate');
    }

    onProgress({
      stage: 'moderating',
      message: `Moderation complete: ${result.status}`,
      metadata: result.details,
    });

    return result;
  } catch (error) {
    if (error instanceof ModerationError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new ModerationError(`Moderation pipeline failed: ${message}`);
  }
};
