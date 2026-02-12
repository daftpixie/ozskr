/**
 * Pipeline Stage 5: Quality Check Tests
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

import { qualityCheck, QualityCheckError } from './quality';
import type { CharacterContext } from './context';
import { createMockCharacterDNA, createMockProgressCallback } from '@/test/mocks/ai';

describe('Pipeline Stage 5: Quality Check', () => {
  const { callback: onProgress, calls: progressCalls } = createMockProgressCallback();

  beforeEach(() => {
    progressCalls.length = 0;
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({ score: 0.75, reasoning: 'Good quality' }),
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

  it('should return shouldRetry: false for high quality score (>= 0.6)', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: JSON.stringify({
        score: 0.85,
        reasoning: 'Excellent persona consistency and engagement',
      }),
    });

    const result = await qualityCheck(
      { text: 'High quality generated content' },
      mockContext,
      onProgress
    );

    expect(result.qualityScore).toBe(0.85);
    expect(result.shouldRetry).toBe(false);
  });

  it('should return shouldRetry: true for low quality score (< 0.6)', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: JSON.stringify({
        score: 0.45,
        reasoning: 'Below threshold for persona consistency',
      }),
    });

    const result = await qualityCheck(
      { text: 'Low quality content' },
      mockContext,
      onProgress
    );

    expect(result.qualityScore).toBe(0.45);
    expect(result.shouldRetry).toBe(true);
  });

  it('should return default score (0.8) for image content', async () => {
    const result = await qualityCheck(
      { imageUrl: 'https://example.com/image.png' },
      mockContext,
      onProgress
    );

    expect(result.qualityScore).toBe(0.8);
    expect(result.shouldRetry).toBe(false);
  });

  it('should emit quality_check progress events', async () => {
    await qualityCheck({ text: 'Test content' }, mockContext, onProgress);

    const qualityStages = progressCalls.filter((p) => p.stage === 'quality_check');
    expect(qualityStages.length).toBeGreaterThanOrEqual(2);
    expect(qualityStages.some((p) => p.message.includes('Evaluating'))).toBe(true);
    expect(qualityStages.some((p) => p.message.includes('passed'))).toBe(true);
  });

  it('should throw QualityCheckError when no content provided', async () => {
    await expect(
      qualityCheck({}, mockContext, onProgress)
    ).rejects.toThrow(QualityCheckError);
  });

  it('should default to 0.7 score when JSON parsing fails', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'Not valid JSON',
    });

    const result = await qualityCheck(
      { text: 'Some content' },
      mockContext,
      onProgress
    );

    expect(result.qualityScore).toBe(0.7);
    expect(result.shouldRetry).toBe(false);
  });
});
