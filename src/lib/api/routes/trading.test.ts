/**
 * Trading API Routes Tests
 * Comprehensive tests for all trading endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { trading } from './trading';

// Mock dependencies
vi.mock('@solana/kit', () => ({
  address: vi.fn((addr: string) => addr),
}));

// Create a factory function for mock Supabase chains
const createMockSupabaseChain = () => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
});

const mockFrom = vi.fn(() => createMockSupabaseChain());

vi.mock('../supabase', () => ({
  createAuthenticatedClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock rate limiters
vi.mock('../middleware/rate-limit', () => ({
  swapLimiter: vi.fn((c, next) => next()),
  readLimiter: vi.fn((c, next) => next()),
  quoteLimiter: vi.fn((c, next) => next()),
}));

// Mock auth middleware
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn((c, next) => {
    // Set mock auth context
    c.set('walletAddress', '7fUAJdStEuGbc3sM84cKRL6yYaaSstyLSU4ve5oovLS7');
    c.set('jwtToken', 'mock-jwt-token');
    return next();
  }),
}));

// Mock global fetch
global.fetch = vi.fn();

describe('Trading API Routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockClear();

    app = new Hono();
    app.route('/api/trading', trading);
  });

  describe('GET /api/trading/quote', () => {
    it('should validate input mints (reject invalid)', async () => {
      const res = await app.request('/api/trading/quote?inputMint=invalid&outputMint=valid&amount=1000000', {
        method: 'GET',
      });

      expect(res.status).toBe(400);
    });

    it('should proxy to Jupiter API on valid request', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          outputAmount: '50000000',
          priceImpact: 0.15,
          expiresAt: new Date(Date.now() + 30000).toISOString(),
        }),
      } as Response);

      const res = await app.request(
        '/api/trading/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000&slippageBps=50',
        { method: 'GET' }
      );

      expect(res.status).toBe(200);
      expect(fetch).toHaveBeenCalledWith(
        'https://lite.jup.ag/ultra/v1/order',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should return 500 when Jupiter API fails', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Jupiter API error',
      } as Response);

      const res = await app.request(
        '/api/trading/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000',
        { method: 'GET' }
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toMatchObject({
        code: 'UPSTREAM_ERROR',
      });
    });
  });

  describe('POST /api/trading/swap', () => {
    it('should create pending swap record', async () => {
      // Mock successful insert chain
      mockFrom.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            status: 'pending',
          },
          error: null,
        }),
      } as never);

      const res = await app.request('/api/trading/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          inputAmount: '1000000000',
          slippageBps: 50,
          priorityFeeLamports: '5000',
        }),
      });

      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body).toMatchObject({
        status: 'pending',
        swapId: expect.any(String),
      });
    });

    it('should validate request body with Zod', async () => {
      const res = await app.request('/api/trading/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMint: 'So11111111111111111111111111111111111111112',
          // Missing required fields
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should reject invalid amount format', async () => {
      const res = await app.request('/api/trading/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          inputAmount: '1.5', // Should be stringified bigint
          slippageBps: 50,
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/trading/history', () => {
    it('should return paginated results', async () => {
      // Mock count query
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          count: 5,
          error: null,
        }),
      } as never);

      // Mock select query
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      } as never);

      const res = await app.request('/api/trading/history?page=1&limit=20', {
        method: 'GET',
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
    });

    it('should filter by wallet (RLS isolation)', async () => {
      const mockEq = vi.fn().mockResolvedValue({ count: 0, error: null });

      // Mock count query
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: mockEq,
      } as never);

      // Mock select query (this will fail since mockEq was already called, but that's ok)
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      } as never);

      await app.request('/api/trading/history?page=1&limit=20', {
        method: 'GET',
      });

      // Verify wallet address filter was applied
      expect(mockEq).toHaveBeenCalledWith('wallet_address', expect.any(String));
    });
  });

  describe('GET /api/trading/balances', () => {
    it('should return cached balances', async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              token_mint: 'So11111111111111111111111111111111111111112',
              balance: '1000000000',
              decimals: 9,
              usd_value: '100',
              last_updated_at: new Date().toISOString(),
            },
          ],
          error: null,
        }),
      } as never);

      const res = await app.request('/api/trading/balances', {
        method: 'GET',
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('balances');
      expect(body.balances).toBeInstanceOf(Array);
    });

    it('should indicate stale cache with header', async () => {
      // Return stale data (>30s old)
      const staleTime = new Date(Date.now() - 60_000).toISOString();

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              token_mint: 'So11111111111111111111111111111111111111112',
              balance: '1000000000',
              decimals: 9,
              usd_value: '100',
              last_updated_at: staleTime,
            },
          ],
          error: null,
        }),
      } as never);

      const res = await app.request('/api/trading/balances', {
        method: 'GET',
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('X-Cache-Status')).toBe('stale');
    });
  });

  describe('POST /api/trading/watchlist', () => {
    it('should create watchlist entry', async () => {
      mockFrom.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            wallet_address: '7fUAJdStEuGbc3sM84cKRL6yYaaSstyLSU4ve5oovLS7',
            token_mint: 'So11111111111111111111111111111111111111112',
            token_symbol: 'SOL',
            token_name: 'Solana',
            added_at: new Date().toISOString(),
          },
          error: null,
        }),
      } as never);

      const res = await app.request('/api/trading/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenMint: 'So11111111111111111111111111111111111111112',
          tokenSymbol: 'SOL',
          tokenName: 'Solana',
        }),
      });

      expect(res.status).toBe(201);
    });

    it('should return 409 on duplicate', async () => {
      mockFrom.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'Unique constraint violation' },
        }),
      } as never);

      const res = await app.request('/api/trading/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenMint: 'So11111111111111111111111111111111111111112',
          tokenSymbol: 'SOL',
          tokenName: 'Solana',
        }),
      });

      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /api/trading/watchlist/:id', () => {
    it('should validate UUID format', async () => {
      const res = await app.request('/api/trading/watchlist/invalid-id', {
        method: 'DELETE',
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('should verify ownership before deleting', async () => {
      // Mock ownership verification
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: '123e4567-e89b-12d3-a456-426614174000',
          },
          error: null,
        }),
      } as never);

      // Mock delete
      mockFrom.mockReturnValueOnce({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      } as never);

      const res = await app.request('/api/trading/watchlist/123e4567-e89b-12d3-a456-426614174000', {
        method: 'DELETE',
      });

      expect(res.status).toBe(204);
    });

    it('should return 404 if item not found', async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      } as never);

      const res = await app.request('/api/trading/watchlist/123e4567-e89b-12d3-a456-426614174000', {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on quote endpoint', async () => {
      const { quoteLimiter } = await import('../middleware/rate-limit');

      // Reset mock to track calls
      vi.mocked(quoteLimiter).mockClear();

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          outputAmount: '50000000',
          priceImpact: 0.15,
          expiresAt: new Date(Date.now() + 30000).toISOString(),
        }),
      } as Response);

      await app.request(
        '/api/trading/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000000',
        { method: 'GET' }
      );

      // Verify rate limiter was called
      expect(quoteLimiter).toHaveBeenCalled();
    });

    it('should enforce rate limits on swap endpoint', async () => {
      const { swapLimiter } = await import('../middleware/rate-limit');

      vi.mocked(swapLimiter).mockClear();

      mockFrom.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'test', status: 'pending' },
          error: null,
        }),
      } as never);

      await app.request('/api/trading/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          inputAmount: '1000000000',
          slippageBps: 50,
        }),
      });

      expect(swapLimiter).toHaveBeenCalled();
    });
  });
});
