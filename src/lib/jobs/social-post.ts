/**
 * Social Post Publish Job
 *
 * Executed by Trigger.dev when a scheduled calendar entry's publish time arrives.
 *
 * Flow:
 *   load entry → moderation → post to social → status update → Mem0 update
 *
 * Orchestration boundary: Mastra workflow (simple linear pipeline — this file).
 * LangGraph is reserved for multi-step retry loops with branching.
 */

import { createSupabaseServerClient } from '@/lib/api/supabase';
import { getPublisher, isPublishingEnabled } from '@/lib/social/publisher-factory';
import { moderateContent } from '@/lib/ai/pipeline/moderation';
import { storeMem0Memory } from '@/lib/ai/agent/memory-layers';
import { logger } from '@/lib/utils/logger';
import { ModerationStatus } from '@/types/database';
import type { ContentCalendarEntry } from '@/types/database';
import type { SocialPlatform } from '@/types/database';
import type { ProgressCallback } from '@/lib/ai/pipeline/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SocialPostPayload {
  calendarEntryId: string;
  characterId: string;
  platform: string;
}

export interface SocialPostResult {
  calendarEntryId: string;
  status: 'published' | 'failed' | 'blocked';
  postId?: string;
  postUrl?: string;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a no-op progress callback for background jobs.
 * moderateContent requires a ProgressCallback but we have no SSE channel here.
 */
const noopProgress: ProgressCallback = () => {
  // No-op: background job has no streaming channel
};

/**
 * Map a calendar platform string to a SocialPlatform enum value.
 * Throws if the platform is not supported by the publisher.
 */
const toSocialPlatform = (platform: string): SocialPlatform => {
  const valid: Record<string, SocialPlatform> = {
    twitter: 'twitter' as SocialPlatform,
    instagram: 'instagram' as SocialPlatform,
    tiktok: 'tiktok' as SocialPlatform,
    // Note: 'linkedin' is not a value in SocialPlatform enum — skip if encountered
  };
  const mapped = valid[platform];
  if (!mapped) {
    throw new Error(`Unsupported platform for SocialPublisher: ${platform}`);
  }
  return mapped;
};

// ---------------------------------------------------------------------------
// Main job function
// ---------------------------------------------------------------------------

/**
 * Publish a single content_calendar entry.
 *
 * This function is intentionally self-contained so it can be unit-tested
 * independently of the Trigger.dev task wrapper.
 */
export async function publishCalendarEntry(
  payload: SocialPostPayload
): Promise<SocialPostResult> {
  const { calendarEntryId, characterId, platform } = payload;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  }

  // Use service role to bypass RLS — this runs inside a background job, not a user request
  const supabase = createSupabaseServerClient(serviceRoleKey);

  // -------------------------------------------------------------------------
  // Step 1: Load calendar entry
  // -------------------------------------------------------------------------
  const { data: entry, error: loadError } = await supabase
    .from('content_calendar')
    .select('*')
    .eq('id', calendarEntryId)
    .single();

  if (loadError || !entry) {
    const msg = `Failed to load calendar entry ${calendarEntryId}: ${loadError?.message ?? 'not found'}`;
    logger.error('[social-post] entry load failed', { calendarEntryId, error: msg });
    throw new Error(msg);
  }

  const calendarEntry = entry as ContentCalendarEntry;
  const textToModerate = calendarEntry.content_text ?? calendarEntry.content_brief;

  // -------------------------------------------------------------------------
  // Step 1.5: Check daily post limit
  // -------------------------------------------------------------------------
  const MAX_DAILY_POSTS = 10; // X policy: max 10/day for agents
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: todayCount } = await supabase
    .from('content_calendar')
    .select('*', { count: 'exact', head: true })
    .eq('character_id', characterId)
    .eq('status', 'published')
    .gte('published_at', twentyFourHoursAgo);

  if ((todayCount ?? 0) >= MAX_DAILY_POSTS) {
    const msg = `Daily post limit reached (${MAX_DAILY_POSTS}/day). Entry will not be published.`;
    logger.warn('[social-post] daily limit reached', { characterId, count: todayCount });
    await supabase
      .from('content_calendar')
      .update({ status: 'failed', error_message: msg })
      .eq('id', calendarEntryId);
    return { calendarEntryId, status: 'failed', errorMessage: msg };
  }

  // -------------------------------------------------------------------------
  // Step 2: Run content moderation
  // -------------------------------------------------------------------------
  let moderationPassed = false;
  try {
    const moderationResult = await moderateContent(
      { text: textToModerate },
      noopProgress
    );

    if (moderationResult.status === ModerationStatus.REJECTED) {
      const reason = (moderationResult.details.reason as string | undefined) ?? 'Content rejected by moderation';
      logger.warn('[social-post] content rejected by moderation', {
        calendarEntryId,
        reason,
      });

      await supabase
        .from('content_calendar')
        .update({ status: 'failed', error_message: `Moderation rejected: ${reason}` })
        .eq('id', calendarEntryId);

      return {
        calendarEntryId,
        status: 'blocked',
        errorMessage: `Moderation rejected: ${reason}`,
      };
    }

    if (moderationResult.status === ModerationStatus.FLAGGED) {
      // Flagged content is queued for human review — do not publish
      const reason = 'Content flagged for manual review';
      logger.warn('[social-post] content flagged — held for review', { calendarEntryId });

      await supabase
        .from('content_calendar')
        .update({ status: 'failed', error_message: reason })
        .eq('id', calendarEntryId);

      return { calendarEntryId, status: 'blocked', errorMessage: reason };
    }

    moderationPassed = true;
  } catch (moderationErr) {
    const msg = moderationErr instanceof Error ? moderationErr.message : String(moderationErr);
    logger.error('[social-post] moderation pipeline error', { calendarEntryId, error: msg });

    await supabase
      .from('content_calendar')
      .update({ status: 'failed', error_message: `Moderation error: ${msg}` })
      .eq('id', calendarEntryId);

    return { calendarEntryId, status: 'failed', errorMessage: `Moderation error: ${msg}` };
  }

  if (!moderationPassed) {
    return { calendarEntryId, status: 'failed', errorMessage: 'Moderation did not pass' };
  }

  // -------------------------------------------------------------------------
  // Step 3: Check publishing is enabled
  // -------------------------------------------------------------------------
  if (!isPublishingEnabled()) {
    const msg = 'Social publishing is disabled via feature flag';
    logger.warn('[social-post] publishing disabled', { calendarEntryId });

    await supabase
      .from('content_calendar')
      .update({ status: 'failed', error_message: msg })
      .eq('id', calendarEntryId);

    return { calendarEntryId, status: 'failed', errorMessage: msg };
  }

  // -------------------------------------------------------------------------
  // Step 4: Resolve social account for this character + platform
  // -------------------------------------------------------------------------
  let socialPlatform: SocialPlatform;
  try {
    socialPlatform = toSocialPlatform(platform);
  } catch (platformErr) {
    const msg = platformErr instanceof Error ? platformErr.message : String(platformErr);
    logger.error('[social-post] unsupported platform', { calendarEntryId, platform, error: msg });

    await supabase
      .from('content_calendar')
      .update({ status: 'failed', error_message: msg })
      .eq('id', calendarEntryId);

    return { calendarEntryId, status: 'failed', errorMessage: msg };
  }

  // Look up the character's wallet address first
  const { data: character, error: charError } = await supabase
    .from('characters')
    .select('wallet_address, tapestry_profile_id')
    .eq('id', characterId)
    .single();

  if (charError || !character) {
    const msg = `Character not found: ${charError?.message ?? 'unknown'}`;
    logger.error('[social-post] character lookup failed', { characterId, error: msg });

    await supabase
      .from('content_calendar')
      .update({ status: 'failed', error_message: msg })
      .eq('id', calendarEntryId);

    return { calendarEntryId, status: 'failed', errorMessage: msg };
  }

  // Fetch connected social accounts for this wallet + platform
  const { data: socialAccounts, error: accountsError } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('wallet_address', character.wallet_address)
    .eq('platform', socialPlatform)
    .eq('is_connected', true)
    .limit(1);

  if (accountsError || !socialAccounts || socialAccounts.length === 0) {
    const msg = `No connected ${platform} account found for character ${characterId}`;
    logger.warn('[social-post] no social account', { calendarEntryId, platform, characterId });

    await supabase
      .from('content_calendar')
      .update({ status: 'failed', error_message: msg })
      .eq('id', calendarEntryId);

    return { calendarEntryId, status: 'failed', errorMessage: msg };
  }

  const account = socialAccounts[0];

  // -------------------------------------------------------------------------
  // Step 5: Publish via SocialPublisher
  // -------------------------------------------------------------------------
  const publisher = getPublisher();
  let postId: string | undefined;
  let postUrl: string | undefined;

  try {
    const publishResponse = await publisher.publish({
      text: textToModerate,
      platforms: [socialPlatform],
      profileKey: account.ayrshare_profile_key,
    });

    postId = publishResponse.platformPostIds[socialPlatform] as string | undefined;
    postUrl = publishResponse.platformPostUrls[socialPlatform] as string | undefined;

    if (!postId) {
      throw new Error(`Provider did not return a post ID for ${platform}`);
    }
  } catch (publishErr) {
    const msg = publishErr instanceof Error ? publishErr.message : String(publishErr);
    logger.error('[social-post] publish failed', { calendarEntryId, platform, error: msg });

    await supabase
      .from('content_calendar')
      .update({ status: 'failed', error_message: msg })
      .eq('id', calendarEntryId);

    // If the account is suspended/restricted (403), disable it to pause agent posting
    if (msg.includes('403') || msg.toLowerCase().includes('suspended') || msg.toLowerCase().includes('restricted')) {
      void Promise.resolve(
        supabase
          .from('social_accounts')
          .update({ is_connected: false })
          .eq('id', account.id)
      ).then(() => {
        logger.warn('[social-post] social account disabled due to 403/suspension', {
          accountId: account.id,
          platform,
        });
      }).catch(() => {});
    }

    return { calendarEntryId, status: 'failed', errorMessage: msg };
  }

  // -------------------------------------------------------------------------
  // Step 6: Update calendar entry as published
  // -------------------------------------------------------------------------
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('content_calendar')
    .update({ status: 'published', published_at: now })
    .eq('id', calendarEntryId);

  if (updateError) {
    logger.warn('[social-post] failed to update entry status to published', {
      calendarEntryId,
      error: updateError.message,
    });
  }

  // Update social_accounts.last_posted_at (best-effort)
  void Promise.resolve(
    supabase
      .from('social_accounts')
      .update({ last_posted_at: now })
      .eq('id', account.id)
  ).catch(() => {});

  // -------------------------------------------------------------------------
  // Step 7: Store Mem0 memory (fire-and-forget)
  // -------------------------------------------------------------------------
  void storeMem0Memory(
    `character-${characterId}`,
    `Published post on ${platform} at ${now}`,
    { calendarEntryId, platform, status: 'published', postId }
  ).catch(() => {
    // Non-fatal: Mem0 failures never block the publish result
  });

  // -------------------------------------------------------------------------
  // Step 8: Mirror to Tapestry social graph (fire-and-forget)
  // -------------------------------------------------------------------------
  void (async () => {
    try {
      const { isTapestryConfigured } = await import('@/lib/tapestry/client');
      if (!isTapestryConfigured()) return;

      const tapestryProfileId = (character as { wallet_address: string; tapestry_profile_id?: string | null }).tapestry_profile_id;
      if (!tapestryProfileId) return;

      const { mirrorContentToTapestry } = await import('@/lib/tapestry/hooks');
      await mirrorContentToTapestry({
        tapestryProfileId,
        sourcePlatform: platform,
        sourcePostId: postId,
      });
    } catch {
      // Fire-and-forget: never surface Tapestry errors
    }
  })();

  logger.info('[social-post] calendar entry published', {
    calendarEntryId,
    characterId,
    platform,
    postId,
  });

  return {
    calendarEntryId,
    status: 'published',
    postId,
    postUrl,
  };
}
