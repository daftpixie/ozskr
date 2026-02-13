/**
 * Admin Issues Routes
 * Bug triage system for alpha testing.
 * All routes require admin authentication.
 * Non-admin wallets receive 404.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
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

const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);
const StatusSchema = z.enum(['open', 'in_progress', 'resolved', 'wontfix']);

const CreateIssueSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  severity: SeveritySchema.default('medium'),
  reporterWallet: z.string().optional(),
  relatedFeature: z.string().max(100).optional(),
  surveyId: z.string().uuid().optional(),
});

const UpdateIssueSchema = z.object({
  severity: SeveritySchema.optional(),
  status: StatusSchema.optional(),
  adminNotes: z.string().max(2000).optional(),
  title: z.string().min(1).max(200).optional(),
});

const adminIssues = new Hono();

adminIssues.use('*', authMiddleware);
adminIssues.use('*', requireAdmin);

/**
 * GET /issues — List all issues with optional filters
 */
adminIssues.get('/', async (c: Context) => {
  try {
    const severity = c.req.query('severity');
    const status = c.req.query('status');
    const supabase = getServiceClient();

    let query = supabase
      .from('alpha_issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (severity) query = query.eq('severity', severity);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      logger.error('Issues list error', { error: error.message });
      return c.json({ error: 'Failed to fetch issues', code: 'DATABASE_ERROR' }, 500);
    }

    return c.json({ issues: data ?? [], total: (data ?? []).length });
  } catch (err) {
    logger.error('Issues list error', { error: err instanceof Error ? err.message : 'Unknown' });
    return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
  }
});

/**
 * GET /issues/stats — Aggregate counts by severity × status
 */
adminIssues.get('/stats', async (c: Context) => {
  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('alpha_issues')
      .select('severity, status');

    if (error) {
      logger.error('Issues stats error', { error: error.message });
      return c.json({ error: 'Failed to fetch stats', code: 'DATABASE_ERROR' }, 500);
    }

    const issues = data ?? [];
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const issue of issues) {
      bySeverity[issue.severity] = (bySeverity[issue.severity] ?? 0) + 1;
      byStatus[issue.status] = (byStatus[issue.status] ?? 0) + 1;
    }

    return c.json({
      total: issues.length,
      bySeverity,
      byStatus,
    });
  } catch (err) {
    logger.error('Issues stats error', { error: err instanceof Error ? err.message : 'Unknown' });
    return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
  }
});

/**
 * POST /issues — Create a new issue
 */
adminIssues.post('/', zValidator('json', CreateIssueSchema), async (c) => {
  const { title, description, severity, reporterWallet, relatedFeature, surveyId } = c.req.valid('json');

  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('alpha_issues')
      .insert({
        title,
        description: description || null,
        severity,
        reporter_wallet: reporterWallet || null,
        related_feature: relatedFeature || null,
        survey_id: surveyId || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('Issue create error', { error: error.message });
      return c.json({ error: 'Failed to create issue', code: 'DATABASE_ERROR' }, 500);
    }

    logger.info('Issue created', { id: data.id, severity, title: title.slice(0, 50) });
    return c.json({ issue: data }, 201);
  } catch (err) {
    logger.error('Issue create error', { error: err instanceof Error ? err.message : 'Unknown' });
    return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
  }
});

/**
 * PATCH /issues/:id — Update issue status/severity/notes
 */
adminIssues.patch('/:id', zValidator('json', UpdateIssueSchema), async (c) => {
  const id = c.req.param('id');
  const updates = c.req.valid('json');

  try {
    const supabase = getServiceClient();

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.severity) updateData.severity = updates.severity;
    if (updates.status) {
      updateData.status = updates.status;
      if (updates.status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      }
    }
    if (updates.adminNotes !== undefined) updateData.admin_notes = updates.adminNotes;
    if (updates.title) updateData.title = updates.title;

    const { data, error } = await supabase
      .from('alpha_issues')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Issue update error', { error: error.message });
      return c.json({ error: 'Failed to update issue', code: 'DATABASE_ERROR' }, 500);
    }

    return c.json({ issue: data });
  } catch (err) {
    logger.error('Issue update error', { error: err instanceof Error ? err.message : 'Unknown' });
    return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
  }
});

export { adminIssues };

/**
 * Auto-create issue from a low-rated feedback survey.
 * Called by the survey submission handler when rating is 1-2.
 */
export async function autoCreateIssueFromSurvey(params: {
  triggerPoint: string;
  response: string;
  walletAddress: string;
  surveyId?: string;
}): Promise<void> {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) return;

    const supabase = createSupabaseServerClient(serviceRoleKey);

    await supabase.from('alpha_issues').insert({
      title: `Low-rated survey: ${params.triggerPoint}`,
      description: params.response,
      severity: 'high',
      reporter_wallet: params.walletAddress,
      related_feature: params.triggerPoint,
      survey_id: params.surveyId || null,
    });

    logger.info('Auto-created issue from survey', { triggerPoint: params.triggerPoint });
  } catch (err) {
    logger.error('Failed to auto-create issue from survey', {
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }
}
