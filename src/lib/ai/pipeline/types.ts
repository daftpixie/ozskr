/**
 * Content Generation Pipeline Types
 * Type definitions for all pipeline stages
 */

import type { GenerationType, ModerationStatus } from '@/types/database';

/**
 * Pipeline stages for progress tracking
 */
export type PipelineStage =
  | 'parsing'
  | 'loading_context'
  | 'enhancing'
  | 'generating'
  | 'quality_check'
  | 'moderating'
  | 'storing'
  | 'complete'
  | 'error';

/**
 * Progress event emitted by pipeline stages
 */
export interface PipelineProgress {
  stage: PipelineStage;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Progress callback function for pipeline execution
 */
export type ProgressCallback = (progress: PipelineProgress) => void;

/**
 * Input for the content generation pipeline
 */
export interface PipelineInput {
  generationId: string;
  characterId: string;
  generationType: GenerationType;
  inputPrompt: string;
  modelParams?: Record<string, unknown>;
  jwtToken: string;
}

/**
 * Token usage tracking
 */
export interface TokenUsage {
  input: number;
  output: number;
  cached: number;
}

/**
 * Final result from the pipeline
 */
export interface PipelineResult {
  generationId: string;
  outputText?: string;
  outputUrl?: string;
  enhancedPrompt: string;
  qualityScore: number;
  moderationStatus: ModerationStatus;
  moderationDetails?: Record<string, unknown>;
  tokenUsage: TokenUsage;
  costUsd: number;
  latencyMs: number;
  cacheHit: boolean;
  modelUsed: string;
}

/**
 * Validated pipeline input after stage 1
 */
export interface ValidatedInput extends PipelineInput {
  _validated: true;
}
