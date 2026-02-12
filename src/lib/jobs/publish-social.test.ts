/**
 * Social Publishing Job Tests
 * Tests social media publishing to multiple platforms
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ModerationStatus,
  GenerationType,
  SocialPlatform,
  SocialPostStatus,
} from '@/types/database';
import type { ContentGeneration, SocialAccount } from '@/types/database';

// Hoisted mock references
const { mockFrom, mockPublishPost } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockPublishPost: vi.fn(),
}));

// Module mocks
vi.mock('@/lib/api/supabase', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@/lib/social/ayrshare', () => ({
  publishPost: mockPublishPost,
}));

import { publishToSocial, PublishError } from './publish-social';

describe('publish-social', () => {
  const mockContentId = '123e4567-e89b-12d3-a456-426614174000';
  const mockCharacterId = '550e8400-e29b-41d4-a716-446655440000';
  const mockAccountId1 = 'acc-111';
  const mockAccountId2 = 'acc-222';
  const mockPostId = 'social-post-123';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    // Default successful publish response
    mockPublishPost.mockResolvedValue({
      id: 'ayr-123',
      postIds: { twitter: 'tw-123', instagram: 'ig-456' },
      postUrls: { twitter: 'https://twitter.com/post/123', instagram: 'https://instagram.com/p/456' },
    });
  });

  describe('publishToSocial', () => {
    it('should throw error when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      await expect(
        publishToSocial(mockContentId, [mockAccountId1])
      ).rejects.toThrow(PublishError);
    });

    it('should reject content that is not approved', async () => {
      const mockContent: ContentGeneration = {
        id: mockContentId,
        character_id: mockCharacterId,
        generation_type: GenerationType.TEXT,
        input_prompt: 'Test',
        enhanced_prompt: null,
        model_used: 'claude-sonnet-4-20250514',
        model_params: {},
        output_url: null,
        output_text: 'Test content',
        quality_score: null,
        moderation_status: ModerationStatus.PENDING,
        moderation_details: null,
        token_usage: {},
        cost_usd: null,
        latency_ms: null,
        cache_hit: false,
        created_at: '2024-01-15T10:00:00Z',
      };

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'content_generations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockContent, error: null }),
          };
        }
        return {};
      });

      await expect(
        publishToSocial(mockContentId, [mockAccountId1])
      ).rejects.toThrow('Content is not approved for publishing');
    });

    it('should successfully publish to single platform', async () => {
      const mockContent: ContentGeneration = {
        id: mockContentId,
        character_id: mockCharacterId,
        generation_type: GenerationType.TEXT,
        input_prompt: 'Test',
        enhanced_prompt: null,
        model_used: 'claude-sonnet-4-20250514',
        model_params: {},
        output_url: null,
        output_text: 'Test tweet content',
        quality_score: null,
        moderation_status: ModerationStatus.APPROVED,
        moderation_details: null,
        token_usage: {},
        cost_usd: null,
        latency_ms: null,
        cache_hit: false,
        created_at: '2024-01-15T10:00:00Z',
      };

      const mockAccount: SocialAccount = {
        id: mockAccountId1,
        wallet_address: 'So11111111111111111111111111111111111111112',
        platform: SocialPlatform.TWITTER,
        platform_account_id: 'tw-user-123',
        platform_username: 'testuser',
        ayrshare_profile_key: 'profile-key-1',
        is_connected: true,
        connected_at: '2024-01-15T00:00:00Z',
        last_posted_at: null,
        created_at: '2024-01-15T00:00:00Z',
      };

      mockPublishPost.mockResolvedValue({
        id: 'ayr-123',
        postIds: { twitter: 'tw-post-123' },
        postUrls: { twitter: 'https://twitter.com/post/123' },
      });

      const insertSpy = vi.fn().mockReturnThis();
      const updateSpy = vi.fn().mockReturnThis();

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'content_generations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockContent, error: null }),
          };
        }
        if (tableName === 'social_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [mockAccount], error: null }),
            update: updateSpy,
            eq: vi.fn().mockReturnThis(),
          };
        }
        if (tableName === 'social_posts') {
          return {
            insert: insertSpy,
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockPostId },
              error: null,
            }),
            update: updateSpy,
            eq: vi.fn().mockReturnThis(),
          };
        }
        return {};
      });

      const results = await publishToSocial(mockContentId, [mockAccountId1]);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].platform).toBe(SocialPlatform.TWITTER);
      expect(results[0].postId).toBe('tw-post-123');
    });

    it('should publish to multiple platforms in parallel', async () => {
      const mockContent: ContentGeneration = {
        id: mockContentId,
        character_id: mockCharacterId,
        generation_type: GenerationType.TEXT,
        input_prompt: 'Test',
        enhanced_prompt: null,
        model_used: 'claude-sonnet-4-20250514',
        model_params: {},
        output_url: null,
        output_text: 'Test content',
        quality_score: null,
        moderation_status: ModerationStatus.APPROVED,
        moderation_details: null,
        token_usage: {},
        cost_usd: null,
        latency_ms: null,
        cache_hit: false,
        created_at: '2024-01-15T10:00:00Z',
      };

      const mockAccount1: SocialAccount = {
        id: mockAccountId1,
        wallet_address: 'So11111111111111111111111111111111111111112',
        platform: SocialPlatform.TWITTER,
        platform_account_id: 'tw-user-123',
        platform_username: 'testuser',
        ayrshare_profile_key: 'profile-key-1',
        is_connected: true,
        connected_at: '2024-01-15T00:00:00Z',
        last_posted_at: null,
        created_at: '2024-01-15T00:00:00Z',
      };

      const mockAccount2: SocialAccount = {
        id: mockAccountId2,
        wallet_address: 'So11111111111111111111111111111111111111112',
        platform: SocialPlatform.INSTAGRAM,
        platform_account_id: 'ig-user-456',
        platform_username: 'testuser',
        ayrshare_profile_key: 'profile-key-2',
        is_connected: true,
        connected_at: '2024-01-15T00:00:00Z',
        last_posted_at: null,
        created_at: '2024-01-15T00:00:00Z',
      };

      let callCount = 0;
      mockPublishPost.mockImplementation(async (params) => {
        callCount++;
        const platform = params.platforms[0];
        return {
          id: `ayr-${callCount}`,
          postIds: { [platform]: `${platform}-post-${callCount}` },
          postUrls: { [platform]: `https://${platform}.com/post/${callCount}` },
        };
      });

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'content_generations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockContent, error: null }),
          };
        }
        if (tableName === 'social_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [mockAccount1, mockAccount2], error: null }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }
        if (tableName === 'social_posts') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockPostId },
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }
        return {};
      });

      const results = await publishToSocial(mockContentId, [mockAccountId1, mockAccountId2]);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
      expect(mockPublishPost).toHaveBeenCalledTimes(2);
    });

    it('should handle one platform failure without blocking others', async () => {
      const mockContent: ContentGeneration = {
        id: mockContentId,
        character_id: mockCharacterId,
        generation_type: GenerationType.TEXT,
        input_prompt: 'Test',
        enhanced_prompt: null,
        model_used: 'claude-sonnet-4-20250514',
        model_params: {},
        output_url: null,
        output_text: 'Test content',
        quality_score: null,
        moderation_status: ModerationStatus.APPROVED,
        moderation_details: null,
        token_usage: {},
        cost_usd: null,
        latency_ms: null,
        cache_hit: false,
        created_at: '2024-01-15T10:00:00Z',
      };

      const mockAccount1: SocialAccount = {
        id: mockAccountId1,
        wallet_address: 'So11111111111111111111111111111111111111112',
        platform: SocialPlatform.TWITTER,
        platform_account_id: 'tw-user-123',
        platform_username: 'testuser',
        ayrshare_profile_key: 'profile-key-1',
        is_connected: true,
        connected_at: '2024-01-15T00:00:00Z',
        last_posted_at: null,
        created_at: '2024-01-15T00:00:00Z',
      };

      const mockAccount2: SocialAccount = {
        id: mockAccountId2,
        wallet_address: 'So11111111111111111111111111111111111111112',
        platform: SocialPlatform.INSTAGRAM,
        platform_account_id: 'ig-user-456',
        platform_username: 'testuser',
        ayrshare_profile_key: 'profile-key-2',
        is_connected: true,
        connected_at: '2024-01-15T00:00:00Z',
        last_posted_at: null,
        created_at: '2024-01-15T00:00:00Z',
      };

      let callCount = 0;
      mockPublishPost.mockImplementation(async (params) => {
        callCount++;
        if (params.platforms[0] === SocialPlatform.TWITTER) {
          throw new Error('Twitter API error');
        }
        return {
          id: `ayr-${callCount}`,
          postIds: { instagram: 'ig-post-123' },
          postUrls: { instagram: 'https://instagram.com/post/123' },
        };
      });

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'content_generations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockContent, error: null }),
          };
        }
        if (tableName === 'social_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [mockAccount1, mockAccount2], error: null }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }
        if (tableName === 'social_posts') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockPostId },
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }
        return {};
      });

      const results = await publishToSocial(mockContentId, [mockAccountId1, mockAccountId2]);

      expect(results).toHaveLength(2);
      const twitterResult = results.find((r) => r.platform === SocialPlatform.TWITTER);
      const instaResult = results.find((r) => r.platform === SocialPlatform.INSTAGRAM);

      expect(twitterResult?.success).toBe(false);
      expect(twitterResult?.error).toContain('Twitter API error');
      expect(instaResult?.success).toBe(true);
    });

    it('should create social_posts record with status queued then posted', async () => {
      const mockContent: ContentGeneration = {
        id: mockContentId,
        character_id: mockCharacterId,
        generation_type: GenerationType.TEXT,
        input_prompt: 'Test',
        enhanced_prompt: null,
        model_used: 'claude-sonnet-4-20250514',
        model_params: {},
        output_url: null,
        output_text: 'Test content',
        quality_score: null,
        moderation_status: ModerationStatus.APPROVED,
        moderation_details: null,
        token_usage: {},
        cost_usd: null,
        latency_ms: null,
        cache_hit: false,
        created_at: '2024-01-15T10:00:00Z',
      };

      const mockAccount: SocialAccount = {
        id: mockAccountId1,
        wallet_address: 'So11111111111111111111111111111111111111112',
        platform: SocialPlatform.TWITTER,
        platform_account_id: 'tw-user-123',
        platform_username: 'testuser',
        ayrshare_profile_key: 'profile-key-1',
        is_connected: true,
        connected_at: '2024-01-15T00:00:00Z',
        last_posted_at: null,
        created_at: '2024-01-15T00:00:00Z',
      };

      const insertSpy = vi.fn().mockReturnThis();
      const updateSpy = vi.fn().mockReturnThis();

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'content_generations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockContent, error: null }),
          };
        }
        if (tableName === 'social_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [mockAccount], error: null }),
            update: updateSpy,
            eq: vi.fn().mockReturnThis(),
          };
        }
        if (tableName === 'social_posts') {
          return {
            insert: insertSpy,
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockPostId },
              error: null,
            }),
            update: updateSpy,
            eq: vi.fn().mockReturnThis(),
          };
        }
        return {};
      });

      await publishToSocial(mockContentId, [mockAccountId1]);

      expect(insertSpy).toHaveBeenCalledWith({
        content_generation_id: mockContentId,
        social_account_id: mockAccountId1,
        platform: SocialPlatform.TWITTER,
        status: SocialPostStatus.QUEUED,
        engagement_metrics: {},
      });

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SocialPostStatus.POSTED,
        })
      );
    });

    it('should update social_accounts.last_posted_at on success', async () => {
      const mockContent: ContentGeneration = {
        id: mockContentId,
        character_id: mockCharacterId,
        generation_type: GenerationType.TEXT,
        input_prompt: 'Test',
        enhanced_prompt: null,
        model_used: 'claude-sonnet-4-20250514',
        model_params: {},
        output_url: null,
        output_text: 'Test content',
        quality_score: null,
        moderation_status: ModerationStatus.APPROVED,
        moderation_details: null,
        token_usage: {},
        cost_usd: null,
        latency_ms: null,
        cache_hit: false,
        created_at: '2024-01-15T10:00:00Z',
      };

      const mockAccount: SocialAccount = {
        id: mockAccountId1,
        wallet_address: 'So11111111111111111111111111111111111111112',
        platform: SocialPlatform.TWITTER,
        platform_account_id: 'tw-user-123',
        platform_username: 'testuser',
        ayrshare_profile_key: 'profile-key-1',
        is_connected: true,
        connected_at: '2024-01-15T00:00:00Z',
        last_posted_at: null,
        created_at: '2024-01-15T00:00:00Z',
      };

      const updateAccountSpy = vi.fn().mockReturnThis();

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'content_generations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockContent, error: null }),
          };
        }
        if (tableName === 'social_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [mockAccount], error: null }),
            update: updateAccountSpy,
            eq: vi.fn().mockReturnThis(),
          };
        }
        if (tableName === 'social_posts') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockPostId },
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }
        return {};
      });

      await publishToSocial(mockContentId, [mockAccountId1]);

      expect(updateAccountSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          last_posted_at: expect.any(String),
        })
      );
    });

    it('should record error_message on failure', async () => {
      const mockContent: ContentGeneration = {
        id: mockContentId,
        character_id: mockCharacterId,
        generation_type: GenerationType.TEXT,
        input_prompt: 'Test',
        enhanced_prompt: null,
        model_used: 'claude-sonnet-4-20250514',
        model_params: {},
        output_url: null,
        output_text: 'Test content',
        quality_score: null,
        moderation_status: ModerationStatus.APPROVED,
        moderation_details: null,
        token_usage: {},
        cost_usd: null,
        latency_ms: null,
        cache_hit: false,
        created_at: '2024-01-15T10:00:00Z',
      };

      const mockAccount: SocialAccount = {
        id: mockAccountId1,
        wallet_address: 'So11111111111111111111111111111111111111112',
        platform: SocialPlatform.TWITTER,
        platform_account_id: 'tw-user-123',
        platform_username: 'testuser',
        ayrshare_profile_key: 'profile-key-1',
        is_connected: true,
        connected_at: '2024-01-15T00:00:00Z',
        last_posted_at: null,
        created_at: '2024-01-15T00:00:00Z',
      };

      mockPublishPost.mockRejectedValue(new Error('API rate limited'));

      const updatePostSpy = vi.fn().mockReturnThis();

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'content_generations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockContent, error: null }),
          };
        }
        if (tableName === 'social_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [mockAccount], error: null }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }
        if (tableName === 'social_posts') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockPostId },
              error: null,
            }),
            update: updatePostSpy,
            eq: vi.fn().mockReturnThis(),
          };
        }
        return {};
      });

      const results = await publishToSocial(mockContentId, [mockAccountId1]);

      expect(results[0].success).toBe(false);
      expect(updatePostSpy).toHaveBeenCalledWith({
        status: SocialPostStatus.FAILED,
        error_message: 'API rate limited',
      });
    });
  });
});
