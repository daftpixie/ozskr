/**
 * Social Routes
 * Social media account management and publishing endpoints
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  SocialAccountConnectSchema,
  PublishRequestSchema,
  SocialPostResponseSchema,
} from '@/types/social';
import { UuidSchema, paginatedResponse } from '@/types/schemas';
import { authMiddleware } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rate-limit';
import { createAuthenticatedClient } from '../supabase';
import type { SocialAccount, SocialPost } from '@/types/database';
import { ModerationStatus, SocialPostStatus } from '@/types/database';

/** Hono env with auth middleware variables */
type SocialEnv = {
  Variables: {
    walletAddress: string;
    jwtToken: string;
  };
};

const social = new Hono<SocialEnv>();

// All social routes require authentication
social.use('/*', authMiddleware);

// Publish rate limiter: 20 publishes per hour per wallet
const publishLimiter = createRateLimiter(20, 3600, 'ozskr:publish');

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
 * Helper to map database SocialAccount to API response
 */
function mapAccountToResponse(account: SocialAccount) {
  return {
    id: account.id,
    walletAddress: account.wallet_address,
    platform: account.platform,
    platformAccountId: account.platform_account_id,
    platformUsername: account.platform_username,
    isConnected: account.is_connected,
    connectedAt: account.connected_at,
    lastPostedAt: account.last_posted_at,
    createdAt: account.created_at,
  };
}

/**
 * Helper to map database SocialPost to API response
 */
function mapPostToResponse(post: SocialPost) {
  return {
    id: post.id,
    contentGenerationId: post.content_generation_id,
    socialAccountId: post.social_account_id,
    platform: post.platform,
    postId: post.post_id,
    postUrl: post.post_url,
    status: post.status,
    postedAt: post.posted_at,
    errorMessage: post.error_message,
    engagementMetrics: post.engagement_metrics,
    lastMetricsUpdate: post.last_metrics_update,
    createdAt: post.created_at,
  };
}

// =============================================================================
// SOCIAL ACCOUNT ROUTES
// =============================================================================

/**
 * POST /api/social/accounts
 * Connect a social media account
 */
social.post('/accounts', zValidator('json', SocialAccountConnectSchema), async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const input = c.req.valid('json');

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Check if platform account already exists
    const { data: existing } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('wallet_address', auth.walletAddress)
      .eq('platform', input.platform)
      .single();

    if (existing) {
      return c.json(
        {
          error: 'Social account for this platform already connected',
          code: 'CONFLICT',
        },
        409
      );
    }

    // Create social account
    const { data: account, error: insertError } = await supabase
      .from('social_accounts')
      .insert({
        wallet_address: auth.walletAddress,
        platform: input.platform,
        platform_account_id: input.platformAccountId,
        platform_username: input.platformUsername,
        ayrshare_profile_key: input.ayrshareProfileKey,
      })
      .select()
      .single();

    if (insertError || !account) {
      return c.json(
        { error: 'Failed to connect social account', code: 'DATABASE_ERROR' },
        500
      );
    }

    return c.json(mapAccountToResponse(account), 201);
  } catch {
    return c.json(
      { error: 'Failed to connect social account', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

/**
 * GET /api/social/accounts
 * List user's connected social accounts
 */
social.get('/accounts', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    const { data: accounts, error: selectError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('wallet_address', auth.walletAddress)
      .order('created_at', { ascending: false });

    if (selectError) {
      return c.json(
        { error: 'Failed to fetch social accounts', code: 'DATABASE_ERROR' },
        500
      );
    }

    return c.json(
      {
        accounts: accounts?.map(mapAccountToResponse) || [],
      },
      200
    );
  } catch {
    return c.json(
      { error: 'Failed to fetch social accounts', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

/**
 * DELETE /api/social/accounts/:id
 * Disconnect a social account (set is_connected=false, don't delete)
 */
social.delete('/accounts/:id', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const accountId = c.req.param('id');

  // Validate UUID format
  const validationResult = UuidSchema.safeParse(accountId);
  if (!validationResult.success) {
    return c.json(
      { error: 'Invalid account ID format', code: 'VALIDATION_ERROR' },
      400
    );
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Verify ownership first
    const { data: existing, error: verifyError } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('id', accountId)
      .eq('wallet_address', auth.walletAddress)
      .single();

    if (verifyError || !existing) {
      return c.json(
        { error: 'Social account not found', code: 'NOT_FOUND' },
        404
      );
    }

    // Set is_connected to false instead of deleting
    const { data: account, error: updateError } = await supabase
      .from('social_accounts')
      .update({ is_connected: false })
      .eq('id', accountId)
      .select()
      .single();

    if (updateError || !account) {
      return c.json(
        { error: 'Failed to disconnect social account', code: 'DATABASE_ERROR' },
        500
      );
    }

    return c.json(
      { success: true, message: 'Social account disconnected' },
      200
    );
  } catch {
    return c.json(
      { error: 'Failed to disconnect social account', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

// =============================================================================
// PUBLISHING ROUTES
// =============================================================================

/**
 * POST /api/social/publish
 * Publish approved content to connected platforms
 */
social.post(
  '/publish',
  publishLimiter,
  zValidator('json', PublishRequestSchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const input = c.req.valid('json');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Verify content generation exists and is approved
      const { data: generation, error: generationError } = await supabase
        .from('content_generations')
        .select('*, characters!inner(wallet_address)')
        .eq('id', input.contentGenerationId)
        .single();

      if (generationError || !generation) {
        return c.json(
          { error: 'Content generation not found', code: 'NOT_FOUND' },
          404
        );
      }

      // Verify ownership through character join
      const ownerWallet =
        typeof generation.characters === 'object' &&
        generation.characters !== null &&
        'wallet_address' in generation.characters
          ? (generation.characters as Record<string, unknown>).wallet_address
          : null;

      if (ownerWallet !== auth.walletAddress) {
        return c.json(
          { error: 'Unauthorized access to this content', code: 'FORBIDDEN' },
          403
        );
      }

      // Verify moderation status is approved
      if (generation.moderation_status !== ModerationStatus.APPROVED) {
        return c.json(
          {
            error: 'Content must be approved before publishing',
            code: 'VALIDATION_ERROR',
            details: { moderationStatus: generation.moderation_status },
          },
          400
        );
      }

      // Verify all social accounts exist and are connected
      const { data: accounts, error: accountsError } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('wallet_address', auth.walletAddress)
        .in('id', input.socialAccountIds);

      if (accountsError || !accounts || accounts.length !== input.socialAccountIds.length) {
        return c.json(
          { error: 'One or more social accounts not found', code: 'NOT_FOUND' },
          404
        );
      }

      // Check all accounts are connected
      const disconnectedAccounts = accounts.filter((a) => !a.is_connected);
      if (disconnectedAccounts.length > 0) {
        return c.json(
          {
            error: 'One or more social accounts are disconnected',
            code: 'VALIDATION_ERROR',
            details: {
              disconnected: disconnectedAccounts.map((a) => a.platform),
            },
          },
          400
        );
      }

      // Create social_posts records with status 'queued'
      const postsToInsert = accounts.map((account) => ({
        content_generation_id: input.contentGenerationId,
        social_account_id: account.id,
        platform: account.platform,
        status: SocialPostStatus.QUEUED,
      }));

      const { data: posts, error: postsError } = await supabase
        .from('social_posts')
        .insert(postsToInsert)
        .select();

      if (postsError || !posts) {
        return c.json(
          { error: 'Failed to queue posts', code: 'DATABASE_ERROR' },
          500
        );
      }

      return c.json(
        {
          success: true,
          message: 'Posts queued for publishing',
          posts: posts.map(mapPostToResponse),
        },
        201
      );
    } catch {
      return c.json(
        { error: 'Failed to publish content', code: 'INTERNAL_ERROR' },
        500
      );
    }
  }
);

/**
 * GET /api/social/posts
 * List user's social posts with engagement metrics
 */
social.get(
  '/posts',
  zValidator(
    'query',
    z.object({
      page: z.string().optional().default('1').transform(Number),
      limit: z.string().optional().default('20').transform(Number),
      status: z.string().optional(),
    })
  ),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const { page, limit, status } = c.req.valid('query');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);
      const offset = (page - 1) * limit;

      // Build query with social account ownership filter
      let countQuery = supabase
        .from('social_posts')
        .select('*, social_accounts!inner(wallet_address)', { count: 'exact', head: true })
        .eq('social_accounts.wallet_address', auth.walletAddress);

      let selectQuery = supabase
        .from('social_posts')
        .select('*, social_accounts!inner(wallet_address)')
        .eq('social_accounts.wallet_address', auth.walletAddress)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Optional status filter
      if (status) {
        countQuery = countQuery.eq('status', status);
        selectQuery = selectQuery.eq('status', status);
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        return c.json(
          { error: 'Failed to count posts', code: 'DATABASE_ERROR' },
          500
        );
      }

      const { data: postsData, error: selectError } = await selectQuery;

      if (selectError) {
        return c.json(
          { error: 'Failed to fetch posts', code: 'DATABASE_ERROR' },
          500
        );
      }

      const totalPages = Math.ceil((count || 0) / limit);

      const response = paginatedResponse(SocialPostResponseSchema).parse({
        data: postsData?.map(mapPostToResponse) || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
      });

      return c.json(response, 200);
    } catch {
      return c.json(
        { error: 'Failed to fetch posts', code: 'INTERNAL_ERROR' },
        500
      );
    }
  }
);

export { social };
