/**
 * Admin Metrics Route Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock Supabase
const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock('../supabase', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock auth middleware to inject admin wallet
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set('walletAddress', 'AdminWallet123456789012345678901234');
    c.set('jwtToken', 'test-token');
    await next();
  }),
}));

// Mock error tracker
vi.mock('@/lib/monitoring/error-tracker', () => ({
  getErrorRates: vi.fn().mockResolvedValue([
    { path: '/api/ai/generate', errors: 3, requests: 100, errorRate: 0.03 },
    { path: '/api/trading/swap', errors: 8, requests: 50, errorRate: 0.16 },
  ]),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { adminMetrics } from './admin-metrics';

describe('Admin Metrics Routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_WALLETS = 'AdminWallet123456789012345678901234,OtherAdmin';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    app = new Hono();
    app.route('/admin', adminMetrics);
  });

  describe('GET /admin/metrics/errors', () => {
    it('should return error rates with alerts for high error endpoints', async () => {
      const res = await app.request('/admin/metrics/errors');
      expect(res.status).toBe(200);

      const json = await res.json() as { endpoints: unknown[]; alerts: unknown[] };
      expect(json.endpoints).toHaveLength(2);
      // /api/trading/swap has 16% error rate — should trigger alert
      expect(json.alerts).toHaveLength(1);
    });
  });

  describe('GET /admin/metrics/costs', () => {
    it('should return cost breakdown', async () => {
      // Mock the chained select → in → gte → order calls
      const mockOrder = vi.fn().mockResolvedValue({
        data: [
          { metric_type: 'ai_inference_cost', value: 0.05, metadata: {}, created_at: '2026-02-14T10:00:00Z' },
          { metric_type: 'social_publish_cost', value: 0.01, metadata: {}, created_at: '2026-02-14T11:00:00Z' },
        ],
        error: null,
      });
      const mockGte = vi.fn(() => ({ order: mockOrder }));
      const mockIn = vi.fn(() => ({ gte: mockGte }));
      mockSelect.mockReturnValue({ in: mockIn });

      const res = await app.request('/admin/metrics/costs');
      expect(res.status).toBe(200);

      const json = await res.json() as { totals: { ai: number; social: number; combined: number } };
      expect(json.totals.ai).toBe(0.05);
      expect(json.totals.social).toBe(0.01);
      expect(json.totals.combined).toBe(0.06);
    });
  });

  describe('GET /admin/metrics/summary', () => {
    it('should return platform summary counts', async () => {
      // Mock different table queries
      const mockInsertNoop = vi.fn().mockResolvedValue({ error: null });
      mockFrom
        .mockReturnValueOnce({ select: vi.fn().mockResolvedValue({ count: 42, error: null }), insert: mockInsertNoop })   // users
        .mockReturnValueOnce({ select: vi.fn().mockResolvedValue({ count: 156, error: null }), insert: mockInsertNoop })  // generations
        .mockReturnValueOnce({ select: vi.fn().mockResolvedValue({ count: 38, error: null }), insert: mockInsertNoop })   // posts
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { metric_type: 'ai_inference_cost', value: 1.5 },
                { metric_type: 'social_publish_cost', value: 0.3 },
              ],
              error: null,
            }),
          }),
          insert: mockInsertNoop,
        }); // metrics

      const res = await app.request('/admin/metrics/summary');
      expect(res.status).toBe(200);

      const json = await res.json() as { totalUsers: number; totalGenerations: number; totalPublishes: number; totalCostUsd: number };
      expect(json.totalUsers).toBe(42);
      expect(json.totalGenerations).toBe(156);
      expect(json.totalPublishes).toBe(38);
      expect(json.totalCostUsd).toBe(1.8);
    });
  });

  describe('admin authorization', () => {
    it('should reject non-admin wallets', async () => {
      // Override the ADMIN_WALLETS to not include the test wallet
      process.env.ADMIN_WALLETS = 'SomeOtherWallet';

      // Need to re-import to pick up new env
      // Instead, we create a fresh app and test directly
      const { authMiddleware } = await import('../middleware/auth');
      vi.mocked(authMiddleware).mockImplementationOnce(
        vi.fn(async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
          c.set('walletAddress', 'NonAdminWallet');
          c.set('jwtToken', 'test-token');
          await next();
        }) as unknown as typeof authMiddleware
      );

      const freshApp = new Hono();
      // Re-import the module to get fresh env reading
      const { adminMetrics: freshAdmin } = await import('./admin-metrics');
      freshApp.route('/admin', freshAdmin);

      const res = await freshApp.request('/admin/metrics/errors');
      expect(res.status).toBe(403);
    });
  });
});
