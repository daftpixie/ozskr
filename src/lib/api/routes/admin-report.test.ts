/**
 * Admin Report API Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
const mockSelect = vi.fn();

vi.mock('../supabase', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

vi.stubEnv('ADMIN_WALLETS', 'AdminWallet123abc,AdminWallet456def');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');

import { Hono } from 'hono';
import { adminReport, renderMarkdown } from './admin-report';
import type { ReportData } from './admin-report';

function createApp(walletAddress: string) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    (c as unknown as { set: (key: string, value: unknown) => void }).set('walletAddress', walletAddress);
    await next();
  });
  app.route('/report', adminReport);
  return app;
}

function mockAllQueries() {
  // Each call to .from() returns the chain for that specific query
  // We return the same shape for all - the route uses count: 'exact', head: true for most
  mockFrom.mockReturnValue({
    select: mockSelect.mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      gte: vi.fn().mockReturnValue({
        // Nested for .gte().select() chains
        data: [],
        error: null,
        // For Promise resolution
        then: (fn: (v: unknown) => unknown) => Promise.resolve(fn({ data: [], error: null, count: 0 })),
      }),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
      // Direct resolution for simple .select() chains
      then: (fn: (v: unknown) => unknown) => Promise.resolve(fn({ data: [], error: null, count: 0 })),
    }),
  });

  // Override to return proper shape for all Promise.all queries
  mockFrom.mockImplementation(() => ({
    select: vi.fn().mockReturnValue({
      // For head: true count queries
      then: (fn: (v: unknown) => unknown) => Promise.resolve(fn({ data: null, error: null, count: 0 })),
      gte: vi.fn().mockReturnValue({
        then: (fn: (v: unknown) => unknown) => Promise.resolve(fn({ data: null, error: null, count: 0 })),
      }),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }));
}

describe('Admin Report API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAdmin middleware', () => {
    it('returns 404 for non-admin wallet', async () => {
      const app = createApp('NonAdminWallet999xyz');
      const res = await app.request('/report');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /report', () => {
    it('returns report JSON for admin', async () => {
      mockAllQueries();
      const app = createApp('AdminWallet123abc');
      const res = await app.request('/report');

      expect(res.status).toBe(200);
      const body = await res.json() as ReportData;
      expect(body.generatedAt).toBeDefined();
      expect(body.users).toBeDefined();
      expect(body.content).toBeDefined();
      expect(body.issues).toBeDefined();
      expect(body.costs).toBeDefined();
      expect(body.feedback).toBeDefined();
    });
  });

  describe('GET /report/markdown', () => {
    it('returns markdown text for admin', async () => {
      mockAllQueries();
      const app = createApp('AdminWallet123abc');
      const res = await app.request('/report/markdown');

      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('# ozskr.ai Alpha Report');
      expect(text).toContain('## Users');
      expect(text).toContain('## Issues');
    });
  });

  describe('renderMarkdown', () => {
    it('formats report data as markdown table', () => {
      const report: ReportData = {
        generatedAt: '2026-02-14T12:00:00Z',
        period: { start: '2026-02-07T12:00:00Z', end: '2026-02-14T12:00:00Z' },
        users: { total: 42, activeThisWeek: 15, whitelisted: 20, waitlisted: 100 },
        content: { totalGenerations: 350, totalPublishes: 80, generationsThisWeek: 50 },
        issues: { total: 12, open: 5, critical: 2, resolved: 7 },
        costs: { totalUsd: 45.5, aiCostUsd: 40.0, socialCostUsd: 5.5 },
        feedback: { totalSurveys: 25, avgRating: 4.2 },
      };

      const md = renderMarkdown(report);

      expect(md).toContain('| Total Users | 42 |');
      expect(md).toContain('| Active This Week | 15 |');
      expect(md).toContain('| Total Generations | 350 |');
      expect(md).toContain('| Critical | 2 |');
      expect(md).toContain('$40.00');
      expect(md).toContain('$5.50');
      expect(md).toContain('4.2/5');
    });

    it('handles null avg rating', () => {
      const report: ReportData = {
        generatedAt: '2026-02-14T12:00:00Z',
        period: { start: '2026-02-07T12:00:00Z', end: '2026-02-14T12:00:00Z' },
        users: { total: 0, activeThisWeek: 0, whitelisted: 0, waitlisted: 0 },
        content: { totalGenerations: 0, totalPublishes: 0, generationsThisWeek: 0 },
        issues: { total: 0, open: 0, critical: 0, resolved: 0 },
        costs: { totalUsd: 0, aiCostUsd: 0, socialCostUsd: 0 },
        feedback: { totalSurveys: 0, avgRating: null },
      };

      const md = renderMarkdown(report);
      expect(md).toContain('| Average Rating | N/A |');
    });
  });
});
