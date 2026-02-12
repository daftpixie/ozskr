/**
 * Engagement Metrics Refresh Tests
 * Tests analytics refresh and snapshot computation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SocialPostStatus, SocialPlatform } from '@/types/database';
import type { SocialPost } from '@/types/database';

// Hoisted mock references
const { mockFrom, mockRpc, mockGetPostAnalytics } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockGetPostAnalytics: vi.fn(),
}));

// Module mocks
vi.mock('@/lib/api/supabase', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock('@/lib/social/ayrshare', () => ({
  getPostAnalytics: mockGetPostAnalytics,
}));

import { refreshEngagementMetrics, MetricsRefreshError } from './refresh-metrics';

describe('refresh-metrics', () => {
  const mockCharacterId = '550e8400-e29b-41d4-a716-446655440000';
  const mockContentId = '123e4567-e89b-12d3-a456-426614174000';
  const mockAccountId = 'acc-111';
  const mockPostId = 'post-123';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    // Default analytics response
    mockGetPostAnalytics.mockResolvedValue({
      likes: 42,
      comments: 10,
      shares: 5,
      views: 1000,
      retweets: 8,
      favorites: 35,
    });
  });

  describe('refreshEngagementMetrics', () => {
    it('should throw error when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      await expect(refreshEngagementMetrics()).rejects.toThrow(MetricsRefreshError);
    });

    it('should return 0 when no recent posts exist', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        not: vi.fn().mockResolvedValue({ data: [], error: null }),
      }));

      const count = await refreshEngagementMetrics();

      expect(count).toBe(0);
    });

    it('should fetch recent posted social_posts (last 7 days)', async () => {
      const selectSpy = vi.fn().mockReturnThis();
      const eqSpy = vi.fn().mockReturnThis();
      const gteSpy = vi.fn().mockReturnThis();
      const notSpy = vi.fn().mockResolvedValue({ data: [], error: null });

      mockFrom.mockImplementation(() => ({
        select: selectSpy,
        eq: eqSpy,
        gte: gteSpy,
        not: notSpy,
      }));

      await refreshEngagementMetrics();

      expect(eqSpy).toHaveBeenCalledWith('status', SocialPostStatus.POSTED);
      expect(notSpy).toHaveBeenCalledWith('post_id', 'is', null);
    });

    it('should call getPostAnalytics for each post', async () => {
      const mockPosts: SocialPost[] = [
        {
          id: 'post-1',
          content_generation_id: mockContentId,
          social_account_id: mockAccountId,
          platform: SocialPlatform.TWITTER,
          post_id: 'tw-123',
          post_url: 'https://twitter.com/post/123',
          status: SocialPostStatus.POSTED,
          posted_at: '2024-01-15T10:00:00Z',
          error_message: null,
          engagement_metrics: {},
          last_metrics_update: null,
          created_at: '2024-01-15T09:00:00Z',
        },
        {
          id: 'post-2',
          content_generation_id: mockContentId,
          social_account_id: mockAccountId,
          platform: SocialPlatform.INSTAGRAM,
          post_id: 'ig-456',
          post_url: 'https://instagram.com/p/456',
          status: SocialPostStatus.POSTED,
          posted_at: '2024-01-15T11:00:00Z',
          error_message: null,
          engagement_metrics: {},
          last_metrics_update: null,
          created_at: '2024-01-15T10:00:00Z',
        },
      ];

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'social_posts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            not: vi.fn().mockResolvedValue({ data: mockPosts, error: null }),
            update: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (tableName === 'social_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { ayrshare_profile_key: 'profile-key-1' },
              error: null,
            }),
          };
        }
        if (tableName === 'content_generations') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: mockContentId, character_id: mockCharacterId }],
              error: null,
            }),
            eq: vi.fn().mockReturnThis(),
            not: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (tableName === 'analytics_snapshots') {
          return {
            upsert: vi.fn().mockResolvedValue({ data: {}, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          head: true,
        };
      });

      await refreshEngagementMetrics();

      expect(mockGetPostAnalytics).toHaveBeenCalledTimes(2);
    });

    it('should update engagement_metrics on social_posts', async () => {
      const mockPost: SocialPost = {
        id: mockPostId,
        content_generation_id: mockContentId,
        social_account_id: mockAccountId,
        platform: SocialPlatform.TWITTER,
        post_id: 'tw-123',
        post_url: 'https://twitter.com/post/123',
        status: SocialPostStatus.POSTED,
        posted_at: '2024-01-15T10:00:00Z',
        error_message: null,
        engagement_metrics: {},
        last_metrics_update: null,
        created_at: '2024-01-15T09:00:00Z',
      };

      const updateSpy = vi.fn().mockReturnThis();

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'social_posts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            not: vi.fn().mockResolvedValue({ data: [mockPost], error: null }),
            update: updateSpy,
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (tableName === 'social_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { ayrshare_profile_key: 'profile-key-1' },
              error: null,
            }),
          };
        }
        if (tableName === 'content_generations') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: mockContentId, character_id: mockCharacterId }],
              error: null,
            }),
            eq: vi.fn().mockReturnThis(),
            not: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (tableName === 'analytics_snapshots') {
          return {
            upsert: vi.fn().mockResolvedValue({ data: {}, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      await refreshEngagementMetrics();

      expect(updateSpy).toHaveBeenCalledWith({
        engagement_metrics: expect.objectContaining({
          likes: 42,
          views: 1000,
        }),
        last_metrics_update: expect.any(String),
      });
    });

    it('should create/upsert analytics_snapshots', async () => {
      const mockPost: SocialPost = {
        id: mockPostId,
        content_generation_id: mockContentId,
        social_account_id: mockAccountId,
        platform: SocialPlatform.TWITTER,
        post_id: 'tw-123',
        post_url: 'https://twitter.com/post/123',
        status: SocialPostStatus.POSTED,
        posted_at: '2024-01-15T10:00:00Z',
        error_message: null,
        engagement_metrics: {},
        last_metrics_update: null,
        created_at: '2024-01-15T09:00:00Z',
      };

      const upsertSpy = vi.fn().mockResolvedValue({ data: {}, error: null });

      // Helper to create a self-chaining thenable mock
      const makeChain = (resolvedValue: unknown) => {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.in = vi.fn().mockReturnValue(chain);
        chain.gte = vi.fn().mockReturnValue(chain);
        chain.not = vi.fn().mockReturnValue(chain);
        chain.order = vi.fn().mockReturnValue(chain);
        chain.single = vi.fn().mockReturnValue(chain);
        chain.then = (resolve: (v: unknown) => void) =>
          Promise.resolve(resolvedValue).then(resolve);
        return chain;
      };

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'social_posts') {
          const selectFn = vi.fn((_fields: string, opts?: Record<string, unknown>) => {
            if (opts && 'count' in opts) {
              return makeChain({ count: 1, error: null });
            }
            // Regular queries (posts fetch, engagement, top content)
            return makeChain({ data: [mockPost], error: null });
          });
          return {
            select: selectFn,
            update: vi.fn(() => makeChain({ data: {}, error: null })),
          };
        }
        if (tableName === 'social_accounts') {
          return makeChain({
            data: { ayrshare_profile_key: 'profile-key-1' },
            error: null,
          });
        }
        if (tableName === 'content_generations') {
          const selectFn = vi.fn((fields: string, opts?: Record<string, unknown>) => {
            if (opts && 'count' in opts) {
              return makeChain({ count: 5, error: null });
            }
            if (fields === 'quality_score') {
              return makeChain({
                data: [{ quality_score: 8.5 }],
                error: null,
              });
            }
            if (fields === 'id') {
              return makeChain({
                data: [{ id: mockContentId }],
                error: null,
              });
            }
            // 'id, character_id' query
            return makeChain({
              data: [{ id: mockContentId, character_id: mockCharacterId }],
              error: null,
            });
          });
          return { select: selectFn };
        }
        if (tableName === 'analytics_snapshots') {
          return {
            upsert: upsertSpy,
          };
        }
        return makeChain({ data: [], error: null });
      });

      await refreshEngagementMetrics();

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          character_id: mockCharacterId,
          snapshot_date: expect.any(String),
        }),
        { onConflict: 'character_id,snapshot_date' }
      );
    });

    it('should handle missing analytics gracefully', async () => {
      const mockPost: SocialPost = {
        id: mockPostId,
        content_generation_id: mockContentId,
        social_account_id: mockAccountId,
        platform: SocialPlatform.TWITTER,
        post_id: 'tw-123',
        post_url: 'https://twitter.com/post/123',
        status: SocialPostStatus.POSTED,
        posted_at: '2024-01-15T10:00:00Z',
        error_message: null,
        engagement_metrics: {},
        last_metrics_update: null,
        created_at: '2024-01-15T09:00:00Z',
      };

      mockGetPostAnalytics.mockRejectedValue(new Error('Post not found on platform'));

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'social_posts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            not: vi.fn().mockResolvedValue({ data: [mockPost], error: null }),
            update: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (tableName === 'social_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { ayrshare_profile_key: 'profile-key-1' },
              error: null,
            }),
          };
        }
        if (tableName === 'content_generations') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: mockContentId, character_id: mockCharacterId }],
              error: null,
            }),
            eq: vi.fn().mockReturnThis(),
            not: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (tableName === 'analytics_snapshots') {
          return {
            upsert: vi.fn().mockResolvedValue({ data: {}, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      // Should not throw, should handle error gracefully
      const count = await refreshEngagementMetrics();
      expect(count).toBe(1);
    });

    it('should return count of posts updated', async () => {
      const mockPosts: SocialPost[] = [
        {
          id: 'post-1',
          content_generation_id: mockContentId,
          social_account_id: mockAccountId,
          platform: SocialPlatform.TWITTER,
          post_id: 'tw-123',
          post_url: 'https://twitter.com/post/123',
          status: SocialPostStatus.POSTED,
          posted_at: '2024-01-15T10:00:00Z',
          error_message: null,
          engagement_metrics: {},
          last_metrics_update: null,
          created_at: '2024-01-15T09:00:00Z',
        },
        {
          id: 'post-2',
          content_generation_id: mockContentId,
          social_account_id: mockAccountId,
          platform: SocialPlatform.INSTAGRAM,
          post_id: 'ig-456',
          post_url: 'https://instagram.com/p/456',
          status: SocialPostStatus.POSTED,
          posted_at: '2024-01-15T11:00:00Z',
          error_message: null,
          engagement_metrics: {},
          last_metrics_update: null,
          created_at: '2024-01-15T10:00:00Z',
        },
        {
          id: 'post-3',
          content_generation_id: mockContentId,
          social_account_id: mockAccountId,
          platform: SocialPlatform.TIKTOK,
          post_id: 'tk-789',
          post_url: 'https://tiktok.com/v/789',
          status: SocialPostStatus.POSTED,
          posted_at: '2024-01-15T12:00:00Z',
          error_message: null,
          engagement_metrics: {},
          last_metrics_update: null,
          created_at: '2024-01-15T11:00:00Z',
        },
      ];

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'social_posts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            not: vi.fn().mockResolvedValue({ data: mockPosts, error: null }),
            update: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (tableName === 'social_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { ayrshare_profile_key: 'profile-key-1' },
              error: null,
            }),
          };
        }
        if (tableName === 'content_generations') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: mockContentId, character_id: mockCharacterId }],
              error: null,
            }),
            eq: vi.fn().mockReturnThis(),
            not: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        if (tableName === 'analytics_snapshots') {
          return {
            upsert: vi.fn().mockResolvedValue({ data: {}, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const count = await refreshEngagementMetrics();
      expect(count).toBe(3);
    });
  });
});
