/**
 * Rate Limiting Middleware
 * Distributed rate limiting using Upstash Redis
 *
 * IMPORTANT: Install these packages before use:
 * pnpm add @upstash/ratelimit @upstash/redis
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';

// Type definitions for Upstash packages (will be installed)
type RatelimitConfig = {
  redis: unknown;
  limiter: unknown;
  prefix?: string;
};

type RatelimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

/**
 * Create a rate limiter with the given configuration
 * @param requestsPerWindow - Number of requests allowed per window
 * @param windowSeconds - Window size in seconds (60 = 1 minute, 3600 = 1 hour)
 * @param prefix - Optional prefix for Redis keys
 */
export function createRateLimiter(
  requestsPerWindow: number,
  windowSeconds: number,
  prefix = 'ozskr'
) {
  // Import dynamically to avoid errors if packages aren't installed yet
  let Ratelimit: unknown;
  let Redis: unknown;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ratelimitModule = require('@upstash/ratelimit');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const redisModule = require('@upstash/redis');

    Ratelimit = ratelimitModule.Ratelimit;
    Redis = redisModule.Redis;
  } catch {
    // Graceful degradation if packages aren't installed
    return createMiddleware(async (_c: Context, next) => {
      await next();
    });
  }

  // Create Redis client from environment variables
  const redis = (Redis as { fromEnv: () => unknown }).fromEnv();

  // Create rate limiter with sliding window
  const limiter = new (Ratelimit as {
    new (config: RatelimitConfig): {
      limit: (identifier: string) => Promise<RatelimitResult>;
    };
  })({
    redis,
    limiter: (Ratelimit as { slidingWindow: (requests: number, window: string) => unknown })
      .slidingWindow(requestsPerWindow, `${windowSeconds} s`),
    prefix: `${prefix}:ratelimit`,
  });

  return createMiddleware(async (c: Context, next) => {
    // Extract wallet address from auth context
    const walletAddress = c.get('walletAddress');

    if (typeof walletAddress !== 'string' || !walletAddress) {
      // No wallet address means auth middleware hasn't run — let it fail downstream
      await next();
      return;
    }

    try {
      // Check rate limit
      const result = await limiter.limit(walletAddress);

      // Add rate limit headers
      c.header('X-RateLimit-Limit', result.limit.toString());
      c.header('X-RateLimit-Remaining', result.remaining.toString());
      c.header('X-RateLimit-Reset', result.reset.toString());

      if (!result.success) {
        // Calculate retry-after in seconds
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
        c.header('Retry-After', retryAfter.toString());

        return c.json(
          {
            error: `Rate limit exceeded. Maximum ${requestsPerWindow} requests per ${windowSeconds}s.`,
            code: 'RATE_LIMITED',
            retryAfter,
          },
          429
        );
      }

      await next();
    } catch (error) {
      // Graceful degradation: if Redis is unavailable, allow the request
      void error; // acknowledged — structured logging deferred to Phase 4
      await next();
    }
  });
}

/**
 * Named rate limiters for different endpoint types
 */

// Swap operations: 10 requests per minute per wallet
export const swapLimiter = createRateLimiter(10, 60, 'ozskr:swap');

// AI content generation: 30 requests per hour per wallet
export const generationLimiter = createRateLimiter(30, 3600, 'ozskr:generation');

// Read operations: 100 requests per minute per wallet
export const readLimiter = createRateLimiter(100, 60, 'ozskr:read');

// Quote operations: 60 requests per minute per wallet (higher for quotes)
export const quoteLimiter = createRateLimiter(60, 60, 'ozskr:quote');
