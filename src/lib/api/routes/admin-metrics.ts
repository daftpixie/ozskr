/**
 * Admin Metrics Routes
 * Protected admin-only endpoints for platform monitoring.
 * Verifies wallet is in ADMIN_WALLETS list.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseServerClient } from '../supabase';
import { getErrorRates } from '@/lib/monitoring/error-tracker';
import { logger } from '@/lib/utils/logger';

function getAdminWallets(): string[] {
  return (process.env.ADMIN_WALLETS ?? '').split(',').filter(Boolean);
}

/** Admin gate middleware — rejects non-admin wallets */
async function requireAdmin(c: Context, next: () => Promise<void>): Promise<Response | void> {
  const walletAddress = (c as unknown as { get: (key: string) => unknown }).get('walletAddress') as string;
  if (!walletAddress || !getAdminWallets().includes(walletAddress)) {
    return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
  }
  await next();
}

const adminMetrics = new Hono();

// All admin routes require auth + admin check
adminMetrics.use('*', authMiddleware);
adminMetrics.use('*', requireAdmin);

/**
 * GET /admin/metrics/errors
 * Error rates by endpoint for the current hour
 */
adminMetrics.get('/metrics/errors', async (c: Context) => {
  try {
    const rates = await getErrorRates();
    const alertThreshold = 0.05; // 5%
    const alerts = rates.filter(r => r.errorRate > alertThreshold);

    return c.json({
      window: 'current_hour',
      endpoints: rates,
      alerts: alerts.map(a => ({
        path: a.path,
        errorRate: `${(a.errorRate * 100).toFixed(1)}%`,
        message: `Error rate ${(a.errorRate * 100).toFixed(1)}% exceeds ${alertThreshold * 100}% threshold`,
      })),
    });
  } catch (err) {
    logger.error('Failed to fetch error rates', { error: err instanceof Error ? err.message : 'Unknown' });
    return c.json({ error: 'Failed to fetch error rates', code: 'INTERNAL_ERROR' }, 500);
  }
});

/**
 * GET /admin/metrics/costs
 * Cost breakdown by service for the last 7 days
 */
adminMetrics.get('/metrics/costs', async (c: Context) => {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return c.json({ error: 'Service role key not configured', code: 'INTERNAL_ERROR' }, 500);
    }
    const supabase = createSupabaseServerClient(serviceRoleKey);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('platform_metrics')
      .select('metric_type, value, metadata, created_at')
      .in('metric_type', ['ai_inference_cost', 'social_publish_cost'])
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to query cost metrics', { error: error.message });
      return c.json({ error: 'Database query failed', code: 'DATABASE_ERROR' }, 500);
    }

    // Aggregate by type
    const aiCosts = (data ?? []).filter(d => d.metric_type === 'ai_inference_cost');
    const socialCosts = (data ?? []).filter(d => d.metric_type === 'social_publish_cost');

    const totalAiCost = aiCosts.reduce((sum, d) => sum + Number(d.value), 0);
    const totalSocialCost = socialCosts.reduce((sum, d) => sum + Number(d.value), 0);

    // Daily breakdown
    const dailyMap = new Map<string, { ai: number; social: number }>();
    for (const row of data ?? []) {
      const day = new Date(row.created_at as string).toISOString().slice(0, 10);
      const entry = dailyMap.get(day) ?? { ai: 0, social: 0 };
      if (row.metric_type === 'ai_inference_cost') entry.ai += Number(row.value);
      else entry.social += Number(row.value);
      dailyMap.set(day, entry);
    }

    const dailyBreakdown = Array.from(dailyMap.entries())
      .map(([date, costs]) => ({ date, ...costs, total: costs.ai + costs.social }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Check for cost spike (2x daily average)
    const avgDailyCost = dailyBreakdown.length > 1
      ? dailyBreakdown.slice(1).reduce((sum, d) => sum + d.total, 0) / (dailyBreakdown.length - 1)
      : 0;
    const todayCost = dailyBreakdown[0]?.total ?? 0;
    const costSpike = avgDailyCost > 0 && todayCost > avgDailyCost * 2;

    return c.json({
      window: 'last_7_days',
      totals: {
        ai: Number(totalAiCost.toFixed(4)),
        social: Number(totalSocialCost.toFixed(4)),
        combined: Number((totalAiCost + totalSocialCost).toFixed(4)),
      },
      daily: dailyBreakdown,
      alerts: costSpike
        ? [{ message: `Today's cost ($${todayCost.toFixed(2)}) is >2x the daily average ($${avgDailyCost.toFixed(2)})` }]
        : [],
    });
  } catch (err) {
    logger.error('Failed to fetch cost metrics', { error: err instanceof Error ? err.message : 'Unknown' });
    return c.json({ error: 'Failed to fetch cost metrics', code: 'INTERNAL_ERROR' }, 500);
  }
});

/**
 * GET /admin/metrics/summary
 * Platform-wide summary: users, generations, publishes, costs
 */
adminMetrics.get('/metrics/summary', async (c: Context) => {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return c.json({ error: 'Service role key not configured', code: 'INTERNAL_ERROR' }, 500);
    }
    const supabase = createSupabaseServerClient(serviceRoleKey);

    const [usersResult, generationsResult, postsResult, metricsResult] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('content_generations').select('*', { count: 'exact', head: true }),
      supabase.from('social_posts').select('*', { count: 'exact', head: true }),
      supabase
        .from('platform_metrics')
        .select('metric_type, value')
        .in('metric_type', ['ai_inference_cost', 'social_publish_cost']),
    ]);

    const totalCost = (metricsResult.data ?? []).reduce((sum, d) => sum + Number(d.value), 0);

    return c.json({
      totalUsers: usersResult.count ?? 0,
      totalGenerations: generationsResult.count ?? 0,
      totalPublishes: postsResult.count ?? 0,
      totalCostUsd: Number(totalCost.toFixed(4)),
    });
  } catch (err) {
    logger.error('Failed to fetch summary metrics', { error: err instanceof Error ? err.message : 'Unknown' });
    return c.json({ error: 'Failed to fetch summary', code: 'INTERNAL_ERROR' }, 500);
  }
});

export { adminMetrics };
