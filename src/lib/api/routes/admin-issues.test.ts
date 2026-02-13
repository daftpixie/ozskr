/**
 * Admin Issues API Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();

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

// Mock auth middleware
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

// Set admin wallet env
vi.stubEnv('ADMIN_WALLETS', 'AdminWallet123abc,AdminWallet456def');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');

import { Hono } from 'hono';
import { adminIssues, autoCreateIssueFromSurvey } from './admin-issues';

function createApp(walletAddress: string) {
  const app = new Hono();
  // Simulate wallet address being set by auth middleware
  app.use('*', async (c, next) => {
    (c as unknown as { set: (key: string, value: unknown) => void }).set('walletAddress', walletAddress);
    await next();
  });
  app.route('/issues', adminIssues);
  return app;
}

describe('Admin Issues API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAdmin middleware', () => {
    it('returns 404 for non-admin wallet', async () => {
      const app = createApp('NonAdminWallet999xyz');
      const res = await app.request('/issues');
      expect(res.status).toBe(404);
    });

    it('allows admin wallet through', async () => {
      mockFrom.mockReturnValue({
        select: mockSelect.mockReturnValue({
          order: mockOrder.mockResolvedValue({ data: [], error: null }),
        }),
      });

      const app = createApp('AdminWallet123abc');
      const res = await app.request('/issues');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /issues', () => {
    it('returns issues list', async () => {
      const mockIssues = [
        { id: '1', title: 'Bug A', severity: 'high', status: 'open' },
        { id: '2', title: 'Bug B', severity: 'low', status: 'resolved' },
      ];

      mockFrom.mockReturnValue({
        select: mockSelect.mockReturnValue({
          order: mockOrder.mockResolvedValue({ data: mockIssues, error: null }),
        }),
      });

      const app = createApp('AdminWallet123abc');
      const res = await app.request('/issues');
      const body = await res.json() as { issues: unknown[]; total: number };

      expect(res.status).toBe(200);
      expect(body.issues).toHaveLength(2);
      expect(body.total).toBe(2);
    });

    it('filters by severity query param', async () => {
      mockFrom.mockReturnValue({
        select: mockSelect.mockReturnValue({
          order: mockOrder.mockReturnValue({
            eq: mockEq.mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const app = createApp('AdminWallet123abc');
      await app.request('/issues?severity=critical');

      expect(mockEq).toHaveBeenCalledWith('severity', 'critical');
    });

    it('filters by status query param', async () => {
      mockFrom.mockReturnValue({
        select: mockSelect.mockReturnValue({
          order: mockOrder.mockReturnValue({
            eq: mockEq.mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const app = createApp('AdminWallet123abc');
      await app.request('/issues?status=open');

      expect(mockEq).toHaveBeenCalledWith('status', 'open');
    });

    it('returns 500 on database error', async () => {
      mockFrom.mockReturnValue({
        select: mockSelect.mockReturnValue({
          order: mockOrder.mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      });

      const app = createApp('AdminWallet123abc');
      const res = await app.request('/issues');

      expect(res.status).toBe(500);
      const body = await res.json() as { code: string };
      expect(body.code).toBe('DATABASE_ERROR');
    });
  });

  describe('GET /issues/stats', () => {
    it('returns aggregated stats', async () => {
      const mockIssues = [
        { severity: 'high', status: 'open' },
        { severity: 'high', status: 'open' },
        { severity: 'low', status: 'resolved' },
      ];

      mockFrom.mockReturnValue({
        select: mockSelect.mockResolvedValue({ data: mockIssues, error: null }),
      });

      const app = createApp('AdminWallet123abc');
      const res = await app.request('/issues/stats');
      const body = await res.json() as IssueStats;

      expect(res.status).toBe(200);
      expect(body.total).toBe(3);
      expect(body.bySeverity).toEqual({ high: 2, low: 1 });
      expect(body.byStatus).toEqual({ open: 2, resolved: 1 });
    });
  });

  describe('POST /issues', () => {
    it('creates a new issue', async () => {
      const created = { id: 'new-id', title: 'Test bug', severity: 'medium' };

      mockFrom.mockReturnValue({
        insert: mockInsert.mockReturnValue({
          select: mockSelect.mockReturnValue({
            single: mockSingle.mockResolvedValue({ data: created, error: null }),
          }),
        }),
      });

      const app = createApp('AdminWallet123abc');
      const res = await app.request('/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test bug' }),
      });

      expect(res.status).toBe(201);
      const body = await res.json() as { issue: { id: string } };
      expect(body.issue.id).toBe('new-id');
    });

    it('validates required title', async () => {
      const app = createApp('AdminWallet123abc');
      const res = await app.request('/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it('validates title max length', async () => {
      const app = createApp('AdminWallet123abc');
      const res = await app.request('/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'x'.repeat(201) }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /issues/:id', () => {
    it('updates issue status', async () => {
      const updated = { id: 'issue-1', status: 'in_progress' };

      mockFrom.mockReturnValue({
        update: mockUpdate.mockReturnValue({
          eq: mockEq.mockReturnValue({
            select: mockSelect.mockReturnValue({
              single: mockSingle.mockResolvedValue({ data: updated, error: null }),
            }),
          }),
        }),
      });

      const app = createApp('AdminWallet123abc');
      const res = await app.request('/issues/issue-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json() as { issue: { status: string } };
      expect(body.issue.status).toBe('in_progress');
    });

    it('sets resolved_at when resolving', async () => {
      mockFrom.mockReturnValue({
        update: mockUpdate.mockReturnValue({
          eq: mockEq.mockReturnValue({
            select: mockSelect.mockReturnValue({
              single: mockSingle.mockResolvedValue({ data: { id: '1' }, error: null }),
            }),
          }),
        }),
      });

      const app = createApp('AdminWallet123abc');
      await app.request('/issues/issue-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });

      // Check that update was called with resolved_at
      const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
      expect(updateArg.resolved_at).toBeDefined();
      expect(updateArg.status).toBe('resolved');
    });

    it('validates severity enum', async () => {
      const app = createApp('AdminWallet123abc');
      const res = await app.request('/issues/issue-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ severity: 'ultra-critical' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('autoCreateIssueFromSurvey', () => {
    it('creates issue from survey params', async () => {
      mockFrom.mockReturnValue({
        insert: mockInsert.mockResolvedValue({ error: null }),
      });

      await autoCreateIssueFromSurvey({
        triggerPoint: 'first_generation',
        response: 'The generation was terrible',
        walletAddress: 'UserWallet123',
        surveyId: 'survey-uuid-1',
      });

      expect(mockFrom).toHaveBeenCalledWith('alpha_issues');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Low-rated survey: first_generation',
          severity: 'high',
          reporter_wallet: 'UserWallet123',
          survey_id: 'survey-uuid-1',
        })
      );
    });

    it('does not throw on missing service key', async () => {
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
      await expect(
        autoCreateIssueFromSurvey({
          triggerPoint: 'first_publish',
          response: 'Bad experience',
          walletAddress: 'UserWallet123',
        })
      ).resolves.toBeUndefined();
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    });

    it('does not throw on database error', async () => {
      mockFrom.mockReturnValue({
        insert: mockInsert.mockRejectedValue(new Error('DB down')),
      });

      await expect(
        autoCreateIssueFromSurvey({
          triggerPoint: 'weekly_checkin',
          response: 'Things are broken',
          walletAddress: 'UserWallet123',
        })
      ).resolves.toBeUndefined();
    });
  });
});

interface IssueStats {
  total: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
}
