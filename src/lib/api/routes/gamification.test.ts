/**
 * Gamification Routes Tests
 * Tests points, achievements, stats, and leaderboard endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import {
  PointsType,
  PointsSourceType,
  UserTier,
  AchievementCategory,
  AchievementRequirementType,
} from '@/types/database';

// Hoisted mock references
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

// Module mocks
vi.mock('@/lib/api/supabase', () => ({
  createAuthenticatedClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@/lib/api/middleware/rate-limit', () => ({
  createRateLimiter: vi.fn(() => async (_c: unknown, next: () => Promise<unknown>) => next()),
  readLimiter: async (_c: unknown, next: () => Promise<unknown>) => next(),
  swapLimiter: async (_c: unknown, next: () => Promise<unknown>) => next(),
  generationLimiter: async (_c: unknown, next: () => Promise<unknown>) => next(),
  quoteLimiter: async (_c: unknown, next: () => Promise<unknown>) => next(),
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

import { gamification } from './gamification';

const MOCK_WALLET_ADDRESS = 'So11111111111111111111111111111111111111112';

describe('Gamification Routes', () => {
  let app: Hono;
  const mockPointsId = '550e8400-e29b-41d4-a716-446655440000';
  const mockAchievementId = '987e6543-e21b-12d3-a456-426614174000';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';

    app = new Hono();
    app.route('/gamification', gamification);
  });

  const authHeaders = {
    Authorization: 'Bearer mock-jwt-token',
  };

  // =============================================================================
  // POINTS TESTS
  // =============================================================================

  describe('GET /gamification/me/points', () => {
    it('should return paginated point history', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Count query
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              count: 5,
              error: null,
            }),
          };
        }
        // Select query
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({
            data: [
              {
                id: mockPointsId,
                wallet_address: MOCK_WALLET_ADDRESS,
                points_type: PointsType.CREATION,
                points_amount: 100,
                description: 'Created first agent',
                source_type: PointsSourceType.CHARACTER,
                source_id: '123e4567-e89b-12d3-a456-426614174000',
                created_at: '2024-01-15T10:00:00Z',
              },
            ],
            error: null,
          }),
        };
      });

      const res = await app.request('/gamification/me/points?page=1&limit=20', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.length).toBe(1);
      expect(json.data[0].pointsType).toBe('creation');
      expect(json.pagination).toBeDefined();
      expect(json.pagination.total).toBe(5);
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request('/gamification/me/points', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });
  });

  // =============================================================================
  // STATS TESTS
  // =============================================================================

  describe('GET /gamification/me/stats', () => {
    it('should return user stats with tier progress', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            wallet_address: MOCK_WALLET_ADDRESS,
            total_points: 1500,
            current_streak_days: 7,
            longest_streak_days: 14,
            last_active_date: '2024-01-15',
            total_agents_created: 3,
            total_content_generated: 50,
            total_posts_published: 20,
            tier: UserTier.CREATOR,
            updated_at: '2024-01-15T10:00:00Z',
          },
          error: null,
        }),
      }));

      const res = await app.request('/gamification/me/stats', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.walletAddress).toBe(MOCK_WALLET_ADDRESS);
      expect(json.totalPoints).toBe(1500);
      expect(json.tier).toBe('creator');
      expect(json.tierProgress).toBeDefined();
      expect(json.tierProgress.currentTier).toBe('creator');
      expect(json.tierProgress.nextTier).toBe('influencer');
    });

    it('should create default stats if user stats do not exist', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Initial query returns not found
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            }),
          };
        }
        // Insert query creates default stats
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              wallet_address: MOCK_WALLET_ADDRESS,
              total_points: 0,
              current_streak_days: 0,
              longest_streak_days: 0,
              last_active_date: null,
              total_agents_created: 0,
              total_content_generated: 0,
              total_posts_published: 0,
              tier: UserTier.NEWCOMER,
              updated_at: '2024-01-15T10:00:00Z',
            },
            error: null,
          }),
        };
      });

      const res = await app.request('/gamification/me/stats', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.totalPoints).toBe(0);
      expect(json.tier).toBe('newcomer');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request('/gamification/me/stats', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });
  });

  // =============================================================================
  // ACHIEVEMENTS TESTS
  // =============================================================================

  describe('GET /gamification/me/achievements', () => {
    it('should return unlocked and locked achievements with progress', async () => {
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'achievements') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: mockAchievementId,
                  slug: 'first-steps',
                  name: 'First Steps',
                  description: 'Create your first agent',
                  icon: '🚀',
                  category: AchievementCategory.CREATION,
                  requirement_type: AchievementRequirementType.COUNT,
                  requirement_value: 1,
                  points_reward: 100,
                  tier_required: null,
                  created_at: '2024-01-01T00:00:00Z',
                },
                {
                  id: '111e1111-e11b-11d1-a111-111111111111',
                  slug: 'multi-agent',
                  name: 'Multi-Agent Master',
                  description: 'Create 5 agents',
                  icon: '🤖',
                  category: AchievementCategory.CREATION,
                  requirement_type: AchievementRequirementType.COUNT,
                  requirement_value: 5,
                  points_reward: 300,
                  tier_required: null,
                  created_at: '2024-01-01T00:00:00Z',
                },
              ],
              error: null,
            }),
          };
        }
        if (tableName === 'user_achievements') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: '222e2222-e22b-22d2-a222-222222222222',
                  wallet_address: MOCK_WALLET_ADDRESS,
                  achievement_id: mockAchievementId,
                  unlocked_at: '2024-01-10T10:00:00Z',
                },
              ],
              error: null,
            }),
          };
        }
        if (tableName === 'user_stats') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                wallet_address: MOCK_WALLET_ADDRESS,
                total_points: 500,
                total_agents_created: 3,
                total_content_generated: 20,
                total_posts_published: 10,
                current_streak_days: 5,
              },
              error: null,
            }),
          };
        }
        return {};
      });

      const res = await app.request('/gamification/me/achievements', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.unlocked).toBeDefined();
      expect(json.locked).toBeDefined();
      expect(json.unlocked.length).toBe(1);
      expect(json.unlocked[0].slug).toBe('first-steps');
      expect(json.unlocked[0].unlockedAt).toBe('2024-01-10T10:00:00Z');
      expect(json.locked.length).toBe(1);
      expect(json.locked[0].slug).toBe('multi-agent');
      expect(json.locked[0].progress).toBe(60); // 3/5 = 60%
    });

    it('should calculate achievement progress correctly', async () => {
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'achievements') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: mockAchievementId,
                  slug: 'publishing-pro',
                  name: 'Publishing Pro',
                  description: 'Publish 50 posts',
                  icon: '📢',
                  category: AchievementCategory.PUBLISHING,
                  requirement_type: AchievementRequirementType.COUNT,
                  requirement_value: 50,
                  points_reward: 500,
                  tier_required: null,
                  created_at: '2024-01-01T00:00:00Z',
                },
              ],
              error: null,
            }),
          };
        }
        if (tableName === 'user_achievements') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
        }
        if (tableName === 'user_stats') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                wallet_address: MOCK_WALLET_ADDRESS,
                total_posts_published: 25,
              },
              error: null,
            }),
          };
        }
        return {};
      });

      const res = await app.request('/gamification/me/achievements', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.locked.length).toBe(1);
      expect(json.locked[0].progress).toBe(50); // 25/50 = 50%
      expect(json.locked[0].currentValue).toBe(25);
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request('/gamification/me/achievements', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });
  });

  // =============================================================================
  // LEADERBOARD TESTS
  // =============================================================================

  describe('GET /gamification/leaderboard', () => {
    it('should return leaderboard by period', async () => {
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'leaderboard_cache') {
          // Return stale/missing cache
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
        }
        if (tableName === 'user_stats') {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  wallet_address: 'So11111111111111111111111111111111111111113',
                  total_points: 5000,
                  tier: UserTier.INFLUENCER,
                },
                {
                  wallet_address: MOCK_WALLET_ADDRESS,
                  total_points: 1500,
                  tier: UserTier.CREATOR,
                },
              ],
              error: null,
            }),
          };
        }
        if (tableName === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  wallet_address: 'So11111111111111111111111111111111111111113',
                  display_name: 'User One',
                },
                {
                  wallet_address: MOCK_WALLET_ADDRESS,
                  display_name: 'Test User',
                },
              ],
              error: null,
            }),
          };
        }
        return {};
      });

      const res = await app.request('/gamification/leaderboard?period=all_time&limit=100', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.period).toBe('all_time');
      expect(json.entries).toBeDefined();
      expect(json.entries.length).toBe(2);
      expect(json.entries[0].rank).toBe(1);
      expect(json.entries[0].totalPoints).toBe(5000);
      expect(json.entries[1].rank).toBe(2);
      expect(json.entries[1].totalPoints).toBe(1500);
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request('/gamification/leaderboard', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /gamification/leaderboard/me', () => {
    it('should return user position with surrounding entries', async () => {
      let callCount = 0;
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'user_stats') {
          callCount++;
          if (callCount === 1) {
            // Current user stats
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  wallet_address: MOCK_WALLET_ADDRESS,
                  total_points: 1500,
                  tier: UserTier.CREATOR,
                },
                error: null,
              }),
            };
          }
          if (callCount === 2) {
            // Count higher points (rank calculation)
            return {
              select: vi.fn().mockReturnThis(),
              gt: vi.fn().mockResolvedValue({
                count: 2,
                error: null,
              }),
            };
          }
          if (callCount === 3) {
            // Users above
            return {
              select: vi.fn().mockReturnThis(),
              gt: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({
                data: [
                  {
                    wallet_address: 'So11111111111111111111111111111111111111114',
                    total_points: 1600,
                    tier: UserTier.CREATOR,
                  },
                  {
                    wallet_address: 'So11111111111111111111111111111111111111115',
                    total_points: 2000,
                    tier: UserTier.INFLUENCER,
                  },
                ],
                error: null,
              }),
            };
          }
          // Users below
          return {
            select: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  wallet_address: 'So11111111111111111111111111111111111111116',
                  total_points: 1000,
                  tier: UserTier.CREATOR,
                },
              ],
              error: null,
            }),
          };
        }
        if (tableName === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { wallet_address: MOCK_WALLET_ADDRESS, display_name: 'Current User' },
                { wallet_address: 'So11111111111111111111111111111111111111114', display_name: 'User Two' },
                { wallet_address: 'So11111111111111111111111111111111111111115', display_name: 'User Three' },
                { wallet_address: 'So11111111111111111111111111111111111111116', display_name: 'User Four' },
              ],
              error: null,
            }),
            single: vi.fn().mockResolvedValue({
              data: { display_name: 'Current User' },
              error: null,
            }),
          };
        }
        return {};
      });

      const res = await app.request('/gamification/leaderboard/me', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.currentUser).toBeDefined();
      expect(json.currentUser.rank).toBe(3);
      expect(json.currentUser.totalPoints).toBe(1500);
      expect(json.above).toBeDefined();
      expect(json.above.length).toBe(2);
      expect(json.below).toBeDefined();
      expect(json.below.length).toBe(1);
    });

    it('should return 404 when user stats not found', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      }));

      const res = await app.request('/gamification/leaderboard/me', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(404);
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request('/gamification/leaderboard/me', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });
  });
});
