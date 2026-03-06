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
import { createRateLimiter } from '../middleware/rate-limit';
import { createAuthenticatedClient } from '../supabase';
import {
  GenerationType,
  ModerationStatus,
  SocialPlatform,
  SocialPostStatus,
} from '@/types/database';
import { injectTwitterAiDisclosure } from '@/lib/social/ai-disclosure';
import { validatePublicImageUrl, ImageUrlValidationError } from '@/lib/social/image-url-validator';
import { moderateContent, ModerationError } from '@/lib/ai/pipeline/moderation';
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

/** 10 direct posts per hour per wallet — X free-tier protection */
const directPostLimiter = createRateLimiter(10, 3600, 'ozskr:social:direct');

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
  directPostLimiter,
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
    // 2. Run content moderation pipeline (MANDATORY — CLAUDE.md compliance)
    //    All three stages: endorsement guardrails → OpenAI text mod → result
    // -------------------------------------------------------------------------
    let moderationStatus: ModerationStatus;
    let moderationDetails: Record<string, unknown> = {};

    try {
      const modResult = await moderateContent(
        { text: input.text },
        () => {} // no-op progress callback in API context
      );
      moderationStatus = modResult.status;
      moderationDetails = modResult.details;
    } catch (err) {
      const message = err instanceof ModerationError ? err.message : 'Moderation pipeline error';
      logger.error('Content moderation failed for direct post', {
        characterId: input.characterId,
        error: message,
      });
      return c.json({ error: 'Content moderation unavailable', code: 'MODERATION_ERROR' }, 503);
    }

    if (moderationStatus !== ModerationStatus.APPROVED) {
      logger.warn('Direct post blocked by moderation', {
        characterId: input.characterId,
        moderationStatus,
        moderationDetails,
      });
      return c.json(
        { error: 'Content did not pass moderation', code: 'MODERATION_REJECTED', status: moderationStatus },
        422
      );
    }

    // -------------------------------------------------------------------------
    // 3. Create a content_generations record (required FK for social_posts)
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
    // 4. Look up the twitter social_account for this character's wallet
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
    // 5. Post the tweet via OAuth 1.0a XClient
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
        // SECURITY: Validate imageUrl is a public HTTPS domain before fetching
        // to prevent SSRF against internal infrastructure.
        try {
          validatePublicImageUrl(input.imageUrl);
        } catch (err) {
          return c.json(
            {
              error: err instanceof ImageUrlValidationError ? err.message : 'Invalid imageUrl',
              code: 'INVALID_IMAGE_URL',
            },
            400
          );
        }

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
    // 6. Store the social_posts record for auditability and retry support
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
