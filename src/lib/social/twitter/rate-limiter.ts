/**
 * Twitter Rate Limiter
 * Queues requests on 429, exponential backoff with jitter,
 * respects Retry-After headers from Twitter API.
 *
 * Strategy:
 *   - On 429: wait for Retry-After seconds (or exponential backoff)
 *   - Max 3 retries per request
 *   - Jitter: +-25% to prevent thundering herd
 *   - Tracks rate limit state from response headers
 */

import { logger } from '@/lib/utils/logger';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 60_000;

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfterMs?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Calculate backoff delay with jitter
 */
const calculateBackoff = (attempt: number, retryAfterMs?: number): number => {
  if (retryAfterMs && retryAfterMs > 0) {
    // Use server-specified delay with small jitter
    const jitter = retryAfterMs * 0.1 * Math.random();
    return Math.min(retryAfterMs + jitter, MAX_DELAY_MS);
  }

  // Exponential backoff: 1s, 2s, 4s...
  const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attempt);
  // Add +-25% jitter
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.min(exponentialDelay + jitter, MAX_DELAY_MS);
};

/**
 * Parse Retry-After header value (seconds or HTTP-date)
 */
const parseRetryAfter = (response: Response): number | undefined => {
  const header = response.headers.get('retry-after');
  if (!header) return undefined;

  // Try as number of seconds
  const seconds = Number(header);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  // Try as HTTP-date
  const date = new Date(header);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return undefined;
};

/**
 * Sleep for a given number of milliseconds
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch with automatic retry on 429 (rate limit) responses.
 *
 * Uses exponential backoff with jitter. Respects Twitter's Retry-After header.
 * Non-429 errors are thrown immediately.
 *
 * @param url - Request URL
 * @param init - Fetch init options (headers, method, body, etc.)
 * @returns Response from a successful attempt
 * @throws RateLimitError if all retries are exhausted
 * @throws Original error for non-429 failures
 */
export const rateLimitedFetch = async (
  url: string,
  init?: RequestInit
): Promise<Response> => {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, init);

    if (response.status !== 429) {
      return response;
    }

    // Rate limited
    if (attempt === MAX_RETRIES) {
      const retryAfterMs = parseRetryAfter(response);
      logger.error('Twitter rate limit exhausted after max retries', {
        url,
        attempts: attempt + 1,
        retryAfterMs,
      });
      throw new RateLimitError(
        `Twitter rate limit exceeded after ${MAX_RETRIES + 1} attempts`,
        retryAfterMs
      );
    }

    const retryAfterMs = parseRetryAfter(response);
    const delay = calculateBackoff(attempt, retryAfterMs);

    logger.warn('Twitter rate limited, backing off', {
      url,
      attempt: attempt + 1,
      delayMs: Math.round(delay),
      retryAfterMs,
    });

    await sleep(delay);
  }

  // Unreachable, but TypeScript needs it
  throw new RateLimitError('Unexpected rate limit loop exit');
};
