/**
 * Waitlist Routes Tests
 * Tests for public waitlist signup and count endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock Supabase client
const mockInsert = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('../supabase', () => ({
  createSupabaseClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
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
    mockRpc.mockResolvedValue({ data: 42, error: null });
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
  });

  describe('GET /waitlist/count', () => {
    it('should return count from rpc', async () => {
      const res = await app.request('/waitlist/count', { method: 'GET' });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.count).toBe(42);
      expect(mockRpc).toHaveBeenCalledWith('get_waitlist_count');
    });

    it('should return 0 on rpc error', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'rpc error' },
      });

      const res = await app.request('/waitlist/count', { method: 'GET' });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.count).toBe(0);
    });
  });
});
