/**
 * Analytics Routes Tests
 * Tests analytics and engagement metrics endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';

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

import { analytics } from './analytics';

const _MOCK_WALLET_ADDRESS = 'So11111111111111111111111111111111111111112';

describe('Analytics Routes', () => {
  let app: Hono;
  const mockCharacterId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';

    app = new Hono();
    app.route('/analytics', analytics);
  });

  const authHeaders = {
    Authorization: 'Bearer mock-jwt-token',
  };

  describe('GET /analytics/characters/:characterId/summary', () => {
    it('should return aggregated analytics for a character', async () => {
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'characters') {
          const chain: Record<string, unknown> = {};
          chain.select = vi.fn().mockReturnValue(chain);
          chain.eq = vi.fn().mockReturnValue(chain);
          chain.single = vi.fn().mockResolvedValue({
            data: { id: mockCharacterId },
            error: null,
          });
          return chain;
        }
        if (tableName === 'content_generations') {
          // select('*', { count }) → .eq() resolves count
          // select('quality_score') → .eq().not() resolves data
          const selectFn = vi.fn((_fields: string, opts?: Record<string, unknown>) => {
            if (opts && 'count' in opts) {
              return { eq: vi.fn().mockResolvedValue({ count: 10, error: null }) };
            }
            const chain: Record<string, unknown> = {};
            chain.eq = vi.fn().mockReturnValue(chain);
            chain.not = vi.fn().mockResolvedValue({
              data: [{ quality_score: 8.5 }, { quality_score: 9.0 }],
              error: null,
            });
            return chain;
          });
          return { select: selectFn };
        }
        if (tableName === 'social_posts') {
          // select('...', { count }) → .eq() resolves count
          // select('engagement_metrics, ...') → .eq().eq() resolves data
          const selectFn = vi.fn((_fields: string, opts?: Record<string, unknown>) => {
            if (opts && 'count' in opts) {
              return { eq: vi.fn().mockResolvedValue({ count: 5, error: null }) };
            }
            return {
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: [{ engagement_metrics: { likes: 50, comments: 10 } }],
                  error: null,
                }),
              })),
            };
          });
          return { select: selectFn };
        }
        if (tableName === 'analytics_snapshots') {
          const chain: Record<string, unknown> = {};
          chain.select = vi.fn().mockReturnValue(chain);
          chain.eq = vi.fn().mockReturnValue(chain);
          chain.order = vi.fn().mockResolvedValue({
            data: [
              { snapshot_date: '2024-01-10' },
              { snapshot_date: '2024-01-15' },
            ],
            error: null,
          });
          return chain;
        }
        return {};
      });

      const res = await app.request(`/analytics/characters/${mockCharacterId}/summary`, {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.totalGenerations).toBeDefined();
      expect(json.totalPosts).toBeDefined();
      expect(json.totalEngagement).toBeDefined();
      expect(json.period).toBeDefined();
    });

    it('should return 404 when character not found or wrong owner', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      }));

      const res = await app.request(`/analytics/characters/${mockCharacterId}/summary`, {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(404);
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request(`/analytics/characters/${mockCharacterId}/summary`, {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /analytics/characters/:characterId/history', () => {
    it('should return time-series data with day granularity', async () => {
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'characters') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockCharacterId },
              error: null,
            }),
          };
        }
        if (tableName === 'analytics_snapshots') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'snap-1',
                  character_id: mockCharacterId,
                  snapshot_date: '2024-01-15',
                  total_generations: 10,
                  total_posts: 5,
                  total_engagement: { likes: 100, comments: 20 },
                  avg_quality_score: 8.5,
                  top_performing_content_id: null,
                  created_at: '2024-01-15T12:00:00Z',
                },
              ],
              error: null,
            }),
          };
        }
        return {};
      });

      const res = await app.request(
        `/analytics/characters/${mockCharacterId}/history?granularity=day`,
        {
          method: 'GET',
          headers: authHeaders,
        }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.history).toBeDefined();
      expect(json.granularity).toBe('day');
    });

    it('should support week granularity aggregation', async () => {
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'characters') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockCharacterId },
              error: null,
            }),
          };
        }
        if (tableName === 'analytics_snapshots') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'snap-1',
                  character_id: mockCharacterId,
                  snapshot_date: '2024-01-15',
                  total_generations: 10,
                  total_posts: 5,
                  total_engagement: { likes: 50 },
                  avg_quality_score: 8.0,
                  top_performing_content_id: null,
                  created_at: '2024-01-15T12:00:00Z',
                },
                {
                  id: 'snap-2',
                  character_id: mockCharacterId,
                  snapshot_date: '2024-01-16',
                  total_generations: 12,
                  total_posts: 6,
                  total_engagement: { likes: 60 },
                  avg_quality_score: 8.5,
                  top_performing_content_id: null,
                  created_at: '2024-01-16T12:00:00Z',
                },
              ],
              error: null,
            }),
          };
        }
        return {};
      });

      const res = await app.request(
        `/analytics/characters/${mockCharacterId}/history?granularity=week`,
        {
          method: 'GET',
          headers: authHeaders,
        }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.granularity).toBe('week');
    });

    it('should support month granularity aggregation', async () => {
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'characters') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockCharacterId },
              error: null,
            }),
          };
        }
        if (tableName === 'analytics_snapshots') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'snap-1',
                  character_id: mockCharacterId,
                  snapshot_date: '2024-01-10',
                  total_generations: 100,
                  total_posts: 50,
                  total_engagement: { likes: 1000 },
                  avg_quality_score: 8.2,
                  top_performing_content_id: null,
                  created_at: '2024-01-10T12:00:00Z',
                },
                {
                  id: 'snap-2',
                  character_id: mockCharacterId,
                  snapshot_date: '2024-01-20',
                  total_generations: 120,
                  total_posts: 55,
                  total_engagement: { likes: 1100 },
                  avg_quality_score: 8.4,
                  top_performing_content_id: null,
                  created_at: '2024-01-20T12:00:00Z',
                },
              ],
              error: null,
            }),
          };
        }
        return {};
      });

      const res = await app.request(
        `/analytics/characters/${mockCharacterId}/history?granularity=month`,
        {
          method: 'GET',
          headers: authHeaders,
        }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.granularity).toBe('month');
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request(`/analytics/characters/${mockCharacterId}/history`, {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /analytics/overview', () => {
    it('should return overview metrics for all characters', async () => {
      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'characters') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: mockCharacterId },
                { id: '550e8400-e29b-41d4-a716-446655440001' },
              ],
              error: null,
            }),
          };
        }
        if (tableName === 'content_generations') {
          // select('*', { count }) → .in() resolves count
          // select('quality_score') → .in().not() resolves data
          const selectFn = vi.fn((_fields: string, opts?: Record<string, unknown>) => {
            if (opts && 'count' in opts) {
              return { in: vi.fn().mockResolvedValue({ count: 20, error: null }) };
            }
            const chain: Record<string, unknown> = {};
            chain.in = vi.fn().mockReturnValue(chain);
            chain.not = vi.fn().mockResolvedValue({
              data: [{ quality_score: 8.5 }, { quality_score: 9.0 }],
              error: null,
            });
            return chain;
          });
          return { select: selectFn };
        }
        if (tableName === 'social_posts') {
          // select('...', { count }) → .in() resolves count
          // select('engagement_metrics, ...') → .in().eq() resolves data
          const selectFn = vi.fn((_fields: string, opts?: Record<string, unknown>) => {
            if (opts && 'count' in opts) {
              return { in: vi.fn().mockResolvedValue({ count: 10, error: null }) };
            }
            return {
              in: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    { engagement_metrics: { likes: 50, comments: 10 } },
                    { engagement_metrics: { likes: 60, comments: 15 } },
                  ],
                  error: null,
                }),
              })),
            };
          });
          return { select: selectFn };
        }
        return {};
      });

      const res = await app.request('/analytics/overview', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.totalCharacters).toBe(2);
      expect(json.totalGenerations).toBeDefined();
      expect(json.totalPosts).toBeDefined();
      expect(json.totalEngagement).toBeDefined();
      expect(json.avgQualityScore).toBeDefined();
    });

    it('should return zero-initialized response when no characters exist', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }));

      const res = await app.request('/analytics/overview', {
        method: 'GET',
        headers: authHeaders,
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.totalCharacters).toBe(0);
      expect(json.totalGenerations).toBe(0);
      expect(json.totalPosts).toBe(0);
      expect(json.totalEngagement).toEqual({});
      expect(json.avgQualityScore).toBeNull();
    });

    it('should return 401 when unauthenticated', async () => {
      const res = await app.request('/analytics/overview', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });
  });
});
