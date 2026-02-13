/**
 * Twitter Adapter Tests
 * Tests the SocialPublisher implementation for direct Twitter/X API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SocialPlatform } from '@/types/database';
import { SocialProvider, PublisherError } from './types';

// Hoisted mocks
const { mockGetAccessToken, mockPostTweet, mockUploadMedia, mockDeleteTweet, mockGetTweetMetrics } =
  vi.hoisted(() => ({
    mockGetAccessToken: vi.fn(),
    mockPostTweet: vi.fn(),
    mockUploadMedia: vi.fn(),
    mockDeleteTweet: vi.fn(),
    mockGetTweetMetrics: vi.fn(),
  }));

vi.mock('./twitter/token-store', () => ({
  getAccessToken: mockGetAccessToken,
}));

vi.mock('./twitter/client', () => ({
  postTweet: mockPostTweet,
  uploadMedia: mockUploadMedia,
  deleteTweet: mockDeleteTweet,
  getTweetMetrics: mockGetTweetMetrics,
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { TwitterAdapter } from './twitter-adapter';

describe('TwitterAdapter', () => {
  let adapter: TwitterAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new TwitterAdapter();
    mockGetAccessToken.mockResolvedValue('valid-access-token');
  });

  it('should report provider as DIRECT', () => {
    expect(adapter.provider).toBe(SocialProvider.DIRECT);
  });

  describe('publish', () => {
    it('should post a text-only tweet via Twitter API', async () => {
      mockPostTweet.mockResolvedValue({
        tweetId: 'tw-123',
        text: 'Hello from ozskr',
        url: 'https://twitter.com/i/status/tw-123',
      });

      const result = await adapter.publish({
        text: 'Hello from ozskr',
        platforms: [SocialPlatform.TWITTER],
        profileKey: 'social-account-id-1',
      });

      expect(mockGetAccessToken).toHaveBeenCalledWith('social-account-id-1');
      expect(mockPostTweet).toHaveBeenCalledWith(
        'Hello from ozskr',
        'valid-access-token',
        undefined
      );

      expect(result).toEqual({
        provider: SocialProvider.DIRECT,
        externalId: 'tw-123',
        platformPostIds: { twitter: 'tw-123' },
        platformPostUrls: { twitter: 'https://twitter.com/i/status/tw-123' },
        costUsd: 0,
      });
    });

    it('should upload media before posting tweet', async () => {
      mockUploadMedia.mockResolvedValue('media-id-1');
      mockPostTweet.mockResolvedValue({
        tweetId: 'tw-456',
        text: 'Image tweet',
        url: 'https://twitter.com/i/status/tw-456',
      });

      const result = await adapter.publish({
        text: 'Image tweet',
        platforms: [SocialPlatform.TWITTER],
        mediaUrls: ['https://cdn.example.com/image.jpg'],
        profileKey: 'social-account-id-1',
      });

      expect(mockUploadMedia).toHaveBeenCalledWith(
        'https://cdn.example.com/image.jpg',
        'valid-access-token'
      );
      expect(mockPostTweet).toHaveBeenCalledWith(
        'Image tweet',
        'valid-access-token',
        ['media-id-1']
      );
      expect(result.externalId).toBe('tw-456');
    });

    it('should reject non-twitter platforms', async () => {
      await expect(
        adapter.publish({
          text: 'Instagram post',
          platforms: [SocialPlatform.INSTAGRAM],
          profileKey: 'social-account-id-1',
        })
      ).rejects.toThrow(PublisherError);
    });

    it('should wrap API errors in PublisherError', async () => {
      mockPostTweet.mockRejectedValue(new Error('Tweet too long'));

      await expect(
        adapter.publish({
          text: 'x'.repeat(300),
          platforms: [SocialPlatform.TWITTER],
          profileKey: 'social-account-id-1',
        })
      ).rejects.toThrow(PublisherError);

      try {
        await adapter.publish({
          text: 'x'.repeat(300),
          platforms: [SocialPlatform.TWITTER],
          profileKey: 'social-account-id-1',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(PublisherError);
        const pubError = error as PublisherError;
        expect(pubError.provider).toBe(SocialProvider.DIRECT);
        expect(pubError.message).toBe('Tweet too long');
      }
    });

    it('should report $0 cost for direct API', async () => {
      mockPostTweet.mockResolvedValue({
        tweetId: 'tw-789',
        text: 'Free tweet',
        url: 'https://twitter.com/i/status/tw-789',
      });

      const result = await adapter.publish({
        text: 'Free tweet',
        platforms: [SocialPlatform.TWITTER],
        profileKey: 'social-account-id-1',
      });

      expect(result.costUsd).toBe(0);
    });
  });

  describe('delete', () => {
    it('should delete a tweet via Twitter API', async () => {
      mockDeleteTweet.mockResolvedValue(undefined);

      await adapter.delete('tw-123', 'social-account-id-1');

      expect(mockGetAccessToken).toHaveBeenCalledWith('social-account-id-1');
      expect(mockDeleteTweet).toHaveBeenCalledWith('tw-123', 'valid-access-token');
    });

    it('should wrap errors in PublisherError', async () => {
      mockDeleteTweet.mockRejectedValue(new Error('Not found'));

      await expect(
        adapter.delete('bad-id', 'social-account-id-1')
      ).rejects.toThrow(PublisherError);
    });
  });

  describe('getAnalytics', () => {
    it('should normalize Twitter metrics to PostAnalytics', async () => {
      mockGetTweetMetrics.mockResolvedValue({
        likes: 100,
        retweets: 25,
        replies: 10,
        quotes: 5,
        impressions: 10000,
      });

      const analytics = await adapter.getAnalytics('tw-123', 'social-account-id-1');

      expect(analytics.likes).toBe(100);
      expect(analytics.comments).toBe(10); // replies → comments
      expect(analytics.shares).toBe(30);   // retweets + quotes
      expect(analytics.views).toBe(10000); // impressions → views
    });

    it('should wrap errors in PublisherError', async () => {
      mockGetTweetMetrics.mockRejectedValue(new Error('Metrics unavailable'));

      await expect(
        adapter.getAnalytics('tw-123', 'social-account-id-1')
      ).rejects.toThrow(PublisherError);
    });
  });
});
