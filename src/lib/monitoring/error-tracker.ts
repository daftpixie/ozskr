/**
 * Error Tracker
 * Middleware and utilities for tracking API errors per endpoint.
 * Stores hourly error/request counts in Upstash Redis for rate calculation.
 */

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/utils/logger';

/** Redis key helpers with hourly TTL bucketing */
function getHourKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}:${String(now.getUTCHours()).padStart(2, '0')}`;
}

function errorKey(path: string): string {
  return `ozskr:errors:${getHourKey()}:${path}`;
}

function requestKey(path: string): string {
  return `ozskr:requests:${getHourKey()}:${path}`;
}

const HOUR_TTL = 7200; // 2 hours — covers current + previous hour for rolling window

/** Get a Redis client, returns null if env vars are missing */
function getRedis(): InstanceType<typeof Redis> | null {
  try {
    return Redis.fromEnv();
  } catch {
    return null;
  }
}

/** Increment a Redis counter with TTL */
async function incrementCounter(key: string): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await redis.incr(key);
    await redis.expire(key, HOUR_TTL);
  } catch {
    // Graceful degradation — tracking failure should never break requests
  }
}

/**
 * Error tracking middleware
 * Counts total requests and errors per endpoint path in Redis.
 * Runs after the handler so it can inspect response status.
 */
export const errorTrackingMiddleware = createMiddleware(async (c: Context, next) => {
  const path = c.req.path;

  await next();

  // Fire-and-forget — don't block the response
  const status = c.res.status;
  incrementCounter(requestKey(path)).catch(() => {});

  if (status >= 500) {
    incrementCounter(errorKey(path)).catch(() => {});
    logger.warn('API error tracked', { path, status });
  }
});

/** Error rate for a single endpoint over the current hour */
export interface EndpointErrorRate {
  path: string;
  errors: number;
  requests: number;
  errorRate: number;
}

/**
 * Get error rates for all tracked endpoints in the current hour.
 * Scans Redis for keys matching the current hour bucket.
 */
export async function getErrorRates(): Promise<EndpointErrorRate[]> {
  const redis = getRedis();
  if (!redis) return [];

  const hourKey = getHourKey();

  // Scan for all error keys in the current hour
  const errorPattern = `ozskr:errors:${hourKey}:*`;
  const requestPattern = `ozskr:requests:${hourKey}:*`;

  const [errorKeys, requestKeys] = await Promise.all([
    scanKeys(redis, errorPattern),
    scanKeys(redis, requestPattern),
  ]);

  // Collect all unique paths
  const paths = new Set<string>();
  const prefix = `ozskr:errors:${hourKey}:`;
  const reqPrefix = `ozskr:requests:${hourKey}:`;
  for (const k of errorKeys) paths.add(k.slice(prefix.length));
  for (const k of requestKeys) paths.add(k.slice(reqPrefix.length));

  const rates: EndpointErrorRate[] = [];
  for (const path of paths) {
    const [errors, requests] = await Promise.all([
      redis.get<number>(errorKey(path)).then(v => v ?? 0),
      redis.get<number>(requestKey(path)).then(v => v ?? 0),
    ]);
    rates.push({
      path,
      errors,
      requests,
      errorRate: requests > 0 ? errors / requests : 0,
    });
  }

  return rates.sort((a, b) => b.errorRate - a.errorRate);
}

/** Scan Redis keys matching a pattern */
async function scanKeys(redis: InstanceType<typeof Redis>, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, { match: pattern, count: 100 });
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');
  return keys;
}
