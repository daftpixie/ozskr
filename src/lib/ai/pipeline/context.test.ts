/**
 * Pipeline Stage 2: Load Character Context Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GenerationType } from '@/types/database';

// Hoisted mock references
const { mockFrom, mockMemSearch, mockMemAdd, mockMemDelete } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockMemSearch: vi.fn(),
  mockMemAdd: vi.fn(),
  mockMemDelete: vi.fn(),
}));

// Module mocks
vi.mock('@/lib/api/supabase', () => ({
  createAuthenticatedClient: vi.fn(() => ({
    from: mockFrom,
    rpc: vi.fn(),
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

import { loadCharacterContext, ContextLoadError } from './context';
import type { ValidatedInput } from './types';
import { createMockCharacterDNA, createMockProgressCallback } from '@/test/mocks/ai';

describe('Pipeline Stage 2: Load Character Context', () => {
  const { callback: onProgress, calls: progressCalls } = createMockProgressCallback();
  const mockCharacter = createMockCharacterDNA();

  beforeEach(() => {
    progressCalls.length = 0;
    process.env.MEM0_API_KEY = 'mock-mem0-key';

    // Default: character found in DB
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'characters') {
        return {
          select: vi.fn().mockReturnThis(),
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
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    // Default: Mem0 returns memories
    mockMemSearch.mockResolvedValue({
      results: [
        {
          id: 'mem-001',
          memory: 'Character prefers cyberpunk aesthetics',
          score: 0.92,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    });
  });

  const validInput: ValidatedInput = {
    generationId: '123e4567-e89b-12d3-a456-426614174000',
    characterId: '550e8400-e29b-41d4-a716-446655440000',
    generationType: GenerationType.TEXT,
    inputPrompt: 'Create a tweet about Solana',
    modelParams: {},
    jwtToken: 'mock-jwt-token',
    _validated: true,
  };

  it('should successfully load character DNA and memories', async () => {
    const context = await loadCharacterContext(validInput, onProgress);

    expect(context.dna).toBeDefined();
    expect(context.dna.name).toBe('TestBot');
    expect(context.memories).toBeDefined();
    expect(Array.isArray(context.memories)).toBe(true);
    expect(context.sessionContext.generationType).toBe('text');
    expect(context.sessionContext.timestamp).toBeDefined();
  });

  it('should throw ContextLoadError when character not found', async () => {
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'characters') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Character not found' },
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: {}, error: null }),
      };
    });

    await expect(loadCharacterContext(validInput, onProgress)).rejects.toThrow(
      ContextLoadError
    );
  });

  it('should return empty array when memory recall fails (non-critical)', async () => {
    mockMemSearch.mockRejectedValueOnce(new Error('Mem0 API timeout'));

    const context = await loadCharacterContext(validInput, onProgress);

    expect(context.memories).toEqual([]);
    expect(progressCalls.some((p) => p.message.includes('non-critical'))).toBe(true);
  });

  it('should emit loading_context progress events', async () => {
    await loadCharacterContext(validInput, onProgress);

    const contextStages = progressCalls.filter((p) => p.stage === 'loading_context');
    expect(contextStages.length).toBeGreaterThanOrEqual(3);

    expect(contextStages.some((p) => p.message.includes('Loading character DNA'))).toBe(true);
    expect(contextStages.some((p) => p.message.includes('Recalling relevant memories'))).toBe(true);
    expect(contextStages.some((p) => p.message.includes('Character context loaded'))).toBe(true);
  });
});
