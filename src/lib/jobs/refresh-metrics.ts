/**
 * Engagement Metrics Refresh Job
 * Updates engagement metrics for posted content and computes daily analytics snapshots
 */

import { createSupabaseServerClient } from '@/lib/api/supabase';
import { getPostAnalytics } from '@/lib/social/ayrshare';
import type { SocialPost, SocialPostStatus } from '@/types/database';
import { PointsType, PointsSourceType } from '@/types/database';
import { logger } from '@/lib/utils/logger';

/**
 * Error for metrics refresh failures
 */
export class MetricsRefreshError extends Error {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'MetricsRefreshError';
  }
}

/**
 * Update engagement metrics for a single social post
 */
const updatePostMetrics = async (
  post: SocialPost,
  supabase: ReturnType<typeof createSupabaseServerClient>
): Promise<void> => {
  try {
    // Skip if post doesn't have a post_id or social_account_id
    if (!post.post_id || !post.social_account_id) {
      return;
    }

    // Fetch social account to get profile key
    const { data: account, error: accountError } = await supabase
      .from('social_accounts')
      .select('ayrshare_profile_key')
      .eq('id', post.social_account_id)
      .single();

    if (accountError || !account) {
      logger.error(`Failed to fetch social account for post ${post.id}`);
      return;
    }

    // Fetch analytics from Ayrshare
    const analytics = await getPostAnalytics(post.post_id, account.ayrshare_profile_key);

    // Update social_posts record
    const analyticsMetrics: Record<string, unknown> =
      typeof analytics === 'object' && analytics !== null && !Array.isArray(analytics)
        ? (analytics as Record<string, unknown>)
        : {};
    await supabase
      .from('social_posts')
      .update({
        engagement_metrics: analyticsMetrics,
        last_metrics_update: new Date().toISOString(),
      })
      .eq('id', post.id);
  } catch (error) {
    // Log error but don't throw - continue processing other posts
    const errorMeta = error instanceof Error ? { message: error.message } : { error: String(error) };
    logger.error(`Failed to update metrics for post ${post.id}`, errorMeta);
  }
};

/**
 * Compute total engagement from engagement metrics
 */
const computeTotalEngagement = (metrics: Record<string, unknown>): Record<string, number> => {
  const likes = (metrics.likes as number) || 0;
  const comments = (metrics.comments as number) || 0;
  const shares = (metrics.shares as number) || 0;
  const views = (metrics.views as number) || 0;
  const retweets = (metrics.retweets as number) || 0;
  const favorites = (metrics.favorites as number) || 0;

  return {
    likes,
    comments,
    shares,
    views,
    retweets,
    favorites,
    total: likes + comments + shares + retweets + favorites,
  };
};

/**
 * Compute and upsert analytics snapshot for a character
 */
const computeCharacterSnapshot = async (
  characterId: string,
  snapshotDate: string,
  supabase: ReturnType<typeof createSupabaseServerClient>
): Promise<void> => {
  try {
    // Count total generations for this character
    const { count: totalGenerations, error: genError } = await supabase
      .from('content_generations')
      .select('*', { count: 'exact', head: true })
      .eq('character_id', characterId);

    if (genError) {
      logger.error(`Failed to count generations for character ${characterId}`);
      return;
    }

    // Get generation IDs for this character
    const { data: generationIds, error: genIdsError } = await supabase
      .from('content_generations')
      .select('id')
      .eq('character_id', characterId);

    if (genIdsError || !generationIds) {
      logger.error(`Failed to fetch generation IDs for character ${characterId}`);
      return;
    }

    const genIds = generationIds.map((g) => g.id);

    // Count total posts for this character
    const { count: totalPosts, error: postsError } = await supabase
      .from('social_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted' as SocialPostStatus)
      .in('content_generation_id', genIds);

    if (postsError) {
      logger.error(`Failed to count posts for character ${characterId}`);
      return;
    }

    // Fetch all posted content for this character
    const { data: posts, error: fetchPostsError } = await supabase
      .from('social_posts')
      .select('engagement_metrics')
      .eq('status', 'posted' as SocialPostStatus)
      .in('content_generation_id', genIds);

    if (fetchPostsError) {
      logger.error(`Failed to fetch posts for character ${characterId}`);
      return;
    }

    // Sum engagement metrics
    const totalEngagement = { likes: 0, comments: 0, shares: 0, views: 0, retweets: 0, favorites: 0, total: 0 };
    for (const post of posts || []) {
      const metrics = computeTotalEngagement(post.engagement_metrics);
      totalEngagement.likes += metrics.likes;
      totalEngagement.comments += metrics.comments;
      totalEngagement.shares += metrics.shares;
      totalEngagement.views += metrics.views;
      totalEngagement.retweets += metrics.retweets;
      totalEngagement.favorites += metrics.favorites;
      totalEngagement.total += metrics.total;
    }

    // Calculate average quality score
    const { data: generations, error: qualityError } = await supabase
      .from('content_generations')
      .select('quality_score')
      .eq('character_id', characterId)
      .not('quality_score', 'is', null);

    let avgQualityScore: number | null = null;
    if (!qualityError && generations && generations.length > 0) {
      const sum = generations.reduce((acc, gen) => acc + (gen.quality_score || 0), 0);
      avgQualityScore = sum / generations.length;
    }

    // Find top performing content (highest total engagement)
    const { data: topContent, error: topError } = await supabase
      .from('social_posts')
      .select('content_generation_id, engagement_metrics')
      .eq('status', 'posted' as SocialPostStatus)
      .in('content_generation_id', genIds)
      .order('created_at', { ascending: false });

    let topPerformingContentId: string | null = null;
    if (!topError && topContent && topContent.length > 0) {
      // Find post with highest engagement
      let maxEngagement = 0;
      for (const post of topContent) {
        const metrics = computeTotalEngagement(post.engagement_metrics);
        if (metrics.total > maxEngagement) {
          maxEngagement = metrics.total;
          topPerformingContentId = post.content_generation_id;
        }
      }
    }

    // Upsert analytics snapshot
    const engagementRecord: Record<string, unknown> = { ...totalEngagement };
    await supabase
      .from('analytics_snapshots')
      .upsert({
        character_id: characterId,
        snapshot_date: snapshotDate,
        total_generations: totalGenerations || 0,
        total_posts: totalPosts || 0,
        total_engagement: engagementRecord,
        avg_quality_score: avgQualityScore,
        top_performing_content_id: topPerformingContentId,
      }, {
        onConflict: 'character_id,snapshot_date',
      });
  } catch (error) {
    const errorMeta = error instanceof Error ? { message: error.message } : { error: String(error) };
    logger.error(`Failed to compute snapshot for character ${characterId}`, errorMeta);
  }
};

/**
 * Refresh engagement metrics for all recent posts and compute analytics snapshots
 *
 * This function:
 * 1. Fetches recent social_posts where status = 'posted' and created_at > 7 days ago
 * 2. For each post, calls getPostAnalytics() via Ayrshare
 * 3. Updates social_posts.engagement_metrics and last_metrics_update
 * 4. After all posts updated, computes daily analytics_snapshots for each character
 *
 * @returns Number of posts updated
 */
export const refreshEngagementMetrics = async (): Promise<number> => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new MetricsRefreshError('SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  }

  const supabase = createSupabaseServerClient(serviceRoleKey);

  // Fetch recent posted content (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: posts, error: fetchError } = await supabase
    .from('social_posts')
    .select('*')
    .eq('status', 'posted' as SocialPostStatus)
    .gte('created_at', sevenDaysAgo.toISOString())
    .not('post_id', 'is', null);

  if (fetchError) {
    throw new MetricsRefreshError(`Failed to fetch posts: ${fetchError.message}`);
  }

  if (!posts || posts.length === 0) {
    return 0;
  }

  // Update metrics for all posts in parallel
  const updatePromises = posts.map((post) => updatePostMetrics(post, supabase));
  await Promise.allSettled(updatePromises);

  // Compute analytics snapshots for affected characters
  const characterIds = new Set<string>();

  // Fetch content_generations for these posts to get character_ids
  const contentIds = posts.map((p) => p.content_generation_id);
  const { data: generations, error: genError } = await supabase
    .from('content_generations')
    .select('id, character_id')
    .in('id', contentIds);

  if (genError || !generations) {
    logger.error('Failed to fetch generations for snapshot computation');
    return posts.length;
  }

  for (const gen of generations) {
    characterIds.add(gen.character_id);
  }

  // Compute snapshot for today for each character
  const today = new Date().toISOString().split('T')[0];
  const snapshotPromises = Array.from(characterIds).map((charId) =>
    computeCharacterSnapshot(charId, today, supabase)
  );
  await Promise.allSettled(snapshotPromises);

  // Award engagement milestone points for posts that crossed 10-engagement boundaries
  for (const post of posts) {
    const metrics = computeTotalEngagement(post.engagement_metrics);
    const totalEngagement = metrics.total;

    // Check if total engagements crossed a 10-engagement boundary
    const milestoneCrossed = Math.floor(totalEngagement / 10);

    if (milestoneCrossed > 0) {
      // Fetch character to get wallet_address
      const { data: content } = await supabase
        .from('content_generations')
        .select('character_id')
        .eq('id', post.content_generation_id)
        .single();

      if (content) {
        const { data: character } = await supabase
          .from('characters')
          .select('wallet_address')
          .eq('id', content.character_id)
          .single();

        if (character) {
          // Award engagement milestone points (async, don't fail the job)
          void import('@/lib/gamification/points')
            .then(({ awardPoints, POINTS_VALUES }) =>
              awardPoints({
                walletAddress: character.wallet_address,
                pointsType: PointsType.ENGAGEMENT,
                pointsAmount: POINTS_VALUES.ENGAGEMENT_MILESTONE * milestoneCrossed,
                description: `Engagement milestone: ${totalEngagement} total engagements`,
                sourceType: PointsSourceType.SOCIAL_POST,
                sourceId: post.id,
              })
            )
            .catch(() => {});
        }
      }
    }
  }

  return posts.length;
};
