/**
 * Twitter OAuth Routes
 * OAuth 2.0 PKCE authorization flow for direct Twitter/X API access
 *
 * Flow:
 *   1. GET /api/social/twitter/authorize — generates auth URL, stores state+verifier in session
 *   2. GET /api/social/twitter/callback  — exchanges code for tokens, stores encrypted in DB
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { createAuthenticatedClient } from '../supabase';
import { generateAuthUrl, exchangeCode, fetchTwitterUser } from '@/lib/social/twitter/oauth';
import { storeTokens } from '@/lib/social/twitter/token-store';
import { SocialPlatform } from '@/types/database';
import { logger } from '@/lib/utils/logger';

/** Hono env with auth middleware variables */
type TwitterOAuthEnv = {
  Variables: {
    walletAddress: string;
    jwtToken: string;
  };
};

const twitterOAuth = new Hono<TwitterOAuthEnv>();

// All routes require authentication
twitterOAuth.use('/*', authMiddleware);

/**
 * In-memory PKCE state store (short-lived, per-request)
 * In production, use Redis or encrypted session cookies.
 * Keys are state tokens, values are { codeVerifier, walletAddress, expiresAt }
 */
const pendingAuths = new Map<
  string,
  { codeVerifier: string; walletAddress: string; expiresAt: number }
>();

/** Clean expired entries periodically */
const cleanExpired = () => {
  const now = Date.now();
  for (const [key, value] of pendingAuths) {
    if (value.expiresAt < now) {
      pendingAuths.delete(key);
    }
  }
};

/**
 * GET /api/social/twitter/authorize
 * Initiates Twitter OAuth 2.0 PKCE flow
 *
 * Returns the authorization URL for the client to redirect the user to.
 */
twitterOAuth.get('/authorize', async (c) => {
  const walletAddress = c.get('walletAddress');
  if (typeof walletAddress !== 'string') {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    logger.error('TWITTER_CLIENT_ID not configured');
    return c.json(
      { error: 'Twitter integration not configured', code: 'CONFIG_ERROR' },
      500
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/social/twitter/callback`;

  try {
    const authParams = await generateAuthUrl(clientId, redirectUri);

    // Store state + verifier for callback verification (10 minute TTL)
    cleanExpired();
    pendingAuths.set(authParams.state, {
      codeVerifier: authParams.codeVerifier,
      walletAddress,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return c.json({
      authorizeUrl: authParams.authorizeUrl,
      state: authParams.state,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to generate Twitter auth URL', { error: message });
    return c.json(
      { error: 'Failed to initiate Twitter authorization', code: 'OAUTH_ERROR' },
      500
    );
  }
});

/**
 * Callback query params from Twitter
 */
const CallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

/**
 * GET /api/social/twitter/callback
 * Handles OAuth callback from Twitter
 *
 * Exchanges auth code for tokens, creates/updates social_account,
 * stores encrypted tokens, then redirects to settings page.
 */
twitterOAuth.get('/callback', async (c) => {
  const queryResult = CallbackQuerySchema.safeParse(c.req.query());
  if (!queryResult.success) {
    // Check for error response from Twitter (user denied)
    const error = c.req.query('error');
    if (error) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return c.redirect(
        `${appUrl}/dashboard/settings/social?error=${encodeURIComponent(error)}`
      );
    }
    return c.json(
      { error: 'Missing code or state parameter', code: 'VALIDATION_ERROR' },
      400
    );
  }

  const { code, state } = queryResult.data;

  // Verify state and retrieve PKCE verifier
  const pending = pendingAuths.get(state);
  if (!pending) {
    return c.json(
      { error: 'Invalid or expired OAuth state', code: 'OAUTH_STATE_ERROR' },
      400
    );
  }

  // Consume the state (one-time use)
  pendingAuths.delete(state);

  // Check expiry
  if (pending.expiresAt < Date.now()) {
    return c.json(
      { error: 'OAuth state expired — please try again', code: 'OAUTH_EXPIRED' },
      400
    );
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    return c.json(
      { error: 'Twitter integration not configured', code: 'CONFIG_ERROR' },
      500
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/social/twitter/callback`;

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code, pending.codeVerifier, clientId, redirectUri);

    // Fetch Twitter user profile
    const twitterUser = await fetchTwitterUser(tokens.access_token);

    // Create or update social_account
    const jwtToken = c.get('jwtToken');
    if (typeof jwtToken !== 'string') {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const supabase = createAuthenticatedClient(jwtToken);

    // Check if account already exists for this wallet + twitter
    const { data: existing } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('wallet_address', pending.walletAddress)
      .eq('platform', SocialPlatform.TWITTER)
      .single();

    let socialAccountId: string;

    if (existing) {
      // Re-connect existing account
      socialAccountId = existing.id;
      await supabase
        .from('social_accounts')
        .update({
          is_connected: true,
          platform_account_id: twitterUser.id,
          platform_username: twitterUser.username,
          ayrshare_profile_key: twitterUser.id, // Store twitter user ID for reference
        } as Record<string, unknown>)
        .eq('id', socialAccountId);
    } else {
      // Create new social account
      const { data: newAccount, error: insertError } = await supabase
        .from('social_accounts')
        .insert({
          wallet_address: pending.walletAddress,
          platform: SocialPlatform.TWITTER,
          platform_account_id: twitterUser.id,
          platform_username: twitterUser.username,
          ayrshare_profile_key: twitterUser.id,
        })
        .select('id')
        .single();

      if (insertError || !newAccount) {
        throw new Error(`Failed to create social account: ${insertError?.message}`);
      }
      socialAccountId = newAccount.id;
    }

    // Store encrypted tokens
    await storeTokens(socialAccountId, tokens, twitterUser.id);

    logger.info('Twitter OAuth completed', {
      walletAddress: pending.walletAddress,
      twitterUsername: twitterUser.username,
    });

    // Redirect to settings page with success
    return c.redirect(
      `${appUrl}/dashboard/settings/social?connected=twitter&username=${encodeURIComponent(twitterUser.username)}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Twitter OAuth callback failed', { error: message });
    return c.redirect(
      `${appUrl}/dashboard/settings/social?error=${encodeURIComponent('Failed to connect Twitter account')}`
    );
  }
});

export { twitterOAuth };
