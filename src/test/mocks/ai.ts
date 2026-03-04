/**
 * AI Service Mock Factories
 * Reusable mock factories for all AI services (Claude, fal.ai, OpenAI, Mem0, Langfuse)
 *
 * IMPORTANT: These factories do NOT set up vi.mock(). Test files must declare
 * their own top-level vi.mock() calls. Factories only create and return mock objects.
 */

import { vi } from 'vitest';
import type { CharacterDNA } from '@/lib/ai/character-dna';
import type { PipelineProgress } from '@/lib/ai/pipeline/types';

// =============================================================================
// VERCEL AI SDK MOCKS
// =============================================================================

export interface GenerateTextResult {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

/**
 * Create a mock generateText function with default response
 */
export const mockGenerateText = (response?: Partial<GenerateTextResult>) => {
  const defaultResult: GenerateTextResult = {
    text: 'Generated text content',
    usage: {
      promptTokens: 100,
      completionTokens: 50,
    },
  };

  return vi.fn().mockResolvedValue({
    ...defaultResult,
    ...response,
  });
};

// =============================================================================
// FAL.AI MOCKS
// =============================================================================

export interface FalResult {
  images?: Array<{ url: string; width?: number; height?: number }>;
  video?: { url: string };
  seed?: number;
}

// =============================================================================
// OPENAI MOCKS
// =============================================================================

export interface ModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: Record<string, number>;
}

// =============================================================================
// CHARACTER DNA MOCKS
// =============================================================================

/**
 * Create mock CharacterDNA
 */
export const createMockCharacterDNA = (
  overrides?: Partial<CharacterDNA>
): CharacterDNA => {
  const baseId = overrides?.id || '550e8400-e29b-41d4-a716-446655440000';

  const dna: CharacterDNA = {
    id: baseId,
    name: 'TestBot',
    persona: 'A test AI character with a friendly personality',
    visualStyle: 'Minimalist, modern, tech-forward aesthetic',
    voiceTone: 'Casual, friendly, slightly humorous',
    guardrails: Object.freeze([
      'Never discuss politics',
      'Never share personal information',
    ]),
    topicAffinity: Object.freeze([
      'Technology',
      'AI',
      'Web3',
      'Solana',
    ]),
    mem0Namespace: `char_${baseId}`,
    visualStyleParams: {
      style: 'digital-art',
      colorPalette: ['#9945FF', '#14F195'],
      mood: 'energetic',
    },
    workingMemoryTemplate: null,
    systemPrompt: `You are TestBot.

PERSONA:
A test AI character with a friendly personality

VOICE & TONE:
Casual, friendly, slightly humorous

GUARDRAILS (Never violate these):
- Never discuss politics
- Never share personal information

TOPIC AFFINITY (Prefer these topics):
- Technology
- AI
- Web3
- Solana

When generating content:
1. Stay true to your persona and voice
2. Never violate your guardrails
3. Prefer topics you have affinity for
4. Be authentic and consistent with your character
5. Generate content that your audience will engage with

Remember: You are creating content as TestBot, not as an AI assistant.`,
    ...overrides,
  };

  return Object.freeze(dna);
};

/**
 * Create mock relevant memories (string array — Mastra recallRelevant format)
 */
export const createMockRelevantMemories = (count = 3): string[] => {
  return Array.from({ length: count }, (_, i) => `Memory content ${i + 1}`);
};

/**
 * Create mock working memory XML string
 */
export const createMockWorkingMemory = (): string => {
  return `<agent_working_memory>
  <audience_preferences>Prefers cyberpunk aesthetics and DeFi content</audience_preferences>
  <top_performing_content>No data yet</top_performing_content>
  <posting_patterns>No patterns detected</posting_patterns>
  <topic_resonance>No data yet</topic_resonance>
  <style_adaptations>Using default persona settings</style_adaptations>
</agent_working_memory>`;
};

// =============================================================================
// PIPELINE PROGRESS MOCKS
// =============================================================================

/**
 * Create mock progress callback with call tracking
 */
export const createMockProgressCallback = (): {
  callback: (progress: PipelineProgress) => void;
  calls: PipelineProgress[];
} => {
  const calls: PipelineProgress[] = [];

  const callback = vi.fn((progress: PipelineProgress) => {
    calls.push(progress);
  });

  return { callback, calls };
};

// =============================================================================
// SUPABASE CONTENT GENERATIONS MOCKS
// =============================================================================

/**
 * Create mock Supabase client with content_generations table data.
 * Test files must set up vi.mock('@/lib/api/supabase') at the top level
 * and wire the returned mockClient to the mocked createAuthenticatedClient.
 */
export const mockSupabaseWithGenerations = () => {
  const mockGeneration = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    character_id: '550e8400-e29b-41d4-a716-446655440000',
    generation_type: 'text' as const,
    input_prompt: 'Test prompt',
    enhanced_prompt: null,
    model_used: 'claude-sonnet-4-20250514',
    model_params: {},
    output_url: null,
    output_text: null,
    quality_score: null,
    moderation_status: 'pending' as const,
    moderation_details: null,
    token_usage: { input: 0, output: 0, cached: 0 },
    cost_usd: null,
    latency_ms: null,
    cache_hit: false,
    created_at: new Date().toISOString(),
  };

  const mockCharacter = createMockCharacterDNA();

  const mockCharacterData = {
    id: mockCharacter.id,
    name: mockCharacter.name,
    persona: mockCharacter.persona,
    visual_style: mockCharacter.visualStyle,
    voice_tone: mockCharacter.voiceTone,
    guardrails: [...mockCharacter.guardrails],
    topic_affinity: [...mockCharacter.topicAffinity],
    mem0_namespace: mockCharacter.mem0Namespace,
    visual_style_params: mockCharacter.visualStyleParams,
    status: 'active',
    social_accounts: {},
    generation_count: 0,
    last_generated_at: null,
    wallet_address: '11111111111111111111111111111111',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const from = vi.fn().mockImplementation((tableName: string) => {
    if (tableName === 'content_generations') {
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockGeneration,
          error: null,
        }),
      };
    }
    if (tableName === 'characters') {
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockCharacterData,
          error: null,
        }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });

  // Loose type allows test overrides without type errors
  const mockClient = { from, rpc } as {
    from: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
  };

  return { mockClient, mockGeneration, mockCharacter };
};
