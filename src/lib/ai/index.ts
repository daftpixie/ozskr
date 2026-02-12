/**
 * AI Infrastructure Barrel Export
 * Core AI agent infrastructure for ozskr.ai
 */

// Mastra agent framework
export { mastra, getPrimaryModel, getFallbackModel, getAgent } from './mastra';

// Mem0 memory layer
export { createAgentMemory } from './memory';
export type { AgentMemory, MemoryResult } from './memory';

// Character DNA loader
export { loadCharacterDNA, CharacterNotFoundError } from './character-dna';
export type { CharacterDNA } from './character-dna';

// Langfuse telemetry
export {
  getLangfuse,
  createTrace,
  createSpan,
  traceGeneration,
  traceClaudeCall,
} from './telemetry';
export type { TokenUsage } from './telemetry';

// Model registry
export { MODEL_REGISTRY, getModelConfig, getAvailablePurposes, isPurposeRegistered } from './models';
export type { ModelConfig, ModelProvider } from './models';

// Content generation pipeline
export {
  runPipeline,
  parseAndValidate,
  loadCharacterContext,
  enhancePrompt,
  generateContent,
  qualityCheck,
  moderateContent,
  storeAndNotify,
  ValidationError,
  ContextLoadError,
  PromptEnhanceError,
  ContentGenerationError,
  QualityCheckError,
  ModerationError,
  StorageError,
  PipelineError,
} from './pipeline';
export type {
  PipelineInput,
  PipelineResult,
  PipelineProgress,
  PipelineStage,
  ProgressCallback,
  ValidatedInput,
  CharacterContext,
  EnhanceResult,
  GenerationResult,
  QualityResult,
  ContentOutput,
  ModerationResult,
} from './pipeline';
