/**
 * Ayrshare Adapter Tests
 * Tests the SocialPublisher adapter wrapping the Ayrshare client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SocialPlatform } from '@/types/database';
import { SocialProvider, PublisherError } from './types';

// Hoisted mocks
const { mockPublishPost, mockDeletePost, mockGetPostAnalytics } = vi.hoisted(() => ({
  mockPublishPost: vi.fn(),
  mockDeletePost: vi.fn(),
  mockGetPostAnalytics: vi.fn(),
}));

vi.mock('./ayrshare', () => ({
  publishPost: mockPublishPost,
  deletePost: mockDeletePost,
  getPostAnalytics: mockGetPostAnalytics,
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { AyrshareAdapter } from './ayrshare-adapter';

describe('AyrshareAdapter', () => {
  let adapter: AyrshareAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new AyrshareAdapter();
  });

  it('should report provider as AYRSHARE', () => {
    expect(adapter.provider).toBe(SocialProvider.AYRSHARE);
  });

  describe('publish', () => {
    it('should delegate to Ayrshare publishPost and normalize result', async () => {
      mockPublishPost.mockResolvedValue({
        id: 'ayr-123',
        postIds: { twitter: 'tw-456' },
        postUrls: { twitter: 'https://twitter.com/post/456' },
      });

      const result = await adapter.publish({
        text: 'Hello world',
        platforms: [SocialPlatform.TWITTER],
        profileKey: 'pk-1',
      });

      expect(mockPublishPost).toHaveBeenCalledWith({
        post: 'Hello world',
        platforms: [SocialPlatform.TWITTER],
        mediaUrls: undefined,
        profileKey: 'pk-1',
      });

      expect(result).toEqual({
        provider: SocialProvider.AYRSHARE,
        externalId: 'ayr-123',
        platformPostIds: { twitter: 'tw-456' },
        platformPostUrls: { twitter: 'https://twitter.com/post/456' },
        costUsd: 0.01,
      });
    });

    it('should calculate cost based on platform count', async () => {
      mockPublishPost.mockResolvedValue({
        id: 'ayr-multi',
        postIds: { twitter: 'tw-1', instagram: 'ig-1', tiktok: 'tk-1' },
        postUrls: {},
      });

      const result = await adapter.publish({
        text: 'Multi-platform post',
        platforms: [SocialPlatform.TWITTER, SocialPlatform.INSTAGRAM, SocialPlatform.TIKTOK],
        profileKey: 'pk-1',
      });

      expect(result.costUsd).toBe(0.03);
    });

    it('should pass media URLs through', async () => {
      mockPublishPost.mockResolvedValue({
        id: 'ayr-img',
        postIds: { instagram: 'ig-img' },
      });

      await adapter.publish({
        text: 'Photo post',
        platforms: [SocialPlatform.INSTAGRAM],
        mediaUrls: ['https://cdn.example.com/img.jpg'],
        profileKey: 'pk-1',
      });

      expect(mockPublishPost).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaUrls: ['https://cdn.example.com/img.jpg'],
        })
      );
    });

    it('should handle missing postUrls gracefully', async () => {
      mockPublishPost.mockResolvedValue({
        id: 'ayr-nourls',
        postIds: { twitter: 'tw-789' },
        // postUrls is undefined
      });

      const result = await adapter.publish({
        text: 'No URLs in response',
        platforms: [SocialPlatform.TWITTER],
        profileKey: 'pk-1',
      });

      expect(result.platformPostUrls).toEqual({});
    });

    it('should wrap Ayrshare errors in PublisherError', async () => {
      mockPublishPost.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(
        adapter.publish({
          text: 'Will fail',
          platforms: [SocialPlatform.TWITTER],
          profileKey: 'pk-1',
        })
      ).rejects.toThrow(PublisherError);

      try {
        await adapter.publish({
          text: 'Will fail',
          platforms: [SocialPlatform.TWITTER],
          profileKey: 'pk-1',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(PublisherError);
        const pubError = error as PublisherError;
        expect(pubError.provider).toBe(SocialProvider.AYRSHARE);
        expect(pubError.message).toBe('Rate limit exceeded');
      }
    });
  });

  describe('delete', () => {
    it('should delegate to Ayrshare deletePost', async () => {
      mockDeletePost.mockResolvedValue(undefined);

      await adapter.delete('post-123', 'pk-1');

      expect(mockDeletePost).toHaveBeenCalledWith('post-123', 'pk-1');
    });

    it('should wrap errors in PublisherError', async () => {
      mockDeletePost.mockRejectedValue(new Error('Post not found'));

      await expect(adapter.delete('bad-id', 'pk-1')).rejects.toThrow(PublisherError);
    });
  });

  describe('getAnalytics', () => {
    it('should normalize Ayrshare analytics into PostAnalytics', async () => {
      mockGetPostAnalytics.mockResolvedValue({
        likes: 100,
        comments: 20,
        shares: 10,
        views: 5000,
        retweets: 30,
        favorites: 50,
      });

      const analytics = await adapter.getAnalytics('post-123', 'pk-1');

      expect(mockGetPostAnalytics).toHaveBeenCalledWith('post-123', 'pk-1');
      // likes + favorites
      expect(analytics.likes).toBe(150);
      expect(analytics.comments).toBe(20);
      // shares + retweets
      expect(analytics.shares).toBe(40);
      expect(analytics.views).toBe(5000);
    });

    it('should wrap errors in PublisherError', async () => {
      mockGetPostAnalytics.mockRejectedValue(new Error('Analytics unavailable'));

      await expect(adapter.getAnalytics('post-123', 'pk-1')).rejects.toThrow(PublisherError);
    });
  });
});
