/**
 * $HOPE Balance Checker Tests
 * Tests for cached balance fetching via Helius and whitelist fallback
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const { mockRedisGet, mockRedisSet } = vi.hoisted(() => ({
  mockRedisGet: vi.fn(),
  mockRedisSet: vi.fn(),
}));

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(function () {
    return { get: mockRedisGet, set: mockRedisSet };
  }),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('./network-config', () => ({
  getNetworkConfig: () => ({
    network: 'devnet',
    hopeMint: 'MockHoPEMintAddress1234567890123456789012345',
    usdcMint: 'MockUSDC',
    solMint: 'So11111111111111111111111111111111111111112',
    explorerBaseUrl: 'https://solscan.io/tx',
    defaultRpcFallback: 'https://api.devnet.solana.com',
  }),
}));

// Mock @solana/kit
vi.mock('@solana/kit', () => ({
  address: vi.fn((addr: string) => addr),
  assertIsAddress: vi.fn((addr: string) => {
    if (addr.length < 32) throw new Error('Invalid address');
  }),
}));

import { getCachedHopeBalance, checkWhitelistFallback } from './hope-balance';

describe('getCachedHopeBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    process.env.HELIUS_API_KEY = 'test-helius-key';
  });

  it('throws for invalid wallet address', async () => {
    await expect(getCachedHopeBalance('short')).rejects.toThrow('Invalid wallet address');
  });

  it('returns cached balance on cache hit', async () => {
    mockRedisGet.mockResolvedValue('5000');

    const balance = await getCachedHopeBalance('11111111111111111111111111111111');
    expect(balance).toBe(5000);
    expect(mockRedisGet).toHaveBeenCalledWith('hope-balance:11111111111111111111111111111111');
  });

  it('fetches from Helius on cache miss', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');

    // Mock fetch for Helius API
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          value: [{
            account: {
              data: {
                parsed: {
                  info: {
                    tokenAmount: { uiAmount: 12500 },
                  },
                },
              },
            },
          }],
        },
      }),
    } as Response);

    const balance = await getCachedHopeBalance('11111111111111111111111111111111');
    expect(balance).toBe(12500);
    expect(mockFetch).toHaveBeenCalled();
    expect(mockRedisSet).toHaveBeenCalledWith(
      'hope-balance:11111111111111111111111111111111',
      '12500',
      { ex: 300 }
    );

    mockFetch.mockRestore();
  });

  it('returns 0 when wallet has no token account', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');

    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ result: { value: [] } }),
    } as Response);

    const balance = await getCachedHopeBalance('11111111111111111111111111111111');
    expect(balance).toBe(0);

    mockFetch.mockRestore();
  });

  it('returns 0 when HELIUS_API_KEY is not set', async () => {
    mockRedisGet.mockResolvedValue(null);
    delete process.env.HELIUS_API_KEY;

    const balance = await getCachedHopeBalance('11111111111111111111111111111111');
    expect(balance).toBe(0);
  });
});

describe('checkWhitelistFallback', () => {
  it('returns equivalent balance for ALPHA whitelist', async () => {
    const mockClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { access_tier: 'ALPHA' }, error: null }),
          }),
        }),
      }),
    };

    const result = await checkWhitelistFallback('11111111111111111111111111111111', mockClient);
    expect(result).toBe(10_000);
  });

  it('returns equivalent balance for BETA whitelist', async () => {
    const mockClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { access_tier: 'BETA' }, error: null }),
          }),
        }),
      }),
    };

    const result = await checkWhitelistFallback('11111111111111111111111111111111', mockClient);
    expect(result).toBe(5_000);
  });

  it('returns equivalent balance for EARLY_ACCESS whitelist', async () => {
    const mockClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { access_tier: 'EARLY_ACCESS' }, error: null }),
          }),
        }),
      }),
    };

    const result = await checkWhitelistFallback('11111111111111111111111111111111', mockClient);
    expect(result).toBe(1_000);
  });

  it('returns null when wallet not in whitelist', async () => {
    const mockClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    };

    const result = await checkWhitelistFallback('11111111111111111111111111111111', mockClient);
    expect(result).toBeNull();
  });

  it('returns null on database error', async () => {
    const mockClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      }),
    };

    const result = await checkWhitelistFallback('11111111111111111111111111111111', mockClient);
    expect(result).toBeNull();
  });
});
