/**
 * Social Publishing Job
 * Publishes approved content to social media platforms via Ayrshare
 */

import { createSupabaseServerClient } from '@/lib/api/supabase';
import { publishPost } from '@/lib/social/ayrshare';
import { logger } from '@/lib/utils/logger';
import { ModerationStatus, PointsType, PointsSourceType } from '@/types/database';
import type {
  ContentGeneration,
  SocialAccount,
  SocialPlatform,
  SocialPostStatus,
} from '@/types/database';

/**
 * Error for publishing failures
 */
export class PublishError extends Error {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'PublishError';
  }
}

/**
 * Result from publishing to a single social account
 */
export interface PublishResult {
  socialAccountId: string;
  platform: SocialPlatform;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

/**
 * Publish to a single social account
 */
const publishToAccount = async (
  content: ContentGeneration,
  account: SocialAccount,
  supabase: ReturnType<typeof createSupabaseServerClient>
): Promise<PublishResult> => {
  try {
    // Verify account is connected
    if (!account.is_connected) {
      throw new Error('Social account is not connected');
    }

    // Prepare post content
    const postText = content.output_text || '';
    if (!postText) {
      throw new Error('Content has no text to publish');
    }

    // Prepare media URLs
    const mediaUrls = content.output_url ? [content.output_url] : undefined;

    // Create social_posts record (status: queued)
    const { data: socialPost, error: insertError } = await supabase
      .from('social_posts')
      .insert({
        content_generation_id: content.id,
        social_account_id: account.id,
        platform: account.platform,
        status: 'queued' as SocialPostStatus,
        engagement_metrics: {},
      })
      .select('id')
      .single();

    if (insertError || !socialPost) {
      throw new Error(`Failed to create social_posts record: ${insertError?.message}`);
    }

    // Publish via Ayrshare
    const publishResponse = await publishPost({
      post: postText,
      platforms: [account.platform],
      mediaUrls,
      profileKey: account.ayrshare_profile_key,
    });

    // Extract post ID and URL for this platform
    const platformKey = account.platform;
    const postId = publishResponse.postIds[platformKey] as string | undefined;
    const postUrl = publishResponse.postUrls?.[platformKey] as string | undefined;

    if (!postId) {
      throw new Error('Ayrshare did not return a post ID');
    }

    // Update social_posts record (status: posted)
    const now = new Date().toISOString();
    await supabase
      .from('social_posts')
      .update({
        post_id: postId,
        post_url: postUrl,
        status: 'posted' as SocialPostStatus,
        posted_at: now,
      })
      .eq('id', socialPost.id);

    // Update social_accounts.last_posted_at
    await supabase
      .from('social_accounts')
      .update({ last_posted_at: now })
      .eq('id', account.id);

    // Award points for publishing (async, don't fail the main operation)
    // Fetch character to get wallet_address
    void (async () => {
      try {
        const { data: character } = await supabase
          .from('characters')
          .select('wallet_address')
          .eq('id', content.character_id)
          .single();

        if (character) {
          const { awardPoints, POINTS_VALUES } = await import('@/lib/gamification/points');
          await awardPoints({
            walletAddress: character.wallet_address,
            pointsType: PointsType.PUBLISHING,
            pointsAmount: POINTS_VALUES.CONTENT_PUBLISHED,
            description: `Published to ${account.platform}`,
            sourceType: PointsSourceType.SOCIAL_POST,
            sourceId: socialPost.id,
          });
        }
      } catch {
        // Ignore gamification errors
      }
    })();

    return {
      socialAccountId: account.id,
      platform: account.platform,
      success: true,
      postId,
      postUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to publish to platform', { platform: account.platform, error: errorMessage });

    // Try to update social_posts record with error
    try {
      await supabase
        .from('social_posts')
        .update({
          status: 'failed' as SocialPostStatus,
          error_message: errorMessage,
        })
        .eq('content_generation_id', content.id)
        .eq('social_account_id', account.id)
        .eq('status', 'queued');
    } catch {
      // Ignore errors in error handling
    }

    return {
      socialAccountId: account.id,
      platform: account.platform,
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Publish approved content to multiple social accounts
 *
 * This function:
 * 1. Fetches the content_generation record
 * 2. Verifies moderation_status === 'approved'
 * 3. For each target social_account_id:
 *    a. Fetches the social_account record
 *    b. Publishes via Ayrshare
 *    c. Creates/updates social_posts record
 *    d. Updates social_accounts.last_posted_at
 * 4. Handles per-platform errors independently
 *
 * @param contentGenerationId - ID of the approved content generation
 * @param socialAccountIds - Array of social account IDs to publish to
 * @returns Array of results for each account
 */
export const publishToSocial = async (
  contentGenerationId: string,
  socialAccountIds: string[]
): Promise<PublishResult[]> => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new PublishError('SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  }

  const supabase = createSupabaseServerClient(serviceRoleKey);

  // Fetch content generation
  const { data: content, error: fetchError } = await supabase
    .from('content_generations')
    .select('*')
    .eq('id', contentGenerationId)
    .single();

  if (fetchError || !content) {
    throw new PublishError(`Failed to fetch content generation: ${fetchError?.message}`);
  }

  // CRITICAL: Verify content is approved
  if (content.moderation_status !== ModerationStatus.APPROVED) {
    throw new PublishError(
      `Content is not approved for publishing (status: ${content.moderation_status})`
    );
  }

  // Fetch social accounts
  const { data: accounts, error: accountsError } = await supabase
    .from('social_accounts')
    .select('*')
    .in('id', socialAccountIds);

  if (accountsError || !accounts || accounts.length === 0) {
    throw new PublishError(`Failed to fetch social accounts: ${accountsError?.message}`);
  }

  // Publish to all accounts in parallel
  const publishPromises = accounts.map((account) =>
    publishToAccount(content, account, supabase)
  );

  const results = await Promise.allSettled(publishPromises);

  // Extract results
  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    // Promise rejected - shouldn't happen since publishToAccount catches errors
    return {
      socialAccountId: 'unknown',
      platform: 'twitter' as SocialPlatform,
      success: false,
      error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
    };
  });
};
