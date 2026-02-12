/**
 * Social Routes Tests
 * Tests social account management and publishing endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { SocialPlatform, SocialPostStatus, ModerationStatus } from '@/types/database';

// Hoisted mock references
const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

// Module mocks
vi.mock('@/lib/api/supabase', () => ({
  createAuthenticatedClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock('@/lib/api/middleware/rate-limit', () => ({
  createRateLimiter: vi.fn(() => async (_c: unknown, next: () => Promise<unknown>) => next()),
}));

vi.mock('jose', () => ({
  SignJWT: vi.fn(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue('mock-jwt-token'),
  })),
  jwtVerify: vi.fn(() =>
    Promise.resolve({
      payload: { wallet_address: 'So11111111111111111111111111111111111111112' },
    })
  ),
}));

import { social } from './social';

const MOCK_WALLET_ADDRESS = 'So11111111111111111111111111111111111111112';

describe('Social Routes', () => {
  let app: Hono;
  const mockAccountId = '660e8400-e29b-41d4-a716-446655440001';
  const mockContentId = '123e4567-e89b-12d3-a456-426614174000';
  const mockCharacterId = '550e8400-e29b-41d4-a716-446655440000';
  const mockPostId = '770e8400-e29b-41d4-a716-446655440002';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';

    app = new Hono();
    app.route('/social', social);
  });

  const authHeaders = {
    Authorization: 'Bearer mock-jwt-token',
  };

  describe('POST /social/accounts', () => {
    it('should connect new social account', async () => {
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'social_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockReturnThis(),
          };
        }
        return {};
      });

      mockFrom.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      mockFrom.mockImplementationOnce(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockAccountId,
            wallet_address: MOCK_WALLET_ADDRESS,
            platform: SocialPlatform.TWITTER,
            platform_account_id: 'tw-user-123',
            platform_username: 'testuser',
            ayrshare_profile_key: 'profile-key-1',
            is_connected: true,
            connected_at: '2024-01-15T10:00:00Z',
            last_posted_at: null,
            created_at: '2024-01-15T10:00:00Z',
          },
          error: null,
        }),
      }));

      const res = await app.request('/social/accounts', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: 'twitter',
          platformAccountId: 'tw-user-123',
          platformUsername: 'testuser',
          ayrshareProfileKey: 'profile-key-1',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.platform).toBe('twitter');
    });

    it('should return 409 if platform already connected', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockAccountId },
          error: null,
        }),
      }));

      const res = await app.request('/social/accounts', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: 'twitter',
          platformAccountId: 'tw-user-123',
          platformUsername: 'testuser',
          ayrshareProfileKey: 'profile-key-1',
        }),
      });

      expect(res.status).toBe(409);
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request('/social/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: 'twitter',
          platformAccountId: 'tw-user-123',
          platformUsername: 'testuser',
          ayrshareProfileKey: 'profile-key-1',
        }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /social/accounts', () => {
    it('should list accounts by wallet', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: mockAccountId,
              wallet_address: MOCK_WALLET_ADDRESS,
              platform: SocialPlatform.TWITTER,
              platform_account_id: 'tw-user-123',
              platform_username: 'testuser',
              ayrshare_profile_key: 'profile-key-1',
              is_connected: true,
              connected_at: '2024-01-15T10:00:00Z',
              last_posted_at: null,
              created_at: '2024-01-15T10:00:00Z',
            },
          ],
          error: null,
        }),
      }));

      const res = await app.request('/social/accounts', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.accounts).toHaveLength(1);
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request('/social/accounts', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /social/accounts/:id', () => {
    it('should disconnect account (soft delete)', async () => {
      const mockAccountUUID = '550e8400-e29b-41d4-a716-446655440000';
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Ownership check
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockAccountUUID },
              error: null,
            }),
          };
        }
        // Update
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: mockAccountUUID,
              is_connected: false,
            },
            error: null,
          }),
        };
      });

      const res = await app.request(`/social/accounts/${mockAccountUUID}`, {
        method: 'DELETE',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request(`/social/accounts/${mockAccountId}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /social/publish', () => {
    it('should validate content is approved before publishing', async () => {
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'content_generations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: mockContentId,
                character_id: mockCharacterId,
                moderation_status: ModerationStatus.PENDING,
                characters: { wallet_address: MOCK_WALLET_ADDRESS },
              },
              error: null,
            }),
          };
        }
        return {};
      });

      const res = await app.request('/social/publish', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentGenerationId: mockContentId,
          socialAccountIds: [mockAccountId],
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('approved');
    });

    it('should queue posts for approved content', async () => {
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'content_generations') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: mockContentId,
                character_id: mockCharacterId,
                moderation_status: ModerationStatus.APPROVED,
                characters: { wallet_address: MOCK_WALLET_ADDRESS },
              },
              error: null,
            }),
          };
        }
        if (tableName === 'social_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: mockAccountId,
                  wallet_address: MOCK_WALLET_ADDRESS,
                  platform: SocialPlatform.TWITTER,
                  is_connected: true,
                },
              ],
              error: null,
            }),
          };
        }
        if (tableName === 'social_posts') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockResolvedValue({
              data: [
                {
                  id: mockPostId,
                  content_generation_id: mockContentId,
                  social_account_id: mockAccountId,
                  platform: SocialPlatform.TWITTER,
                  post_id: null,
                  post_url: null,
                  status: SocialPostStatus.QUEUED,
                  posted_at: null,
                  error_message: null,
                  engagement_metrics: {},
                  last_metrics_update: null,
                  created_at: '2024-01-15T10:00:00Z',
                },
              ],
              error: null,
            }),
          };
        }
        return {};
      });

      const res = await app.request('/social/publish', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentGenerationId: mockContentId,
          socialAccountIds: [mockAccountId],
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.posts).toHaveLength(1);
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request('/social/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentGenerationId: mockContentId,
          socialAccountIds: [mockAccountId],
        }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /social/posts', () => {
    it('should list posts with pagination', async () => {
      mockFrom.mockImplementation(() => {
        const selectFn = vi.fn((fields: string, opts?: Record<string, unknown>) => {
          // Count query: select('*', { count: 'exact', head: true })
          if (opts && 'count' in opts) {
            return {
              eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
            };
          }
          // Select query: select('*, social_accounts!inner(wallet_address)')
          return {
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: [
                {
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
                  social_accounts: { wallet_address: MOCK_WALLET_ADDRESS },
                },
              ],
              error: null,
            }),
          };
        });
        return { select: selectFn };
      });

      const res = await app.request('/social/posts?page=1&limit=20', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.pagination).toBeDefined();
    });

    it('should filter by status when provided', async () => {
      const eqSpy = vi.fn().mockReturnThis();
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: eqSpy,
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
        head: true,
        count: 'exact',
      }));

      await app.request('/social/posts?status=posted', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(eqSpy).toHaveBeenCalled();
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request('/social/posts', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });
  });
});
