/**
 * Model Registry & Configuration
 * Centralized model routing for different generation types
 */

/**
 * AI provider types
 */
export type ModelProvider = 'anthropic' | 'fal' | 'openai';

/**
 * Model configuration for a specific purpose
 */
export interface ModelConfig {
  modelId: string;
  provider: ModelProvider;
  purpose: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Model registry mapping purposes to model configurations
 *
 * This centralizes all model selection logic. In the future, this can be
 * extended with LiteLLM or other routing layers when we scale to 10+ models.
 */
export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  'text-generation': {
    modelId: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    purpose: 'Character text/tweet/thread generation',
    maxTokens: 4096,
    temperature: 0.8,
  },
  'text-enhancement': {
    modelId: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    purpose: 'Prompt enhancement and expansion',
    maxTokens: 1024,
    temperature: 0.3,
  },
  'image-generation': {
    modelId: 'fal-ai/flux-lora',
    provider: 'fal',
    purpose: 'Character visual content generation',
  },
  'moderation': {
    modelId: 'gpt-4o-mini',
    provider: 'openai',
    purpose: 'Content safety and moderation scoring',
    maxTokens: 256,
    temperature: 0,
  },
  'fallback': {
    modelId: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    purpose: 'Fallback for rate-limited or failed primary requests',
    maxTokens: 2048,
    temperature: 0.7,
  },
};

/**
 * Get model configuration for a specific purpose
 *
 * @param purpose - Generation purpose key (e.g., 'text-generation', 'moderation')
 * @returns Model configuration
 * @throws Error if purpose not found in registry
 */
export const getModelConfig = (purpose: string): ModelConfig => {
  const config = MODEL_REGISTRY[purpose];

  if (!config) {
    throw new Error(
      `Model configuration not found for purpose: ${purpose}. Available: ${Object.keys(MODEL_REGISTRY).join(', ')}`
    );
  }

  return config;
};

/**
 * Get all available model purposes
 */
export const getAvailablePurposes = (): string[] => {
  return Object.keys(MODEL_REGISTRY);
};

/**
 * Check if a purpose is registered
 */
export const isPurposeRegistered = (purpose: string): boolean => {
  return purpose in MODEL_REGISTRY;
};
