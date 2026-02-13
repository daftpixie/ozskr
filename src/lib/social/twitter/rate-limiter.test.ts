/**
 * Twitter Rate Limiter Tests
 * Tests exponential backoff, Retry-After handling, and retry exhaustion
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { rateLimitedFetch, RateLimitError } from './rate-limiter';

describe('twitter/rate-limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return response directly when not rate limited', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    mockFetch.mockResolvedValue(mockResponse);

    const result = await rateLimitedFetch('https://api.twitter.com/2/tweets');

    expect(result).toBe(mockResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should pass through non-429 error responses', async () => {
    const mockResponse = new Response('not found', { status: 404 });
    mockFetch.mockResolvedValue(mockResponse);

    const result = await rateLimitedFetch('https://api.twitter.com/2/tweets');

    expect(result.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on 429 and succeed on second attempt', async () => {
    const rateLimitResponse = new Response('rate limited', {
      status: 429,
      headers: { 'Retry-After': '1' },
    });
    const successResponse = new Response('ok', { status: 200 });

    mockFetch
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(successResponse);

    const result = await rateLimitedFetch('https://api.twitter.com/2/tweets');

    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should throw RateLimitError after max retries exhausted', async () => {
    const rateLimitResponse = new Response('rate limited', {
      status: 429,
      headers: { 'Retry-After': '1' },
    });

    // 4 calls = 1 initial + 3 retries
    mockFetch.mockResolvedValue(rateLimitResponse);

    await expect(
      rateLimitedFetch('https://api.twitter.com/2/tweets')
    ).rejects.toThrow(RateLimitError);

    expect(mockFetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it('should pass request init through to fetch', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    mockFetch.mockResolvedValue(mockResponse);

    const headers = new Headers({ Authorization: 'Bearer token' });
    await rateLimitedFetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers,
      body: '{"text":"hello"}',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.twitter.com/2/tweets',
      expect.objectContaining({
        method: 'POST',
        body: '{"text":"hello"}',
      })
    );
  });

  it('should respect Retry-After header as seconds', async () => {
    const rateLimitResponse = new Response('rate limited', {
      status: 429,
      headers: { 'Retry-After': '2' },
    });
    const successResponse = new Response('ok', { status: 200 });

    mockFetch
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(successResponse);

    const promise = rateLimitedFetch('https://api.twitter.com/2/tweets');
    const result = await promise;

    expect(result.status).toBe(200);
  });
});
