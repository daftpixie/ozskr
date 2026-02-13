/**
 * Twitter API v2 Client Tests
 * Tests tweet posting, deletion, and metrics
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted mock for rate limiter
const { mockRateLimitedFetch } = vi.hoisted(() => ({
  mockRateLimitedFetch: vi.fn(),
}));

vi.mock('./rate-limiter', () => ({
  rateLimitedFetch: mockRateLimitedFetch,
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { postTweet, deleteTweet, getTweetMetrics, TwitterApiError } from './client';

describe('twitter/client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('postTweet', () => {
    it('should post a text-only tweet', async () => {
      mockRateLimitedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { id: '1234567890', text: 'Hello world' },
        }),
      });

      const result = await postTweet('Hello world', 'access-token');

      expect(result.tweetId).toBe('1234567890');
      expect(result.text).toBe('Hello world');
      expect(result.url).toBe('https://twitter.com/i/status/1234567890');

      // Verify request
      const call = mockRateLimitedFetch.mock.calls[0];
      expect(call[0]).toBe('https://api.twitter.com/2/tweets');
      const body = JSON.parse(call[1].body);
      expect(body.text).toBe('Hello world');
      expect(body.media).toBeUndefined();
    });

    it('should include media IDs when provided', async () => {
      mockRateLimitedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { id: '1234567890', text: 'Photo tweet' },
        }),
      });

      await postTweet('Photo tweet', 'access-token', ['media-id-1', 'media-id-2']);

      const body = JSON.parse(mockRateLimitedFetch.mock.calls[0][1].body);
      expect(body.media).toEqual({ media_ids: ['media-id-1', 'media-id-2'] });
    });

    it('should throw TwitterApiError on failure', async () => {
      mockRateLimitedFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Duplicate tweet',
      });

      await expect(
        postTweet('Duplicate', 'access-token')
      ).rejects.toThrow(TwitterApiError);
    });

    it('should throw on invalid response schema', async () => {
      mockRateLimitedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ invalid: true }),
      });

      await expect(
        postTweet('Test', 'access-token')
      ).rejects.toThrow(TwitterApiError);
    });

    it('should set Authorization bearer header', async () => {
      mockRateLimitedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { id: '123', text: 'Test' },
        }),
      });

      await postTweet('Test', 'my-token-123');

      const headers = mockRateLimitedFetch.mock.calls[0][1].headers;
      expect(headers.get('Authorization')).toBe('Bearer my-token-123');
    });
  });

  describe('deleteTweet', () => {
    it('should delete a tweet', async () => {
      mockRateLimitedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { deleted: true } }),
      });

      await deleteTweet('1234567890', 'access-token');

      const call = mockRateLimitedFetch.mock.calls[0];
      expect(call[0]).toBe('https://api.twitter.com/2/tweets/1234567890');
      expect(call[1].method).toBe('DELETE');
    });

    it('should throw TwitterApiError on failure', async () => {
      mockRateLimitedFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Tweet not found',
      });

      await expect(
        deleteTweet('nonexistent', 'access-token')
      ).rejects.toThrow(TwitterApiError);
    });
  });

  describe('getTweetMetrics', () => {
    it('should fetch and normalize tweet metrics', async () => {
      mockRateLimitedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: '123',
            public_metrics: {
              retweet_count: 10,
              reply_count: 5,
              like_count: 100,
              quote_count: 3,
              bookmark_count: 7,
              impression_count: 5000,
            },
          },
        }),
      });

      const metrics = await getTweetMetrics('123', 'access-token');

      expect(metrics.likes).toBe(100);
      expect(metrics.retweets).toBe(10);
      expect(metrics.replies).toBe(5);
      expect(metrics.quotes).toBe(3);
      expect(metrics.impressions).toBe(5000);
    });

    it('should request tweet.fields=public_metrics', async () => {
      mockRateLimitedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: '123',
            public_metrics: {
              retweet_count: 0,
              reply_count: 0,
              like_count: 0,
              quote_count: 0,
            },
          },
        }),
      });

      await getTweetMetrics('123', 'access-token');

      const url = mockRateLimitedFetch.mock.calls[0][0];
      expect(url).toContain('tweet.fields=public_metrics');
    });

    it('should default missing metrics to 0', async () => {
      mockRateLimitedFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: '123',
            public_metrics: {
              retweet_count: 5,
              reply_count: 2,
              like_count: 50,
              quote_count: 1,
              // bookmark_count and impression_count missing
            },
          },
        }),
      });

      const metrics = await getTweetMetrics('123', 'access-token');

      expect(metrics.impressions).toBe(0);
    });

    it('should throw on API error', async () => {
      mockRateLimitedFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid token',
      });

      await expect(
        getTweetMetrics('123', 'bad-token')
      ).rejects.toThrow(TwitterApiError);
    });
  });
});
