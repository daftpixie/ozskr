/**
 * Analytics Routes
 * Agent performance and engagement metrics
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  AnalyticsSummaryResponseSchema,
  AnalyticsHistoryQuerySchema,
} from '@/types/social';
import { UuidSchema } from '@/types/schemas';
import { authMiddleware } from '../middleware/auth';
import { createAuthenticatedClient } from '../supabase';
import type { AnalyticsSnapshot } from '@/types/database';

type AnalyticsEnv = {
  Variables: {
    walletAddress: string;
    jwtToken: string;
  };
};

const analytics = new Hono<AnalyticsEnv>();

// All analytics routes require authentication
analytics.use('/*', authMiddleware);

/**
 * Helper to extract auth context from Hono context with type narrowing
 */
function getAuthContext(c: { get: (key: string) => unknown }) {
  const walletAddress = c.get('walletAddress');
  const jwtToken = c.get('jwtToken');
  if (typeof walletAddress !== 'string' || typeof jwtToken !== 'string') {
    return null;
  }
  return { walletAddress, jwtToken };
}

/**
 * Helper to map database AnalyticsSnapshot to API response
 */
function mapSnapshotToResponse(snapshot: AnalyticsSnapshot) {
  return {
    id: snapshot.id,
    characterId: snapshot.character_id,
    snapshotDate: snapshot.snapshot_date,
    totalGenerations: snapshot.total_generations,
    totalPosts: snapshot.total_posts,
    totalEngagement: snapshot.total_engagement,
    avgQualityScore: snapshot.avg_quality_score,
    topPerformingContentId: snapshot.top_performing_content_id,
    createdAt: snapshot.created_at,
  };
}

/**
 * GET /api/analytics/characters/:characterId/summary
 * Get aggregated performance data for a character
 */
analytics.get('/characters/:characterId/summary', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const characterId = c.req.param('characterId');

  // Validate UUID format
  const validationResult = UuidSchema.safeParse(characterId);
  if (!validationResult.success) {
    return c.json(
      { error: 'Invalid character ID format', code: 'VALIDATION_ERROR' },
      400
    );
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Verify character ownership
    const { data: character, error: characterError } = await supabase
      .from('characters')
      .select('id')
      .eq('id', characterId)
      .eq('wallet_address', auth.walletAddress)
      .single();

    if (characterError || !character) {
      return c.json(
        { error: 'Character not found', code: 'NOT_FOUND' },
        404
      );
    }

    // Get total content generations
    const { count: totalGenerations } = await supabase
      .from('content_generations')
      .select('*', { count: 'exact', head: true })
      .eq('character_id', characterId);

    // Get total social posts
    const { count: totalPosts } = await supabase
      .from('social_posts')
      .select('*, content_generations!inner(character_id)', { count: 'exact', head: true })
      .eq('content_generations.character_id', characterId);

    // Get average quality score
    const { data: generationsWithQuality } = await supabase
      .from('content_generations')
      .select('quality_score')
      .eq('character_id', characterId)
      .not('quality_score', 'is', null);

    let avgQualityScore: number | null = null;
    if (generationsWithQuality && generationsWithQuality.length > 0) {
      const scores = generationsWithQuality
        .map((g) => g.quality_score)
        .filter((s): s is number => s !== null);
      avgQualityScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    // Get engagement metrics (aggregate from all posts)
    const { data: posts } = await supabase
      .from('social_posts')
      .select('engagement_metrics, content_generations!inner(character_id)')
      .eq('content_generations.character_id', characterId)
      .eq('status', 'posted');

    const totalEngagement: Record<string, number> = {};
    if (posts) {
      for (const post of posts) {
        const metrics = post.engagement_metrics as Record<string, unknown>;
        for (const [key, value] of Object.entries(metrics)) {
          if (typeof value === 'number') {
            totalEngagement[key] = (totalEngagement[key] || 0) + value;
          }
        }
      }
    }

    // Calculate period (first to last snapshot)
    const { data: snapshots } = await supabase
      .from('analytics_snapshots')
      .select('snapshot_date')
      .eq('character_id', characterId)
      .order('snapshot_date', { ascending: true });

    const startDate = snapshots?.[0]?.snapshot_date || new Date().toISOString().split('T')[0];
    const endDate =
      snapshots?.[snapshots.length - 1]?.snapshot_date || new Date().toISOString().split('T')[0];

    const response = AnalyticsSummaryResponseSchema.parse({
      totalGenerations: totalGenerations || 0,
      totalPosts: totalPosts || 0,
      totalEngagement,
      avgQualityScore,
      period: {
        startDate,
        endDate,
      },
    });

    return c.json(response, 200);
  } catch {
    return c.json(
      { error: 'Failed to fetch analytics summary', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

/**
 * GET /api/analytics/characters/:characterId/history
 * Get time-series analytics data for a character
 */
analytics.get(
  '/characters/:characterId/history',
  zValidator('query', AnalyticsHistoryQuerySchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const characterId = c.req.param('characterId');
    const { startDate, endDate, granularity } = c.req.valid('query');

    // Validate UUID format
    const validationResult = UuidSchema.safeParse(characterId);
    if (!validationResult.success) {
      return c.json(
        { error: 'Invalid character ID format', code: 'VALIDATION_ERROR' },
        400
      );
    }

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Verify character ownership
      const { data: character, error: characterError } = await supabase
        .from('characters')
        .select('id')
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (characterError || !character) {
        return c.json(
          { error: 'Character not found', code: 'NOT_FOUND' },
          404
        );
      }

      // Build query for analytics snapshots
      let query = supabase
        .from('analytics_snapshots')
        .select('*')
        .eq('character_id', characterId)
        .order('snapshot_date', { ascending: true });

      // Apply date filters
      if (startDate) {
        query = query.gte('snapshot_date', startDate);
      }
      if (endDate) {
        query = query.lte('snapshot_date', endDate);
      }

      const { data: snapshots, error: snapshotsError } = await query;

      if (snapshotsError) {
        return c.json(
          { error: 'Failed to fetch analytics history', code: 'DATABASE_ERROR' },
          500
        );
      }

      // Handle granularity aggregation
      let aggregatedData = snapshots || [];

      if (granularity === 'week' && snapshots && snapshots.length > 0) {
        // Group by week (ISO week number)
        const weeklyData = new Map<string, AnalyticsSnapshot[]>();
        for (const snapshot of snapshots) {
          const date = new Date(snapshot.snapshot_date);
          const weekKey = getISOWeek(date);
          if (!weeklyData.has(weekKey)) {
            weeklyData.set(weekKey, []);
          }
          weeklyData.get(weekKey)?.push(snapshot);
        }

        aggregatedData = Array.from(weeklyData.values()).map(aggregateSnapshots);
      } else if (granularity === 'month' && snapshots && snapshots.length > 0) {
        // Group by month
        const monthlyData = new Map<string, AnalyticsSnapshot[]>();
        for (const snapshot of snapshots) {
          const monthKey = snapshot.snapshot_date.substring(0, 7); // YYYY-MM
          if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, []);
          }
          monthlyData.get(monthKey)?.push(snapshot);
        }

        aggregatedData = Array.from(monthlyData.values()).map(aggregateSnapshots);
      }

      return c.json(
        {
          history: aggregatedData.map(mapSnapshotToResponse),
          granularity,
        },
        200
      );
    } catch {
      return c.json(
        { error: 'Failed to fetch analytics history', code: 'INTERNAL_ERROR' },
        500
      );
    }
  }
);

/**
 * GET /api/analytics/overview
 * Get overview metrics for all user's characters
 */
analytics.get('/overview', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Get all user's characters
    const { data: characters, error: charactersError } = await supabase
      .from('characters')
      .select('id')
      .eq('wallet_address', auth.walletAddress);

    if (charactersError) {
      return c.json(
        { error: 'Failed to fetch characters', code: 'DATABASE_ERROR' },
        500
      );
    }

    if (!characters || characters.length === 0) {
      return c.json(
        {
          totalCharacters: 0,
          totalGenerations: 0,
          totalPosts: 0,
          totalEngagement: {},
          avgQualityScore: null,
        },
        200
      );
    }

    const characterIds = characters.map((c) => c.id);

    // Get total content generations
    const { count: totalGenerations } = await supabase
      .from('content_generations')
      .select('*', { count: 'exact', head: true })
      .in('character_id', characterIds);

    // Get total social posts
    const { count: totalPosts } = await supabase
      .from('social_posts')
      .select('*, content_generations!inner(character_id)', { count: 'exact', head: true })
      .in('content_generations.character_id', characterIds);

    // Get average quality score across all characters
    const { data: generationsWithQuality } = await supabase
      .from('content_generations')
      .select('quality_score')
      .in('character_id', characterIds)
      .not('quality_score', 'is', null);

    let avgQualityScore: number | null = null;
    if (generationsWithQuality && generationsWithQuality.length > 0) {
      const scores = generationsWithQuality
        .map((g) => g.quality_score)
        .filter((s): s is number => s !== null);
      avgQualityScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    // Get engagement metrics across all characters
    const { data: posts } = await supabase
      .from('social_posts')
      .select('engagement_metrics, content_generations!inner(character_id)')
      .in('content_generations.character_id', characterIds)
      .eq('status', 'posted');

    const totalEngagement: Record<string, number> = {};
    if (posts) {
      for (const post of posts) {
        const metrics = post.engagement_metrics as Record<string, unknown>;
        for (const [key, value] of Object.entries(metrics)) {
          if (typeof value === 'number') {
            totalEngagement[key] = (totalEngagement[key] || 0) + value;
          }
        }
      }
    }

    return c.json(
      {
        totalCharacters: characters.length,
        totalGenerations: totalGenerations || 0,
        totalPosts: totalPosts || 0,
        totalEngagement,
        avgQualityScore,
      },
      200
    );
  } catch {
    return c.json(
      { error: 'Failed to fetch analytics overview', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get ISO week number for a date
 */
function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Aggregate an array of snapshots into a single snapshot
 */
function aggregateSnapshots(snapshots: AnalyticsSnapshot[]): AnalyticsSnapshot {
  const first = snapshots[0];
  const totalGenerations = snapshots.reduce((sum, s) => sum + s.total_generations, 0);
  const totalPosts = snapshots.reduce((sum, s) => sum + s.total_posts, 0);

  // Aggregate engagement metrics
  const totalEngagement: Record<string, number> = {};
  for (const snapshot of snapshots) {
    const metrics = snapshot.total_engagement as Record<string, unknown>;
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value === 'number') {
        totalEngagement[key] = (totalEngagement[key] || 0) + value;
      }
    }
  }

  // Average quality scores
  const scores = snapshots
    .map((s) => s.avg_quality_score)
    .filter((s): s is number => s !== null);
  const avgQualityScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : null;

  return {
    id: first.id,
    character_id: first.character_id,
    snapshot_date: first.snapshot_date,
    total_generations: totalGenerations,
    total_posts: totalPosts,
    total_engagement: totalEngagement,
    avg_quality_score: avgQualityScore,
    top_performing_content_id: first.top_performing_content_id,
    created_at: first.created_at,
  };
}

export { analytics };
