/**
 * Pipeline Stage 7: Store & Notify Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModerationStatus } from '@/types/database';

// Hoisted mock references
const { mockFrom, mockRpc, mockMemSearch, mockMemAdd, mockMemDelete } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockMemSearch: vi.fn(),
  mockMemAdd: vi.fn(),
  mockMemDelete: vi.fn(),
}));

// Module mocks
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

import { storeAndNotify } from './store';
import type { CharacterContext } from './context';
import type { PipelineResult } from './types';
import { createMockCharacterDNA, createMockProgressCallback } from '@/test/mocks/ai';

describe('Pipeline Stage 7: Store & Notify', () => {
  const { callback: onProgress, calls: progressCalls } = createMockProgressCallback();

  beforeEach(() => {
    progressCalls.length = 0;
    process.env.MEM0_API_KEY = 'mock-mem0-key';

    // Default: Supabase operations succeed
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    }));
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockMemAdd.mockResolvedValue({ id: 'mem-123' });
  });

  const mockContext: CharacterContext = {
    dna: createMockCharacterDNA(),
    memories: [],
    sessionContext: {
      generationType: 'text',
      timestamp: new Date().toISOString(),
    },
  };

  const mockResult: Partial<PipelineResult> = {
    generationId: '123e4567-e89b-12d3-a456-426614174000',
    outputText: 'Generated content',
    enhancedPrompt: 'Enhanced prompt',
    qualityScore: 0.85,
    moderationStatus: ModerationStatus.APPROVED,
    tokenUsage: { input: 200, output: 100, cached: 0 },
    costUsd: 0.005,
    latencyMs: 2500,
    cacheHit: false,
    modelUsed: 'claude-sonnet-4-20250514',
  };

  it('should update content_generations record in Supabase', async () => {
    await storeAndNotify(
      mockResult.generationId!,
      mockResult,
      mockContext,
      'mock-jwt-token',
      onProgress
    );

    expect(mockFrom).toHaveBeenCalledWith('content_generations');
  });

  it('should update character generation_count', async () => {
    await storeAndNotify(
      mockResult.generationId!,
      mockResult,
      mockContext,
      'mock-jwt-token',
      onProgress
    );

    expect(mockRpc).toHaveBeenCalled();
  });

  it('should store memory in Mem0', async () => {
    await storeAndNotify(
      mockResult.generationId!,
      mockResult,
      mockContext,
      'mock-jwt-token',
      onProgress
    );

    expect(mockMemAdd).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('Generated text content'),
        }),
      ]),
      expect.objectContaining({
        user_id: mockContext.dna.mem0Namespace,
      })
    );
  });

  it('should emit storing progress events', async () => {
    await storeAndNotify(
      mockResult.generationId!,
      mockResult,
      mockContext,
      'mock-jwt-token',
      onProgress
    );

    const storingStages = progressCalls.filter((p) => p.stage === 'storing');
    expect(storingStages.length).toBeGreaterThanOrEqual(3);

    expect(storingStages.some((p) => p.message.includes('Updating generation record'))).toBe(true);
    expect(storingStages.some((p) => p.message.includes('Updating character stats'))).toBe(true);
    expect(storingStages.some((p) => p.message.includes('Storing generation context in Mem0'))).toBe(true);
  });

  it('should emit complete progress event at the end', async () => {
    await storeAndNotify(
      mockResult.generationId!,
      mockResult,
      mockContext,
      'mock-jwt-token',
      onProgress
    );

    const completeStage = progressCalls.find((p) => p.stage === 'complete');
    expect(completeStage).toBeDefined();
    expect(completeStage?.message).toContain('complete');
  });

  it('should continue if Mem0 storage fails (non-critical)', async () => {
    mockMemAdd.mockRejectedValueOnce(new Error('Mem0 API error'));

    await expect(
      storeAndNotify(
        mockResult.generationId!,
        mockResult,
        mockContext,
        'mock-jwt-token',
        onProgress
      )
    ).resolves.not.toThrow();

    expect(progressCalls.some((p) => p.message.includes('non-critical'))).toBe(true);
  });
});
