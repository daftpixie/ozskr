/**
 * Pipeline Stage 3: Enhance Prompt Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted mock references
const { mockGenerateText } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
}));

// Module mocks
vi.mock('ai', () => ({
  generateText: mockGenerateText,
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

import { enhancePrompt, PromptEnhanceError } from './enhance';
import type { CharacterContext } from './context';
import { createMockCharacterDNA, createMockProgressCallback } from '@/test/mocks/ai';

describe('Pipeline Stage 3: Enhance Prompt', () => {
  const { callback: onProgress, calls: progressCalls } = createMockProgressCallback();

  beforeEach(() => {
    progressCalls.length = 0;
    mockGenerateText.mockResolvedValue({
      text: 'Generated text content',
      usage: { promptTokens: 100, completionTokens: 50 },
    });
  });

  const mockContext: CharacterContext = {
    dna: createMockCharacterDNA(),
    memories: [],
    sessionContext: {
      generationType: 'text',
      timestamp: new Date().toISOString(),
    },
  };

  it('should successfully enhance prompt using Claude', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'Enhanced prompt with character voice',
      usage: { promptTokens: 150, completionTokens: 75 },
    });

    const result = await enhancePrompt('Create a tweet about Solana', mockContext, onProgress);

    expect(result.enhancedPrompt).toBe('Enhanced prompt with character voice');
    expect(result.tokenUsage.input).toBe(150);
    expect(result.tokenUsage.output).toBe(75);
    expect(result.cacheHit).toBe(true);
  });

  it('should return token usage and cache hit info', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'Enhanced content',
      usage: { promptTokens: 1000, completionTokens: 200 },
    });

    const result = await enhancePrompt('Test prompt', mockContext, onProgress);

    expect(result.tokenUsage).toEqual({
      input: 1000,
      output: 200,
      cached: 0,
    });
    expect(result.cacheHit).toBe(false);
  });

  it('should emit enhancing progress events', async () => {
    await enhancePrompt('Test prompt', mockContext, onProgress);

    const enhancingStages = progressCalls.filter((p) => p.stage === 'enhancing');
    expect(enhancingStages.length).toBeGreaterThanOrEqual(2);
    expect(enhancingStages.some((p) => p.message.includes('Enhancing prompt'))).toBe(true);
    expect(enhancingStages.some((p) => p.message.includes('complete'))).toBe(true);
  });

  it('should throw PromptEnhanceError when AI call fails', async () => {
    mockGenerateText.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    await expect(
      enhancePrompt('Test prompt', mockContext, onProgress)
    ).rejects.toThrow(PromptEnhanceError);
  });
});
