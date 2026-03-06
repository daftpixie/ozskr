/**
 * Model Registry
 *
 * Static registry of all AI models available on the ozskr.ai platform.
 * Used by the pricing calculator and the services API to enumerate
 * which models are available for each content category.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContentCategory = 'text' | 'image' | 'image-text' | 'video' | 'video-text';

export interface ModelDefinition {
  id: string;
  name: string;
  provider: 'fal.ai' | 'anthropic';
  categories: ContentCategory[];
  description: string;
  capabilities: string[];
  tier: 'standard' | 'pro';
  defaultConfig?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const MODEL_REGISTRY: ModelDefinition[] = [
  // -------------------------------------------------------------------------
  // TEXT MODELS (Anthropic)
  // -------------------------------------------------------------------------
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    categories: ['text', 'image-text', 'video-text'],
    description: 'Frontier intelligence for content creation.',
    capabilities: ['text-generation', 'prompt-caching'],
    tier: 'standard',
  },
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    categories: ['text', 'image-text', 'video-text'],
    description: 'Ultra-fast text generation for high-volume content.',
    capabilities: ['text-generation', 'prompt-caching'],
    tier: 'standard',
  },

  // -------------------------------------------------------------------------
  // IMAGE MODELS (fal.ai)
  // -------------------------------------------------------------------------
  {
    id: 'fal-ai/nano-banana',
    name: 'Nano Banana',
    provider: 'fal.ai',
    categories: ['image', 'image-text'],
    description: 'Fast image generation.',
    capabilities: ['text-to-image'],
    tier: 'standard',
  },
  {
    id: 'fal-ai/nano-banana-2',
    name: 'Nano Banana 2',
    provider: 'fal.ai',
    categories: ['image', 'image-text'],
    description:
      'Reasoning-guided generation — vibrant output, accurate text rendering, character consistency.',
    capabilities: ['text-to-image', 'web-search-grounding', 'text-rendering'],
    tier: 'pro',
  },
  {
    id: 'fal-ai/nano-banana-pro',
    name: 'Nano Banana Pro',
    provider: 'fal.ai',
    categories: ['image', 'image-text'],
    description: 'Maximum quality — deepest reasoning, complex multi-step edits.',
    capabilities: ['text-to-image', 'web-search-grounding', 'text-rendering'],
    tier: 'pro',
  },

  // -------------------------------------------------------------------------
  // VIDEO MODELS (fal.ai)
  // -------------------------------------------------------------------------
  {
    id: 'fal-ai/veo3/fast',
    name: 'Veo 3 Fast',
    provider: 'fal.ai',
    categories: ['video', 'video-text'],
    description: 'Faster, cost-effective Veo 3 for rapid iteration.',
    capabilities: ['text-to-video', 'audio-generation'],
    tier: 'standard',
    defaultConfig: { duration: '5s', resolution: '720p', generate_audio: true },
  },
  {
    id: 'fal-ai/veo3',
    name: 'Veo 3',
    provider: 'fal.ai',
    categories: ['video', 'video-text'],
    description: 'High-quality video with synchronized audio.',
    capabilities: ['text-to-video', 'audio-generation', 'lip-sync'],
    tier: 'pro',
    defaultConfig: { duration: '5s', resolution: '720p', generate_audio: true },
  },
  {
    id: 'fal-ai/veo3.1/fast',
    name: 'Veo 3.1 Fast',
    provider: 'fal.ai',
    categories: ['video', 'video-text'],
    description: 'Fastest Veo — ideal for social content.',
    capabilities: ['text-to-video', 'image-to-video', 'audio-generation'],
    tier: 'standard',
    defaultConfig: { duration: '5s', resolution: '720p', generate_audio: true },
  },
  {
    id: 'fal-ai/veo3.1',
    name: 'Veo 3.1',
    provider: 'fal.ai',
    categories: ['video', 'video-text'],
    description:
      'Most advanced — cinema-quality video with native audio and lip sync.',
    capabilities: ['text-to-video', 'image-to-video', 'audio-generation', 'lip-sync'],
    tier: 'pro',
    defaultConfig: { duration: '5s', resolution: '1080p', generate_audio: true },
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Return all models that support the given content category.
 */
export function getModelsForCategory(category: ContentCategory): ModelDefinition[] {
  return MODEL_REGISTRY.filter((m) => m.categories.includes(category));
}

/**
 * Look up a model by its ID.  Returns undefined if not found.
 */
export function getModelById(id: string): ModelDefinition | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}
