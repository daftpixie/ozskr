/**
 * Tapestry Social Graph Routes
 * Hono route group exposing Tapestry profile, content, and social graph
 * operations for AI agent characters.
 *
 * All routes require a valid JWT via authMiddleware.
 * Authorization is enforced at the application layer: every query filters by
 * wallet_address (set by authMiddleware) so a user can only operate on their
 * own agent characters.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { createAuthenticatedClient } from '../supabase';
import { tapestryService } from '@/lib/tapestry/service';
import { isTapestryConfigured } from '@/lib/tapestry/client';
import {
  SyncProfileBodySchema,
  MirrorContentBodySchema,
  FollowBodySchema,
} from '@/lib/tapestry/schemas';
import { logger } from '@/lib/utils/logger';

// NOTE: Do NOT add a TapestryEnv generic to the Hono instance.
// When zValidator is used, the Hono env generic conflicts with the validator's
// Env type parameter and breaks TypeScript inference. Auth context is extracted
// via getAuthContext() with explicit type narrowing instead.
const tapestry = new Hono();

// All routes require authentication
tapestry.use('/*', authMiddleware);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Extract typed auth context from the Hono context. */
function getAuthContext(c: { get: (key: string) => unknown }) {
  const walletAddress = c.get('walletAddress');
  const jwtToken = c.get('jwtToken');
  if (typeof walletAddress !== 'string' || typeof jwtToken !== 'string') {
    return null;
  }
  return { walletAddress, jwtToken };
}

// ---------------------------------------------------------------------------
// GET /tapestry/profile/:characterId
// Get the Tapestry profile registered for an AI agent character.
// ---------------------------------------------------------------------------

tapestry.get('/profile/:characterId', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  if (!isTapestryConfigured()) {
    return c.json({ error: 'Tapestry not configured', code: 'SERVICE_UNAVAILABLE' }, 503);
  }

  const characterId = c.req.param('characterId');

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    const { data: character, error } = await supabase
      .from('characters')
      .select('id, tapestry_profile_id, tapestry_username')
      .eq('id', characterId)
      .eq('wallet_address', auth.walletAddress)
      .single();

    if (error || !character) {
      return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
    }

    if (!character.tapestry_profile_id) {
      return c.json(
        { error: 'Tapestry profile not configured', code: 'NOT_CONFIGURED' },
        400
      );
    }

    const result = await tapestryService.getProfile(character.tapestry_profile_id);

    if ('error' in result) {
      return c.json({ error: result.error, code: 'UPSTREAM_ERROR' }, 502);
    }

    return c.json({ profile: result.data }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Tapestry GET /profile/:characterId failed', { characterId, error: message });
    return c.json({ error: 'Failed to fetch Tapestry profile', code: 'INTERNAL_ERROR' }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /tapestry/profile/:characterId
// Create or sync a Tapestry profile for an AI agent character.
// Stores the returned profileId in characters.tapestry_profile_id.
// ---------------------------------------------------------------------------

tapestry.post(
  '/profile/:characterId',
  zValidator('json', SyncProfileBodySchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    if (!isTapestryConfigured()) {
      return c.json({ error: 'Tapestry not configured', code: 'SERVICE_UNAVAILABLE' }, 503);
    }

    const characterId = c.req.param('characterId');
    const input = c.req.valid('json');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Verify ownership and load character data
      const { data: character, error: fetchError } = await supabase
        .from('characters')
        .select('id, wallet_address')
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (fetchError || !character) {
        return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
      }

      // Create or retrieve the Tapestry profile
      const result = await tapestryService.createOrFindProfile(
        auth.walletAddress,
        input.username,
        input.bio
      );

      if ('error' in result) {
        return c.json({ error: result.error, code: 'UPSTREAM_ERROR' }, 502);
      }

      // Persist the Tapestry profile ID and username back to Supabase
      const { error: updateError } = await supabase
        .from('characters')
        .update({
          tapestry_profile_id: result.data.id,
          tapestry_username: result.data.username,
        })
        .eq('id', characterId);

      if (updateError) {
        logger.warn('Failed to persist Tapestry profile ID to Supabase', {
          characterId,
          tapestryProfileId: result.data.id,
          error: updateError.message,
        });
      }

      return c.json({ profile: result.data }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Tapestry POST /profile/:characterId failed', { characterId, error: message });
      return c.json({ error: 'Failed to sync Tapestry profile', code: 'INTERNAL_ERROR' }, 500);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /tapestry/feed/:characterId
// Get the Tapestry content feed for an AI agent character.
// Query params: page (default 1), limit (default 20, max 50)
// ---------------------------------------------------------------------------

const FeedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

tapestry.get('/feed/:characterId', zValidator('query', FeedQuerySchema), async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  if (!isTapestryConfigured()) {
    return c.json({ error: 'Tapestry not configured', code: 'SERVICE_UNAVAILABLE' }, 503);
  }

  const characterId = c.req.param('characterId');
  const { page, limit } = c.req.valid('query');

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    const { data: character, error } = await supabase
      .from('characters')
      .select('id, tapestry_profile_id')
      .eq('id', characterId)
      .eq('wallet_address', auth.walletAddress)
      .single();

    if (error || !character) {
      return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
    }

    if (!character.tapestry_profile_id) {
      return c.json(
        { error: 'Tapestry profile not configured', code: 'NOT_CONFIGURED' },
        400
      );
    }

    const result = await tapestryService.getContentFeed(
      character.tapestry_profile_id,
      page,
      limit
    );

    if ('error' in result) {
      return c.json({ error: result.error, code: 'UPSTREAM_ERROR' }, 502);
    }

    return c.json({ contents: result.data, page, limit }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Tapestry GET /feed/:characterId failed', { characterId, error: message });
    return c.json({ error: 'Failed to fetch content feed', code: 'INTERNAL_ERROR' }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /tapestry/content/:characterId
// Mirror a published post to the Tapestry social graph.
// Stores a record in tapestry_content_mirror for future reference.
// ---------------------------------------------------------------------------

tapestry.post(
  '/content/:characterId',
  zValidator('json', MirrorContentBodySchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    if (!isTapestryConfigured()) {
      return c.json({ error: 'Tapestry not configured', code: 'SERVICE_UNAVAILABLE' }, 503);
    }

    const characterId = c.req.param('characterId');
    const input = c.req.valid('json');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      const { data: character, error } = await supabase
        .from('characters')
        .select('id, tapestry_profile_id')
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (error || !character) {
        return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
      }

      if (!character.tapestry_profile_id) {
        return c.json(
          { error: 'Tapestry profile not configured', code: 'NOT_CONFIGURED' },
          400
        );
      }

      // Register the content node in Tapestry
      const result = await tapestryService.createContent(
        input.contentId,
        character.tapestry_profile_id,
        {
          sourcePlatform: input.sourcePlatform,
          ...(input.sourcePostId ? { sourcePostId: input.sourcePostId } : {}),
        }
      );

      if ('error' in result) {
        return c.json({ error: result.error, code: 'UPSTREAM_ERROR' }, 502);
      }

      // Persist the mirror record to Supabase (upsert — idempotent on re-publish)
      const { error: insertError } = await supabase
        .from('tapestry_content_mirror')
        .upsert(
          {
            character_id: characterId,
            tapestry_content_id: result.data.id,
            source_platform: input.sourcePlatform,
            source_post_id: input.sourcePostId ?? null,
            content_text: input.contentText ?? null,
          },
          { onConflict: 'character_id,tapestry_content_id' }
        );

      if (insertError) {
        logger.warn('Failed to persist Tapestry content mirror to Supabase', {
          characterId,
          contentId: input.contentId,
          error: insertError.message,
        });
      }

      return c.json({ content: result.data }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Tapestry POST /content/:characterId failed', { characterId, error: message });
      return c.json({ error: 'Failed to mirror content', code: 'INTERNAL_ERROR' }, 500);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /tapestry/graph/:characterId
// Get the social graph (followers or following) for an agent.
// Query param: type = 'followers' | 'following'
// ---------------------------------------------------------------------------

const GraphQuerySchema = z.object({
  type: z.enum(['followers', 'following']),
});

tapestry.get('/graph/:characterId', zValidator('query', GraphQuerySchema), async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  if (!isTapestryConfigured()) {
    return c.json({ error: 'Tapestry not configured', code: 'SERVICE_UNAVAILABLE' }, 503);
  }

  const characterId = c.req.param('characterId');
  const { type } = c.req.valid('query');

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    const { data: character, error } = await supabase
      .from('characters')
      .select('id, tapestry_profile_id')
      .eq('id', characterId)
      .eq('wallet_address', auth.walletAddress)
      .single();

    if (error || !character) {
      return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
    }

    if (!character.tapestry_profile_id) {
      return c.json(
        { error: 'Tapestry profile not configured', code: 'NOT_CONFIGURED' },
        400
      );
    }

    const result =
      type === 'followers'
        ? await tapestryService.getFollowers(character.tapestry_profile_id)
        : await tapestryService.getFollowing(character.tapestry_profile_id);

    if ('error' in result) {
      return c.json({ error: result.error, code: 'UPSTREAM_ERROR' }, 502);
    }

    return c.json({ type, profiles: result.data }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Tapestry GET /graph/:characterId failed', {
      characterId,
      type,
      error: message,
    });
    return c.json({ error: 'Failed to fetch social graph', code: 'INTERNAL_ERROR' }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /tapestry/follow
// Create a follow relationship between two agent characters.
// Body: { followerCharacterId, followingCharacterId }
// ---------------------------------------------------------------------------

tapestry.post('/follow', zValidator('json', FollowBodySchema), async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  if (!isTapestryConfigured()) {
    return c.json({ error: 'Tapestry not configured', code: 'SERVICE_UNAVAILABLE' }, 503);
  }

  const input = c.req.valid('json');

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Resolve follower — must be owned by the requesting wallet
    const { data: followerChar, error: followerError } = await supabase
      .from('characters')
      .select('id, tapestry_profile_id')
      .eq('id', input.followerCharacterId)
      .eq('wallet_address', auth.walletAddress)
      .single();

    if (followerError || !followerChar) {
      return c.json({ error: 'Follower character not found', code: 'NOT_FOUND' }, 404);
    }

    if (!followerChar.tapestry_profile_id) {
      return c.json(
        { error: 'Follower Tapestry profile not configured', code: 'NOT_CONFIGURED' },
        400
      );
    }

    // Resolve followee — does not need to be owned by this wallet
    const { data: followingChar, error: followingError } = await supabase
      .from('characters')
      .select('id, tapestry_profile_id')
      .eq('id', input.followingCharacterId)
      .single();

    if (followingError || !followingChar) {
      return c.json({ error: 'Following character not found', code: 'NOT_FOUND' }, 404);
    }

    if (!followingChar.tapestry_profile_id) {
      return c.json(
        { error: 'Following Tapestry profile not configured', code: 'NOT_CONFIGURED' },
        400
      );
    }

    const result = await tapestryService.createFollow(
      followerChar.tapestry_profile_id,
      followingChar.tapestry_profile_id
    );

    if ('error' in result) {
      return c.json({ error: result.error, code: 'UPSTREAM_ERROR' }, 502);
    }

    return c.json({ success: true }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Tapestry POST /follow failed', { error: message });
    return c.json({ error: 'Failed to create follow relationship', code: 'INTERNAL_ERROR' }, 500);
  }
});

// ---------------------------------------------------------------------------
// DELETE /tapestry/follow
// Remove a follow relationship between two agent characters.
// Body: { followerCharacterId, followingCharacterId }
// ---------------------------------------------------------------------------

tapestry.delete('/follow', zValidator('json', FollowBodySchema), async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  if (!isTapestryConfigured()) {
    return c.json({ error: 'Tapestry not configured', code: 'SERVICE_UNAVAILABLE' }, 503);
  }

  const input = c.req.valid('json');

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Resolve follower — must be owned by the requesting wallet
    const { data: followerChar, error: followerError } = await supabase
      .from('characters')
      .select('id, tapestry_profile_id')
      .eq('id', input.followerCharacterId)
      .eq('wallet_address', auth.walletAddress)
      .single();

    if (followerError || !followerChar) {
      return c.json({ error: 'Follower character not found', code: 'NOT_FOUND' }, 404);
    }

    if (!followerChar.tapestry_profile_id) {
      return c.json(
        { error: 'Follower Tapestry profile not configured', code: 'NOT_CONFIGURED' },
        400
      );
    }

    // Resolve followee
    const { data: followingChar, error: followingError } = await supabase
      .from('characters')
      .select('id, tapestry_profile_id')
      .eq('id', input.followingCharacterId)
      .single();

    if (followingError || !followingChar) {
      return c.json({ error: 'Following character not found', code: 'NOT_FOUND' }, 404);
    }

    if (!followingChar.tapestry_profile_id) {
      return c.json(
        { error: 'Following Tapestry profile not configured', code: 'NOT_CONFIGURED' },
        400
      );
    }

    const result = await tapestryService.removeFollow(
      followerChar.tapestry_profile_id,
      followingChar.tapestry_profile_id
    );

    if ('error' in result) {
      return c.json({ error: result.error, code: 'UPSTREAM_ERROR' }, 502);
    }

    return c.json({ success: true }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Tapestry DELETE /follow failed', { error: message });
    return c.json({ error: 'Failed to remove follow relationship', code: 'INTERNAL_ERROR' }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /tapestry/stats/:characterId
// Get engagement statistics (followers, following, content count) for an agent.
// ---------------------------------------------------------------------------

tapestry.get('/stats/:characterId', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  if (!isTapestryConfigured()) {
    return c.json({ error: 'Tapestry not configured', code: 'SERVICE_UNAVAILABLE' }, 503);
  }

  const characterId = c.req.param('characterId');

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    const { data: character, error } = await supabase
      .from('characters')
      .select('id, tapestry_profile_id')
      .eq('id', characterId)
      .eq('wallet_address', auth.walletAddress)
      .single();

    if (error || !character) {
      return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
    }

    if (!character.tapestry_profile_id) {
      return c.json(
        { error: 'Tapestry profile not configured', code: 'NOT_CONFIGURED' },
        400
      );
    }

    const result = await tapestryService.getEngagementStats(character.tapestry_profile_id);

    if ('error' in result) {
      return c.json({ error: result.error, code: 'UPSTREAM_ERROR' }, 502);
    }

    return c.json({ characterId, stats: result.data }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Tapestry GET /stats/:characterId failed', { characterId, error: message });
    return c.json({ error: 'Failed to fetch engagement stats', code: 'INTERNAL_ERROR' }, 500);
  }
});

export { tapestry };
