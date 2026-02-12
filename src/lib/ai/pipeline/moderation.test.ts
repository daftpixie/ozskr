/**
 * Pipeline Stage 6: Content Moderation Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModerationStatus } from '@/types/database';

// Hoisted mock references
const { mockModerationsCreate } = vi.hoisted(() => ({
  mockModerationsCreate: vi.fn(),
}));

// Module mock
vi.mock('openai', () => ({
  default: vi.fn(function () {
    return {
      moderations: { create: mockModerationsCreate },
    };
  }),
}));

import { moderateContent, ModerationError } from './moderation';
import { createMockProgressCallback } from '@/test/mocks/ai';

describe('Pipeline Stage 6: Content Moderation', () => {
  const { callback: onProgress, calls: progressCalls } = createMockProgressCallback();

  beforeEach(() => {
    progressCalls.length = 0;
    process.env.OPENAI_API_KEY = 'mock-openai-key';
  });

  it('should return approved status for clean text', async () => {
    mockModerationsCreate.mockResolvedValueOnce({
      results: [{
        flagged: false,
        categories: { harassment: false, hate: false, violence: false },
        category_scores: { harassment: 0.01, hate: 0.01, violence: 0.01 },
      }],
    });

    const result = await moderateContent(
      { text: 'This is a friendly tweet about Solana' },
      onProgress
    );

    expect(result.status).toBe(ModerationStatus.APPROVED);
    expect(result.details.flagged).toBe(false);
  });

  it('should return flagged status for moderate violations', async () => {
    mockModerationsCreate.mockResolvedValueOnce({
      results: [{
        flagged: true,
        categories: { harassment: false, hate: false, violence: false, sexual: true },
        category_scores: { harassment: 0.1, hate: 0.1, violence: 0.1, sexual: 0.65 },
      }],
    });

    const result = await moderateContent(
      { text: 'Moderately inappropriate content' },
      onProgress
    );

    expect(result.status).toBe(ModerationStatus.FLAGGED);
    expect(result.details.reason).toContain('manual review');
  });

  it('should return rejected status for high severity violations', async () => {
    mockModerationsCreate.mockResolvedValueOnce({
      results: [{
        flagged: true,
        categories: { harassment: true, 'harassment/threatening': true, hate: false, violence: false },
        category_scores: { harassment: 0.95, 'harassment/threatening': 0.90, hate: 0.1, violence: 0.1 },
      }],
    });

    const result = await moderateContent(
      { text: 'Highly toxic content' },
      onProgress
    );

    expect(result.status).toBe(ModerationStatus.REJECTED);
    expect(result.details.reason).toContain('High-severity');
  });

  it('should return approved status for image content (stub)', async () => {
    const result = await moderateContent(
      { imageUrl: 'https://example.com/image.png' },
      onProgress
    );

    expect(result.status).toBe(ModerationStatus.APPROVED);
    expect(result.details.note).toContain('pending implementation');
  });

  it('should emit moderating progress events', async () => {
    mockModerationsCreate.mockResolvedValueOnce({
      results: [{ flagged: false, categories: {}, category_scores: {} }],
    });

    await moderateContent({ text: 'Clean content' }, onProgress);

    const moderatingStages = progressCalls.filter((p) => p.stage === 'moderating');
    expect(moderatingStages.length).toBeGreaterThanOrEqual(2);
    expect(moderatingStages.some((p) => p.message.includes('Starting'))).toBe(true);
    expect(moderatingStages.some((p) => p.message.includes('complete'))).toBe(true);
  });

  it('should throw ModerationError when no content provided', async () => {
    await expect(
      moderateContent({}, onProgress)
    ).rejects.toThrow(ModerationError);
  });
});
