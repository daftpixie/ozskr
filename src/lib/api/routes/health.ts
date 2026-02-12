/**
 * Health Check Routes
 * Status endpoints for monitoring and readiness probes
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { createSupabaseServerClient } from '@/lib/api/supabase';

const health = new Hono();

// Track process start time for uptime calculation
const processStartTime = Date.now();

/**
 * GET /api/health
 * Basic health check endpoint
 */
health.get('/', (c: Context) => {
  const uptimeSeconds = Math.floor((Date.now() - processStartTime) / 1000);
  return c.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'ozskr.ai API',
      version: '0.1.0',
      uptime: uptimeSeconds,
    },
    200
  );
});

/**
 * GET /api/health/ready
 * Readiness probe with dependency checks
 * Returns 200 even if degraded (for k8s-style readiness)
 */
health.get('/ready', async (c: Context) => {
  const checks: Record<string, { status: 'ok' | 'error'; durationMs: number; error?: string }> =
    {};

  // Check Supabase connectivity
  const supabaseStart = Date.now();
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }
    const supabase = createSupabaseServerClient(serviceRoleKey);
    // Simple query to verify connectivity
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    checks.supabase = {
      status: 'ok',
      durationMs: Date.now() - supabaseStart,
    };
  } catch (error) {
    checks.supabase = {
      status: 'error',
      durationMs: Date.now() - supabaseStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Check Upstash Redis connectivity
  const redisStart = Date.now();
  try {
    // Dynamic import to handle cases where Upstash isn't configured
    const { Redis } = await import('@upstash/redis');
    const redis = Redis.fromEnv();
    await redis.ping();
    checks.redis = {
      status: 'ok',
      durationMs: Date.now() - redisStart,
    };
  } catch (error) {
    checks.redis = {
      status: 'error',
      durationMs: Date.now() - redisStart,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Determine overall status
  const hasErrors = Object.values(checks).some((check) => check.status === 'error');
  const overallStatus = hasErrors ? 'degraded' : 'ok';

  return c.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    },
    200
  );
});

export { health };
