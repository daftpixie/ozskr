/**
 * AI Infrastructure Barrel Export
 * Core AI agent infrastructure for ozskr.ai
 */

// Mastra agent framework
export { mastra, getPrimaryModel, getFallbackModel, getAgent } from './mastra';

// Mastra-native runtime agent memory (replaces Mem0 for production agents)
// NOTE: Mem0 dev workflow memory lives in tools/mem0-mcp/ and is unaffected.
export { createAgentMemory, DEFAULT_WORKING_MEMORY_TEMPLATE } from './memory';
export type { AgentMemory } from './memory';

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
