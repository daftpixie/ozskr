/**
 * Admin Whitelist Routes Tests
 * Tests for whitelist CRUD operations and admin gating
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const { mockFrom, mockVerify } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockVerify: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('jose', () => ({
  jwtVerify: mockVerify,
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { app } from '../app';

const ADMIN_WALLET = '11111111111111111111111111111111';
const NON_ADMIN_WALLET = '22222222222222222222222222222222';
const TARGET_WALLET = '33333333333333333333333333333333';

function mockJwt(wallet: string) {
  mockVerify.mockResolvedValue({
    payload: { sub: wallet, wallet_address: wallet },
  });
}

function mockSupabaseChain(result: { data: unknown; error: unknown }) {
  return vi.fn(() => ({
    select: vi.fn(() => ({
      order: vi.fn(() => Promise.resolve(result)),
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(() => Promise.resolve(result)),
      })),
      single: vi.fn(() => Promise.resolve(result)),
    })),
    upsert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve(result)),
      })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve(result)),
    })),
  }));
}

describe('Admin Whitelist Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_WALLETS = ADMIN_WALLET;
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-verification';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  describe('admin gating', () => {
    it('returns 404 for non-admin wallets', async () => {
      mockJwt(NON_ADMIN_WALLET);

      const res = await app.request('/api/admin-whitelist', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe('NOT_FOUND');
    });

    it('returns 401 for unauthenticated requests', async () => {
      const res = await app.request('/api/admin-whitelist', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /admin/whitelist', () => {
    it('lists all whitelisted wallets', async () => {
      mockJwt(ADMIN_WALLET);
      const entries = [
        { wallet_address: TARGET_WALLET, access_tier: 'ALPHA', notes: 'Tester', added_by: ADMIN_WALLET, created_at: '2026-02-14T00:00:00Z' },
      ];
      mockFrom.mockImplementation(mockSupabaseChain({ data: entries, error: null }));

      const res = await app.request('/api/admin-whitelist', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.entries).toHaveLength(1);
      expect(body.total).toBe(1);
    });
  });

  describe('GET /admin/whitelist/:wallet', () => {
    it('returns whitelisted entry for known wallet', async () => {
      mockJwt(ADMIN_WALLET);
      mockFrom.mockImplementation(mockSupabaseChain({
        data: { wallet_address: TARGET_WALLET, access_tier: 'ALPHA', notes: 'Tester', added_by: ADMIN_WALLET, created_at: '2026-02-14T00:00:00Z' },
        error: null,
      }));

      const res = await app.request(`/api/admin-whitelist/${TARGET_WALLET}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.whitelisted).toBe(true);
      expect(body.accessTier).toBe('ALPHA');
    });

    it('returns whitelisted:false for unknown wallet', async () => {
      mockJwt(ADMIN_WALLET);
      mockFrom.mockImplementation(mockSupabaseChain({ data: null, error: null }));

      const res = await app.request(`/api/admin-whitelist/${TARGET_WALLET}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.whitelisted).toBe(false);
    });
  });

  describe('POST /admin/whitelist', () => {
    it('adds wallet to whitelist', async () => {
      mockJwt(ADMIN_WALLET);
      mockFrom.mockImplementation(mockSupabaseChain({
        data: { wallet_address: TARGET_WALLET, access_tier: 'ALPHA', notes: 'Alpha tester', added_by: ADMIN_WALLET },
        error: null,
      }));

      const res = await app.request('/api/admin-whitelist', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: TARGET_WALLET,
          accessTier: 'ALPHA',
          notes: 'Alpha tester',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.message).toBe('Wallet added to whitelist');
      expect(body.entry.accessTier).toBe('ALPHA');
    });

    it('rejects WAITLIST tier', async () => {
      mockJwt(ADMIN_WALLET);

      const res = await app.request('/api/admin-whitelist', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: TARGET_WALLET,
          accessTier: 'WAITLIST',
        }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects short wallet address', async () => {
      mockJwt(ADMIN_WALLET);

      const res = await app.request('/api/admin-whitelist', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: 'short',
          accessTier: 'ALPHA',
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /admin/whitelist/:wallet', () => {
    it('removes wallet from whitelist', async () => {
      mockJwt(ADMIN_WALLET);
      mockFrom.mockImplementation(mockSupabaseChain({ data: null, error: null }));

      const res = await app.request(`/api/admin-whitelist/${TARGET_WALLET}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe('Wallet removed from whitelist');
    });
  });
});
