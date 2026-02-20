/**
 * Waitlist Routes Tests
 * Tests for public waitlist signup, count, status, and 500-spot cap
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock Supabase client
const mockInsert = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert, select: mockSelect }));
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('../supabase', () => ({
  createSupabaseClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock('../middleware/auth', () => ({
  optionalAuthMiddleware: vi.fn((c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { waitlist } from './waitlist';

describe('Waitlist Routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/waitlist', waitlist);

    // Default happy path mocks
    mockInsert.mockResolvedValue({ error: null });
    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_waitlist_count') return Promise.resolve({ data: 42, error: null });
      if (fn === 'get_waitlist_remaining') return Promise.resolve({ data: 458, error: null });
      return Promise.resolve({ data: null, error: null });
    });
  });

  describe('POST /waitlist', () => {
    it('should return 400 when neither email nor walletAddress provided', async () => {
      const res = await app.request('/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const res = await app.request('/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for walletAddress too short', async () => {
      const res = await app.request('/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: 'short' }),
      });

      expect(res.status).toBe(400);
    });

    it('should return 201 for valid email signup', async () => {
      const res = await app.request('/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.message).toBe('Added to waitlist');
      expect(mockFrom).toHaveBeenCalledWith('waitlist');
      expect(mockInsert).toHaveBeenCalledWith({
        email: 'test@example.com',
        wallet_address: null,
        source: null,
      });
    });

    it('should return 201 for valid wallet signup', async () => {
      const walletAddress = '11111111111111111111111111111111';

      const res = await app.request('/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });

      expect(res.status).toBe(201);
      expect(mockInsert).toHaveBeenCalledWith({
        email: null,
        wallet_address: walletAddress,
        source: null,
      });
    });

    it('should return 201 for email + wallet combo', async () => {
      const res = await app.request('/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          walletAddress: '11111111111111111111111111111111',
        }),
      });

      expect(res.status).toBe(201);
      expect(mockInsert).toHaveBeenCalledWith({
        email: 'test@example.com',
        wallet_address: '11111111111111111111111111111111',
        source: null,
      });
    });

    it('should return 200 for duplicate signup', async () => {
      mockInsert.mockResolvedValueOnce({
        error: { code: '23505', message: 'duplicate' },
      });

      const res = await app.request('/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe('Already on the waitlist');
    });

    it('should return 500 for other database errors', async () => {
      mockInsert.mockResolvedValueOnce({
        error: { code: '42000', message: 'db error' },
      });

      const res = await app.request('/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      expect(res.status).toBe(500);
    });

    it('should reject when waitlist is full (500 spots)', async () => {
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'get_waitlist_remaining') return Promise.resolve({ data: 0, error: null });
        return Promise.resolve({ data: 500, error: null });
      });

      const res = await app.request('/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe('Waitlist is full');
      expect(json.remaining).toBe(0);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should return 500 when remaining check fails', async () => {
      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'get_waitlist_remaining') {
          return Promise.resolve({ data: null, error: { message: 'rpc error' } });
        }
        return Promise.resolve({ data: 42, error: null });
      });

      const res = await app.request('/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      expect(res.status).toBe(500);
    });
  });

  describe('GET /waitlist/count', () => {
    it('should return count, total, and remaining', async () => {
      const res = await app.request('/waitlist/count', { method: 'GET' });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.count).toBe(42);
      expect(json.total).toBe(500);
      expect(json.remaining).toBe(458);
    });

    it('should return defaults on error', async () => {
      mockRpc.mockImplementation(() =>
        Promise.resolve({ data: null, error: { message: 'rpc error' } })
      );

      const res = await app.request('/waitlist/count', { method: 'GET' });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.count).toBe(0);
      expect(json.total).toBe(500);
      expect(json.remaining).toBe(500);
    });
  });

  describe('GET /waitlist/status', () => {
    beforeEach(() => {
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
      mockFrom.mockReturnValue({ insert: mockInsert, select: mockSelect });
    });

    it('should return onWaitlist: false when no wallet', async () => {
      const res = await app.request('/waitlist/status', { method: 'GET' });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.onWaitlist).toBe(false);
    });

    it('should return onWaitlist: true for wallet on list', async () => {
      // Mock the optional auth middleware to set wallet
      const { optionalAuthMiddleware } = await import('../middleware/auth');
      vi.mocked(optionalAuthMiddleware).mockImplementationOnce(async (c: unknown, next: () => Promise<void>) => {
        (c as { set: (key: string, value: string) => void }).set('walletAddress', 'TestWallet123456789012345678901234');
        await next();
      });

      mockMaybeSingle.mockResolvedValueOnce({
        data: {
          id: 'test-id',
          wallet_address: 'TestWallet123456789012345678901234',
          status: 'pending',
          created_at: '2026-02-13T00:00:00Z',
        },
        error: null,
      });

      // Re-create app to pick up new mock
      app = new Hono();
      app.route('/waitlist', waitlist);

      const res = await app.request('/waitlist/status', { method: 'GET' });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.onWaitlist).toBe(true);
      expect(json.status).toBe('pending');
    });
  });
});
