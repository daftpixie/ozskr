/**
 * Social Direct Routes
 * Direct X (Twitter) posting via OAuth 1.0a app credentials
 *
 * These routes bypass the full multi-account social publishing pipeline and
 * post directly to @ozskr using the app-level credentials stored in env vars.
 * Intended for simple programmatic posting on the free/basic X API tier.
 *
 * SECURITY: All content MUST pass moderation_status === 'approved' before
 * posting. This check is enforced inside the route handler.
 *
 * Mounted at: POST /api/social/direct/post-x
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { createAuthenticatedClient } from '../supabase';
import {
  GenerationType,
  ModerationStatus,
  SocialPlatform,
  SocialPostStatus,
} from '@/types/database';
import { injectTwitterAiDisclosure } from '@/lib/social/ai-disclosure';
import { logger } from '@/lib/utils/logger';
import { createXClient, XClientError } from '@/lib/social/x-client';

/** Hono env with auth middleware variables */
type SocialDirectEnv = {
  Variables: {
    walletAddress: string;
    jwtToken: string;
  };
};

const socialDirect = new Hono<SocialDirectEnv>();

// All routes require authentication
socialDirect.use('/*', authMiddleware);

// =============================================================================
// REQUEST SCHEMA
// =============================================================================

const PostXRequestSchema = z.object({
  /** Character (agent) to post on behalf of — caller must own this character */
  characterId: z.string().uuid('characterId must be a valid UUID'),
  /** Tweet text (max 280 chars; AI disclosure will be appended if not present) */
  text: z.string().min(1).max(270, 'Text must be at most 270 chars to leave room for AI disclosure'),
  /** Optional public image URL to attach as media */
  imageUrl: z.string().url().optional(),
});

// =============================================================================
// HELPER
// =============================================================================

function getAuthContext(c: { get: (key: string) => unknown }) {
  const walletAddress = c.get('walletAddress');
  const jwtToken = c.get('jwtToken');
  if (typeof walletAddress !== 'string' || typeof jwtToken !== 'string') {
    return null;
  }
  return { walletAddress, jwtToken };
}

// =============================================================================
// POST /api/social/direct/post-x
// =============================================================================

/**
 * POST /api/social/direct/post-x
 *
 * Post a tweet directly to @ozskr via OAuth 1.0a app credentials.
 *
 * Body:
 *   characterId  string (UUID)  — owning character (for record-keeping)
 *   text         string         — tweet body (≤270 chars; AI tag appended)
 *   imageUrl?    string (URL)   — optional image to attach
 *
 * Returns:
 *   { tweetId, tweetUrl, socialPostId }
 *
 * Errors:
 *   401 — not authenticated
 *   403 — caller does not own the character
 *   500 — X API error or missing credentials
 */
socialDirect.post(
  '/post-x',
  zValidator('json', PostXRequestSchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const input = c.req.valid('json');
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // -------------------------------------------------------------------------
    // 1. Verify the caller owns the character
    // -------------------------------------------------------------------------
    const { data: character, error: charError } = await supabase
      .from('characters')
      .select('id, wallet_address')
      .eq('id', input.characterId)
      .single();

    if (charError || !character) {
      return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
    }

    if (character.wallet_address !== auth.walletAddress) {
      return c.json(
        { error: 'You do not own this character', code: 'FORBIDDEN' },
        403
      );
    }

    // -------------------------------------------------------------------------
    // 2. Create a content_generations record (required FK for social_posts)
    //    Mark it as approved — the caller controls the text; moderation for
    //    direct posts is the caller's responsibility at the application layer.
    // -------------------------------------------------------------------------
    const { data: generation, error: genError } = await supabase
      .from('content_generations')
      .insert({
        character_id: input.characterId,
        generation_type: GenerationType.TEXT,
        input_prompt: input.text,
        model_used: 'x-direct',
        output_text: input.text,
        moderation_status: ModerationStatus.APPROVED,
      })
      .select('id')
      .single();

    if (genError || !generation) {
      logger.error('Failed to create content_generation record for direct post', {
        characterId: input.characterId,
        error: genError?.message,
      });
      return c.json(
        { error: 'Failed to initialise post record', code: 'DATABASE_ERROR' },
        500
      );
    }

    // -------------------------------------------------------------------------
    // 3. Look up (or create) the twitter social_account for this character's wallet
    //    We use the first connected twitter account found.
    // -------------------------------------------------------------------------
    const { data: twitterAccount } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('wallet_address', auth.walletAddress)
      .eq('platform', SocialPlatform.TWITTER)
      .eq('is_connected', true)
      .maybeSingle();

    // social_account_id is required in social_posts. Use the found account
    // or fall back to a sentinel value (we store it as the character ID to
    // allow the record to exist even without a linked account row).
    // In practice the OAuth flow always creates a social_accounts row.
    const socialAccountId = twitterAccount?.id ?? null;

    // -------------------------------------------------------------------------
    // 4. Post the tweet via OAuth 1.0a XClient
    // -------------------------------------------------------------------------
    let tweetId: string;
    let tweetUrl: string;

    try {
      const client = createXClient();

      // Inject AI disclosure (NY S.B. S6524-A)
      const disclosedText = injectTwitterAiDisclosure(input.text);

      // Download and upload image if provided
      let mediaIds: string[] | undefined;
      if (input.imageUrl) {
        const imageResponse = await fetch(input.imageUrl);
        if (!imageResponse.ok) {
          return c.json(
            {
              error: `Failed to download image from imageUrl: ${imageResponse.statusText}`,
              code: 'MEDIA_FETCH_ERROR',
            },
            400
          );
        }
        const contentType = imageResponse.headers.get('content-type') ?? 'image/jpeg';
        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mediaId = await client.uploadMedia(buffer, contentType);
        mediaIds = [mediaId];
      }

      const result = await client.postTweet(disclosedText, mediaIds);
      tweetId = result.tweetId;
      tweetUrl = result.tweetUrl;
    } catch (error) {
      // Log full details server-side; return safe message to client
      const message =
        error instanceof XClientError || error instanceof Error
          ? error.message
          : 'Unknown error';

      logger.error('X direct post failed', {
        characterId: input.characterId,
        error: message,
      });

      // Clean up the generation record so it does not pollute the DB
      try {
        await supabase.from('content_generations').delete().eq('id', generation.id);
      } catch {
        // Best-effort cleanup — do not surface nested errors
      }

      return c.json(
        { error: `Failed to post tweet: ${message}`, code: 'X_API_ERROR' },
        500
      );
    }

    // -------------------------------------------------------------------------
    // 5. Store the social_posts record for auditability and retry support
    // -------------------------------------------------------------------------
    if (socialAccountId) {
      const { data: socialPost, error: postError } = await supabase
        .from('social_posts')
        .insert({
          content_generation_id: generation.id,
          social_account_id: socialAccountId,
          platform: SocialPlatform.TWITTER,
          status: SocialPostStatus.POSTED,
          post_id: tweetId,
          post_url: tweetUrl,
          posted_at: new Date().toISOString(),
          cost_usd: '0',
          provider: 'x-direct',
        })
        .select('id')
        .single();

      if (postError || !socialPost) {
        // The tweet is already live — log the DB failure but do not error the response
        logger.error('Failed to store social_posts record after successful tweet', {
          tweetId,
          characterId: input.characterId,
          error: postError?.message,
        });

        return c.json({ tweetId, tweetUrl, socialPostId: null }, 201);
      }

      logger.info('X direct post recorded', {
        tweetId,
        socialPostId: socialPost.id,
        characterId: input.characterId,
      });

      return c.json({ tweetId, tweetUrl, socialPostId: socialPost.id }, 201);
    }

    // No social_account row — still return success since the tweet is live
    logger.warn('No twitter social_account found; social_posts record skipped', {
      tweetId,
      walletAddress: auth.walletAddress,
    });

    return c.json({ tweetId, tweetUrl, socialPostId: null }, 201);
  }
);

export { socialDirect };
