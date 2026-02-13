/**
 * Feedback Routes Tests
 * Tests for authenticated feedback submission endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('../supabase', () => ({
  createSupabaseClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock auth middleware to attach walletAddress
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set('walletAddress', 'TestWallet123456789012345678901234');
    await next();
  }),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { feedback } from './feedback';

describe('Feedback Routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/feedback', feedback);
    mockInsert.mockResolvedValue({ error: null });
  });

  describe('POST /feedback', () => {
    it('should return 201 for valid feedback with rating only', async () => {
      const res = await app.request('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 4 }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.message).toBe('Feedback submitted');
      expect(mockFrom).toHaveBeenCalledWith('feedback');
      expect(mockInsert).toHaveBeenCalledWith({
        wallet_address: 'TestWallet123456789012345678901234',
        rating: 4,
        message: null,
        page_url: null,
      });
    });

    it('should return 201 for feedback with message and pageUrl', async () => {
      const res = await app.request('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 5,
          message: 'Great platform!',
          pageUrl: '/dashboard',
        }),
      });

      expect(res.status).toBe(201);
      expect(mockInsert).toHaveBeenCalledWith({
        wallet_address: 'TestWallet123456789012345678901234',
        rating: 5,
        message: 'Great platform!',
        page_url: '/dashboard',
      });
    });

    it('should return 400 for missing rating', async () => {
      const res = await app.request('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'No rating' }),
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for rating below 1', async () => {
      const res = await app.request('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 0 }),
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for rating above 5', async () => {
      const res = await app.request('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 6 }),
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 for non-integer rating', async () => {
      const res = await app.request('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 3.5 }),
      });

      expect(res.status).toBe(400);
    });

    it('should return 500 on database error', async () => {
      mockInsert.mockResolvedValueOnce({
        error: { code: '42000', message: 'db error' },
      });

      const res = await app.request('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 3 }),
      });

      expect(res.status).toBe(500);
    });
  });
});
