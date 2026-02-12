/**
 * Ayrshare API Client Tests
 * Tests REST API integration for social media publishing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SocialPlatform } from '@/types/database';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  publishPost,
  getPostAnalytics,
  deletePost,
  AyrshareAuthError,
  AyrshareRequestError,
} from './ayrshare';

describe('ayrshare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AYRSHARE_API_KEY = 'test-api-key';
  });

  describe('publishPost', () => {
    it('should send correct request to Ayrshare API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'post-123',
          postIds: { twitter: 'tw-123' },
          postUrls: { twitter: 'https://twitter.com/post/123' },
        }),
      });

      await publishPost({
        post: 'Test tweet content',
        platforms: [SocialPlatform.TWITTER],
        profileKey: 'profile-key-1',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.ayrshare.com/api/post',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            post: 'Test tweet content',
            platforms: ['twitter'],
            mediaUrls: undefined,
            profileKey: 'profile-key-1',
          }),
        })
      );
    });

    it('should include profileKey when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'post-123',
          postIds: { twitter: 'tw-123' },
        }),
      });

      await publishPost({
        post: 'Test content',
        platforms: [SocialPlatform.TWITTER],
        profileKey: 'custom-profile-key',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.profileKey).toBe('custom-profile-key');
    });

    it('should include media URLs when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'post-123',
          postIds: { instagram: 'ig-123' },
        }),
      });

      await publishPost({
        post: 'Check this out!',
        platforms: [SocialPlatform.INSTAGRAM],
        mediaUrls: ['https://example.com/image.jpg'],
        profileKey: 'profile-key-1',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.mediaUrls).toEqual(['https://example.com/image.jpg']);
    });

    it('should handle API error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid post content',
      });

      await expect(
        publishPost({
          post: 'Test',
          platforms: [SocialPlatform.TWITTER],
          profileKey: 'profile-key-1',
        })
      ).rejects.toThrow(AyrshareRequestError);
    });

    it('should throw error when AYRSHARE_API_KEY is missing', async () => {
      delete process.env.AYRSHARE_API_KEY;

      await expect(
        publishPost({
          post: 'Test',
          platforms: [SocialPlatform.TWITTER],
          profileKey: 'profile-key-1',
        })
      ).rejects.toThrow(AyrshareAuthError);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        publishPost({
          post: 'Test',
          platforms: [SocialPlatform.TWITTER],
          profileKey: 'profile-key-1',
        })
      ).rejects.toThrow(AyrshareRequestError);
    });

    it('should parse successful response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'post-123',
          postIds: { twitter: 'tw-123', instagram: 'ig-456' },
          postUrls: {
            twitter: 'https://twitter.com/post/123',
            instagram: 'https://instagram.com/p/456',
          },
        }),
      });

      const result = await publishPost({
        post: 'Multi-platform post',
        platforms: [SocialPlatform.TWITTER, SocialPlatform.INSTAGRAM],
        profileKey: 'profile-key-1',
      });

      expect(result.id).toBe('post-123');
      expect(result.postIds.twitter).toBe('tw-123');
      expect(result.postIds.instagram).toBe('ig-456');
      expect(result.postUrls?.twitter).toBe('https://twitter.com/post/123');
    });
  });

  describe('getPostAnalytics', () => {
    it('should fetch metrics correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          likes: 42,
          comments: 10,
          shares: 5,
          views: 1000,
          retweets: 8,
          favorites: 35,
        }),
      });

      const analytics = await getPostAnalytics('post-123', 'profile-key-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://app.ayrshare.com/api/analytics/post'),
        expect.objectContaining({
          method: 'GET',
          headers: {
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          },
        })
      );

      expect(analytics.likes).toBe(42);
      expect(analytics.views).toBe(1000);
    });

    it('should include postId and profileKey as query params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ likes: 0 }),
      });

      await getPostAnalytics('test-post-id', 'test-profile-key');

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('id=test-post-id');
      expect(calledUrl).toContain('profileKey=test-profile-key');
    });

    it('should default missing metrics to 0', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          likes: 10,
          // Missing other fields
        }),
      });

      const analytics = await getPostAnalytics('post-123', 'profile-key-1');

      expect(analytics.likes).toBe(10);
      expect(analytics.comments).toBe(0);
      expect(analytics.shares).toBe(0);
      expect(analytics.views).toBe(0);
      expect(analytics.retweets).toBe(0);
      expect(analytics.favorites).toBe(0);
    });

    it('should throw error when AYRSHARE_API_KEY is missing', async () => {
      delete process.env.AYRSHARE_API_KEY;

      await expect(
        getPostAnalytics('post-123', 'profile-key-1')
      ).rejects.toThrow(AyrshareAuthError);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Post not found',
      });

      await expect(
        getPostAnalytics('nonexistent-post', 'profile-key-1')
      ).rejects.toThrow(AyrshareRequestError);
    });
  });

  describe('deletePost', () => {
    it('should remove post via API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'success' }),
      });

      await deletePost('post-123', 'profile-key-1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://app.ayrshare.com/api/post',
        expect.objectContaining({
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: 'post-123',
            profileKey: 'profile-key-1',
          }),
        })
      );
    });

    it('should throw error when AYRSHARE_API_KEY is missing', async () => {
      delete process.env.AYRSHARE_API_KEY;

      await expect(
        deletePost('post-123', 'profile-key-1')
      ).rejects.toThrow(AyrshareAuthError);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Not authorized',
      });

      await expect(
        deletePost('post-123', 'profile-key-1')
      ).rejects.toThrow(AyrshareRequestError);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Connection timeout'));

      await expect(
        deletePost('post-123', 'profile-key-1')
      ).rejects.toThrow(AyrshareRequestError);
    });
  });
});
