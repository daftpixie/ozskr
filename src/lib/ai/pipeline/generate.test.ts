/**
 * Pipeline Stage 4: Generate Content Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GenerationType } from '@/types/database';

// Hoisted mock references
const { mockGenerateText, mockFalSubscribe, mockFalConfig } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockFalSubscribe: vi.fn(),
  mockFalConfig: vi.fn(),
}));

// Module mocks
vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

vi.mock('@fal-ai/serverless-client', () => ({
  subscribe: mockFalSubscribe,
  config: mockFalConfig,
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

import { generateContent, ContentGenerationError } from './generate';
import type { CharacterContext } from './context';
import { createMockCharacterDNA, createMockProgressCallback } from '@/test/mocks/ai';

describe('Pipeline Stage 4: Generate Content', () => {
  const { callback: onProgress, calls: progressCalls } = createMockProgressCallback();

  beforeEach(() => {
    progressCalls.length = 0;
    process.env.FAL_KEY = 'mock-fal-key';

    mockGenerateText.mockResolvedValue({
      text: 'Generated text content',
      usage: { promptTokens: 100, completionTokens: 50 },
    });

    mockFalSubscribe.mockResolvedValue({
      images: [{ url: 'https://fal.ai/mock/image.png', width: 1024, height: 1024 }],
      seed: 12345,
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

  it('should generate text content using Claude', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'Generated tweet about Solana blockchain',
      usage: { promptTokens: 200, completionTokens: 100 },
    });

    const result = await generateContent(
      'Enhanced prompt',
      mockContext,
      GenerationType.TEXT,
      {},
      onProgress
    );

    expect(result.outputText).toBe('Generated tweet about Solana blockchain');
    expect(result.modelUsed).toContain('claude');
    expect(result.tokenUsage.input).toBe(200);
    expect(result.tokenUsage.output).toBe(100);
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('should generate image content using fal.ai', async () => {
    mockFalSubscribe.mockResolvedValueOnce({
      images: [{ url: 'https://fal.ai/generated/image123.png', width: 1024, height: 1024 }],
      seed: 54321,
    });

    const result = await generateContent(
      'Enhanced prompt',
      mockContext,
      GenerationType.IMAGE,
      { imageSize: 'square', guidanceScale: 3.5 },
      onProgress
    );

    expect(result.outputUrl).toBe('https://fal.ai/generated/image123.png');
    expect(result.modelUsed).toContain('fal');
    expect(result.tokenUsage).toEqual({ input: 0, output: 0, cached: 0 });
    expect(result.costUsd).toBe(0.05);
    expect(result.cacheHit).toBe(false);
  });

  it('should throw error for unsupported video generation', async () => {
    await expect(
      generateContent('Enhanced prompt', mockContext, GenerationType.VIDEO, {}, onProgress)
    ).rejects.toThrow(ContentGenerationError);
  });

  it('should emit generating progress events', async () => {
    await generateContent('Enhanced prompt', mockContext, GenerationType.TEXT, {}, onProgress);

    const generatingStages = progressCalls.filter((p) => p.stage === 'generating');
    expect(generatingStages.length).toBeGreaterThanOrEqual(1);
    expect(generatingStages[0]?.message).toContain('Generating');
  });

  it('should include visual style params in image generation', async () => {
    await generateContent('Enhanced prompt', mockContext, GenerationType.IMAGE, {}, onProgress);

    expect(mockFalSubscribe).toHaveBeenCalledWith(
      expect.stringContaining('fal'),
      expect.objectContaining({
        input: expect.objectContaining({
          prompt: expect.stringContaining('Minimalist, modern, tech-forward aesthetic'),
        }),
      })
    );
  });
});
