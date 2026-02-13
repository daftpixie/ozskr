/**
 * Admin Alpha Report Routes
 * Generates aggregated alpha testing reports in JSON and markdown format.
 * All routes require admin authentication.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseServerClient } from '../supabase';
import { logger } from '@/lib/utils/logger';

function getAdminWallets(): string[] {
  return (process.env.ADMIN_WALLETS ?? '').split(',').filter(Boolean);
}

async function requireAdmin(c: Context, next: () => Promise<void>): Promise<Response | void> {
  const walletAddress = (c as unknown as { get: (key: string) => unknown }).get('walletAddress') as string;
  if (!walletAddress || !getAdminWallets().includes(walletAddress)) {
    return c.json({ error: 'Route not found', code: 'NOT_FOUND' }, 404);
  }
  await next();
}

function getServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error('Service role key not configured');
  return createSupabaseServerClient(serviceRoleKey);
}

interface ReportData {
  generatedAt: string;
  period: { start: string; end: string };
  users: { total: number; activeThisWeek: number; whitelisted: number; waitlisted: number };
  content: { totalGenerations: number; totalPublishes: number; generationsThisWeek: number };
  issues: { total: number; open: number; critical: number; resolved: number };
  costs: { totalUsd: number; aiCostUsd: number; socialCostUsd: number };
  feedback: { totalSurveys: number; avgRating: number | null };
}

const adminReport = new Hono();

adminReport.use('*', authMiddleware);
adminReport.use('*', requireAdmin);

/**
 * GET /report — Generate alpha metrics report (JSON)
 */
adminReport.get('/', async (c: Context) => {
  try {
    const report = await generateReport();
    return c.json(report);
  } catch (err) {
    logger.error('Report generation error', { error: err instanceof Error ? err.message : 'Unknown' });
    return c.json({ error: 'Failed to generate report', code: 'INTERNAL_ERROR' }, 500);
  }
});

/**
 * GET /report/markdown — Generate report as markdown text
 */
adminReport.get('/markdown', async (c: Context) => {
  try {
    const report = await generateReport();
    const md = renderMarkdown(report);
    return c.text(md);
  } catch (err) {
    logger.error('Report markdown error', { error: err instanceof Error ? err.message : 'Unknown' });
    return c.json({ error: 'Failed to generate report', code: 'INTERNAL_ERROR' }, 500);
  }
});

async function generateReport(): Promise<ReportData> {
  const supabase = getServiceClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    usersResult,
    activeUsersResult,
    whitelistResult,
    waitlistResult,
    generationsResult,
    publishesResult,
    weekGenerationsResult,
    issuesResult,
    metricsResult,
    surveysResult,
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase
      .from('content_generations')
      .select('wallet_address', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString()),
    supabase.from('alpha_whitelist').select('*', { count: 'exact', head: true }),
    supabase.from('waitlist').select('*', { count: 'exact', head: true }),
    supabase.from('content_generations').select('*', { count: 'exact', head: true }),
    supabase.from('social_posts').select('*', { count: 'exact', head: true }),
    supabase
      .from('content_generations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString()),
    supabase.from('alpha_issues').select('severity, status'),
    supabase
      .from('platform_metrics')
      .select('metric_type, value')
      .in('metric_type', ['ai_inference_cost', 'social_publish_cost']),
    supabase.from('feedback_surveys').select('rating'),
  ]);

  // Issue breakdown
  const issues = issuesResult.data ?? [];
  const openIssues = issues.filter((i) => i.status === 'open' || i.status === 'in_progress').length;
  const criticalIssues = issues.filter((i) => i.severity === 'critical').length;
  const resolvedIssues = issues.filter((i) => i.status === 'resolved').length;

  // Cost breakdown
  const metrics = metricsResult.data ?? [];
  const aiCost = metrics
    .filter((m) => m.metric_type === 'ai_inference_cost')
    .reduce((sum, m) => sum + Number(m.value), 0);
  const socialCost = metrics
    .filter((m) => m.metric_type === 'social_publish_cost')
    .reduce((sum, m) => sum + Number(m.value), 0);

  // Survey avg rating
  const surveys = surveysResult.data ?? [];
  const ratingsWithValue = surveys.filter((s) => s.rating != null);
  const avgRating =
    ratingsWithValue.length > 0
      ? Number(
          (ratingsWithValue.reduce((sum, s) => sum + Number(s.rating), 0) / ratingsWithValue.length).toFixed(1)
        )
      : null;

  return {
    generatedAt: now.toISOString(),
    period: { start: weekAgo.toISOString(), end: now.toISOString() },
    users: {
      total: usersResult.count ?? 0,
      activeThisWeek: activeUsersResult.count ?? 0,
      whitelisted: whitelistResult.count ?? 0,
      waitlisted: waitlistResult.count ?? 0,
    },
    content: {
      totalGenerations: generationsResult.count ?? 0,
      totalPublishes: publishesResult.count ?? 0,
      generationsThisWeek: weekGenerationsResult.count ?? 0,
    },
    issues: {
      total: issues.length,
      open: openIssues,
      critical: criticalIssues,
      resolved: resolvedIssues,
    },
    costs: {
      totalUsd: Number((aiCost + socialCost).toFixed(4)),
      aiCostUsd: Number(aiCost.toFixed(4)),
      socialCostUsd: Number(socialCost.toFixed(4)),
    },
    feedback: {
      totalSurveys: surveys.length,
      avgRating,
    },
  };
}

function renderMarkdown(r: ReportData): string {
  const date = new Date(r.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `# ozskr.ai Alpha Report

**Generated:** ${date}
**Period:** ${new Date(r.period.start).toLocaleDateString()} — ${new Date(r.period.end).toLocaleDateString()}

---

## Users

| Metric | Count |
|--------|-------|
| Total Users | ${r.users.total} |
| Active This Week | ${r.users.activeThisWeek} |
| Whitelisted | ${r.users.whitelisted} |
| On Waitlist | ${r.users.waitlisted} |

## Content

| Metric | Count |
|--------|-------|
| Total Generations | ${r.content.totalGenerations} |
| Generations This Week | ${r.content.generationsThisWeek} |
| Total Publishes | ${r.content.totalPublishes} |

## Issues

| Metric | Count |
|--------|-------|
| Total Issues | ${r.issues.total} |
| Open / In Progress | ${r.issues.open} |
| Critical | ${r.issues.critical} |
| Resolved | ${r.issues.resolved} |

## Costs

| Service | USD |
|---------|-----|
| AI Inference | $${r.costs.aiCostUsd.toFixed(2)} |
| Social Publishing | $${r.costs.socialCostUsd.toFixed(2)} |
| **Total** | **$${r.costs.totalUsd.toFixed(2)}** |

## Feedback

| Metric | Value |
|--------|-------|
| Total Surveys | ${r.feedback.totalSurveys} |
| Average Rating | ${r.feedback.avgRating !== null ? `${r.feedback.avgRating}/5` : 'N/A'} |

---

*Report generated by ozskr.ai admin system*
`;
}

export { adminReport, generateReport, renderMarkdown };
export type { ReportData };
