/**
 * Content Generation Pipeline Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GenerationType, ModerationStatus } from '@/types/database';

// Hoisted mock references
const {
  mockGenerateText,
  mockFrom,
  mockRpc,
  mockMemSearch,
  mockMemAdd,
  mockMemDelete,
  mockModerationsCreate,
} = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockMemSearch: vi.fn(),
  mockMemAdd: vi.fn(),
  mockMemDelete: vi.fn(),
  mockModerationsCreate: vi.fn(),
}));

// Module mocks
vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

vi.mock('@/lib/api/supabase', () => ({
  createAuthenticatedClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
  createSupabaseClient: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}));

vi.mock('mem0ai', () => ({
  MemoryClient: vi.fn(function () {
    return {
      search: mockMemSearch,
      add: mockMemAdd,
      delete: mockMemDelete,
    };
  }),
}));

vi.mock('openai', () => ({
  default: vi.fn(function () {
    return {
      moderations: { create: mockModerationsCreate },
    };
  }),
}));

vi.mock('@/lib/ai/mastra', () => ({
  getPrimaryModel: vi.fn(() => 'anthropic:claude-sonnet-4-20250514'),
}));

vi.mock('@/lib/ai/telemetry', () => ({
  traceClaudeCall: vi.fn(
    async (_trace: unknown, _name: string, fn: () => Promise<unknown>) => fn()
  ),
  createTrace: vi.fn(() => ({ update: vi.fn() })),
  traceGeneration: vi.fn(),
  getLangfuse: vi.fn(() => ({
    trace: vi.fn(),
    flushAsync: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { runPipeline, PipelineError } from './index';
import type { PipelineInput } from './types';
import { createMockCharacterDNA, createMockProgressCallback } from '@/test/mocks/ai';

describe('Content Generation Pipeline Integration', () => {
  const { callback: onProgress, calls: progressCalls } = createMockProgressCallback();
  const mockCharacter = createMockCharacterDNA();

  beforeEach(() => {
    progressCalls.length = 0;
    process.env.OPENAI_API_KEY = 'mock-openai-key';
    process.env.MEM0_API_KEY = 'mock-mem0-key';

    // Default Supabase mock: generation record exists, character exists
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'content_generations') {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              character_id: '550e8400-e29b-41d4-a716-446655440000',
            },
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
            data: {
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
            },
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

    mockRpc.mockResolvedValue({ data: null, error: null });

    // Mem0 defaults
    mockMemSearch.mockResolvedValue({ results: [] });
    mockMemAdd.mockResolvedValue({ id: 'mem-123' });

    // OpenAI moderation default: approved
    mockModerationsCreate.mockResolvedValue({
      results: [{ flagged: false, categories: {}, category_scores: {} }],
    });
  });

  const validInput: PipelineInput = {
    generationId: '123e4567-e89b-12d3-a456-426614174000',
    characterId: '550e8400-e29b-41d4-a716-446655440000',
    generationType: GenerationType.TEXT,
    inputPrompt: 'Create a tweet about Solana',
    modelParams: { temperature: 0.8 },
    jwtToken: 'mock-jwt-token',
  };

  it('should complete full happy path through all stages', async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        text: 'Enhanced prompt with character voice',
        usage: { promptTokens: 150, completionTokens: 75 },
      })
      .mockResolvedValueOnce({
        text: 'Generated tweet about Solana blockchain',
        usage: { promptTokens: 200, completionTokens: 100 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ score: 0.85, reasoning: 'Excellent quality' }),
        usage: { promptTokens: 100, completionTokens: 50 },
      });

    const result = await runPipeline(validInput, onProgress);

    expect(result.generationId).toBe(validInput.generationId);
    expect(result.outputText).toBe('Generated tweet about Solana blockchain');
    expect(result.enhancedPrompt).toBe('Enhanced prompt with character voice');
    expect(result.qualityScore).toBe(0.85);
    expect(result.moderationStatus).toBe(ModerationStatus.APPROVED);
    expect(result.tokenUsage.input).toBeGreaterThan(0);
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it('should retry on low quality score (max retries)', async () => {
    mockGenerateText
      // Enhancement
      .mockResolvedValueOnce({
        text: 'Enhanced prompt',
        usage: { promptTokens: 150, completionTokens: 75 },
      })
      // First generation (low quality)
      .mockResolvedValueOnce({
        text: 'Low quality content',
        usage: { promptTokens: 200, completionTokens: 50 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ score: 0.45, reasoning: 'Below threshold' }),
        usage: { promptTokens: 100, completionTokens: 30 },
      })
      // Second generation (still low)
      .mockResolvedValueOnce({
        text: 'Still low quality',
        usage: { promptTokens: 200, completionTokens: 50 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ score: 0.50, reasoning: 'Still below' }),
        usage: { promptTokens: 100, completionTokens: 30 },
      })
      // Third generation (acceptable)
      .mockResolvedValueOnce({
        text: 'Better quality content',
        usage: { promptTokens: 200, completionTokens: 60 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ score: 0.70, reasoning: 'Acceptable' }),
        usage: { promptTokens: 100, completionTokens: 30 },
      });

    const result = await runPipeline(validInput, onProgress);

    expect(result.outputText).toBe('Better quality content');
    expect(result.qualityScore).toBe(0.70);
    expect(progressCalls.some((p) => p.message.includes('attempt 2/3'))).toBe(true);
  });

  it('should update DB with error status when stage fails', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    await expect(runPipeline(validInput, onProgress)).rejects.toThrow(PipelineError);

    expect(mockFrom).toHaveBeenCalledWith('content_generations');
  });

  it('should emit progress events in correct order', async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        text: 'Enhanced',
        usage: { promptTokens: 150, completionTokens: 75 },
      })
      .mockResolvedValueOnce({
        text: 'Generated',
        usage: { promptTokens: 200, completionTokens: 100 },
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({ score: 0.75 }),
        usage: { promptTokens: 100, completionTokens: 50 },
      });

    await runPipeline(validInput, onProgress);

    const stages = progressCalls.map((p) => p.stage);

    const expectedOrder = [
      'parsing',
      'loading_context',
      'enhancing',
      'generating',
      'quality_check',
      'moderating',
      'storing',
      'complete',
    ];

    for (const expectedStage of expectedOrder) {
      expect(stages.some((s) => s === expectedStage)).toBe(true);
    }
  });

  it('should emit error progress event when pipeline fails', async () => {
    const invalidInput: PipelineInput = {
      ...validInput,
      generationId: 'not-a-uuid',
    };

    await expect(runPipeline(invalidInput, onProgress)).rejects.toThrow(PipelineError);

    const errorStage = progressCalls.find((p) => p.stage === 'error');
    expect(errorStage).toBeDefined();
    expect(errorStage?.message).toContain('failed');
  });
});
