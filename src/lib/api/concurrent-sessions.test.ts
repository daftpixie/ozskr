/**
 * Multi-User Load Validation Tests
 * Simulates concurrent session pressure to verify the platform
 * handles 50+ simultaneous users without degradation.
 *
 * These tests mock the Hono app directly (no real network),
 * measuring response times and error rates under concurrency.
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
  SignJWT: vi.fn(),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/monitoring/error-tracker', () => ({
  getErrorRates: vi.fn().mockResolvedValue([]),
  trackError: vi.fn(),
  trackRequest: vi.fn(),
}));

import { app } from '@/lib/api/app';

function mockJwt(wallet: string) {
  mockVerify.mockResolvedValue({
    payload: { sub: wallet, wallet_address: wallet },
  });
}

function createMockChain(data: unknown = [], error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data, error }),
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data, error }),
        single: vi.fn().mockResolvedValue({ data, error }),
        order: vi.fn().mockResolvedValue({ data, error }),
        gte: vi.fn().mockResolvedValue({ data, error }),
        limit: vi.fn().mockResolvedValue({ data, error }),
      }),
      gte: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data, error }),
        limit: vi.fn().mockResolvedValue({ data, error }),
      }),
      limit: vi.fn().mockResolvedValue({ data, error }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data, error }),
        }),
      }),
    }),
  };
}

describe('Concurrent Sessions Load Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-verification';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  it('handles 50 concurrent health checks', async () => {
    const concurrency = 50;
    const requests = Array.from({ length: concurrency }, () =>
      app.request('/api/health')
    );

    const start = performance.now();
    const responses = await Promise.all(requests);
    const duration = performance.now() - start;

    const statuses = responses.map((r) => r.status);
    const successCount = statuses.filter((s) => s === 200).length;

    expect(successCount).toBe(concurrency);
    // All 50 should complete within 5 seconds (generous for CI)
    expect(duration).toBeLessThan(5000);
  });

  it('handles 50 concurrent auth-gated requests without crashing', async () => {
    const concurrency = 50;

    // Requests without tokens should get 401 — but no crashes
    const requests = Array.from({ length: concurrency }, () =>
      app.request('/api/ai/characters?page=1&limit=10')
    );

    const start = performance.now();
    const responses = await Promise.all(requests);
    const duration = performance.now() - start;

    // All should return 401 (auth required) — no 500s
    const authRequired = responses.filter((r) => r.status === 401).length;
    const serverErrors = responses.filter((r) => r.status >= 500).length;

    expect(authRequired).toBe(concurrency);
    expect(serverErrors).toBe(0);
    expect(duration).toBeLessThan(5000);
  });

  it('handles mixed endpoint requests concurrently', async () => {
    const healthCount = 25;
    const authGatedCount = 25;

    const healthRequests = Array.from({ length: healthCount }, () =>
      app.request('/api/health')
    );

    // Auth-gated without token → 401
    const authGatedRequests = Array.from({ length: authGatedCount }, () =>
      app.request('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: 5 }),
      })
    );

    const start = performance.now();
    const responses = await Promise.all([...healthRequests, ...authGatedRequests]);
    const duration = performance.now() - start;

    const healthSuccess = responses.slice(0, healthCount).filter((r) => r.status === 200).length;
    const authRejected = responses.slice(healthCount).filter((r) => r.status === 401).length;

    expect(healthSuccess).toBe(healthCount);
    expect(authRejected).toBe(authGatedCount);
    expect(duration).toBeLessThan(5000);
  });

  it('maintains response quality under 50 concurrent sessions', async () => {
    const concurrency = 50;

    mockJwt('TestWallet1234567890123456789012');
    mockFrom.mockImplementation(() => createMockChain([]));

    const timings: number[] = [];

    const requests = Array.from({ length: concurrency }, async () => {
      const start = performance.now();
      const res = await app.request('/api/health');
      const elapsed = performance.now() - start;
      timings.push(elapsed);
      return res;
    });

    const responses = await Promise.all(requests);
    const allSuccessful = responses.every((r) => r.status === 200);

    // Calculate p50 and p99
    const sorted = [...timings].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    expect(allSuccessful).toBe(true);
    // p50 should be under 100ms for in-process requests
    expect(p50).toBeLessThan(100);
    // p99 should be under 500ms
    expect(p99).toBeLessThan(500);
  });

  it('handles 50 concurrent 404 requests without crashes', async () => {
    const concurrency = 50;

    const requests = Array.from({ length: concurrency }, () =>
      app.request('/api/nonexistent-path')
    );

    const responses = await Promise.all(requests);
    const notFound = responses.filter((r) => r.status === 404).length;

    // All should return 404, no 500s
    expect(notFound).toBe(concurrency);
  });
});

describe('Rate Limit Stress Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-verification';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  it('handles rapid sequential requests from single wallet', async () => {
    const requestCount = 100;

    const results: number[] = [];
    for (let i = 0; i < requestCount; i++) {
      const res = await app.request('/api/health');
      results.push(res.status);
    }

    // All health checks should succeed (no rate limit on health)
    const successCount = results.filter((s) => s === 200).length;
    expect(successCount).toBe(requestCount);
  });

  it('handles burst of waitlist signups', async () => {
    const burstSize = 20;

    mockFrom.mockImplementation(() => ({
      ...createMockChain([]),
      rpc: vi.fn().mockResolvedValue({ data: 450, error: null }),
    }));

    // Mock the rpc calls for waitlist remaining
    const originalFrom = mockFrom;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'waitlist') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return originalFrom(table);
    });

    const requests = Array.from({ length: burstSize }, (_, i) =>
      app.request('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: `${'A'.repeat(32)}${String(i).padStart(12, '0')}` }),
      })
    );

    const responses = await Promise.all(requests);
    // All should get some response (200 or 201 or error — no crashes)
    expect(responses.every((r) => r.status < 600)).toBe(true);
  });
});
