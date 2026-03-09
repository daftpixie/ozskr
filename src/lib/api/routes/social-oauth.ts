/**
 * Social OAuth Routes
 * Token management for Yellow Brick command bar social publishing.
 *
 * Routes:
 *   GET  /api/social/oauth/status           — list connected providers for authed user
 *   DELETE /api/social/oauth/:provider      — revoke/delete token for a provider
 *   GET  /api/social/oauth/callback/:provider — OAuth callback: store token after OAuth flow
 *
 * Token storage: access_token is encrypted with AES-256-GCM using OAUTH_ENCRYPTION_KEY
 * (32-byte hex). If the key is absent (dev mode only), tokens are stored as-is with a warning.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { createAuthenticatedClient } from '../supabase';
import { logger } from '@/lib/utils/logger';
import { generateAuthUrl, exchangeCode, fetchTwitterUser, checkBioCompliance } from '@/lib/social/twitter/oauth';
import { storeTokens, getAccessToken } from '@/lib/social/twitter/token-store';

// ---------------------------------------------------------------------------
// Hono env type
// ---------------------------------------------------------------------------

type SocialOAuthEnv = {
  Variables: {
    walletAddress: string;
    jwtToken: string;
  };
};

// ---------------------------------------------------------------------------
// Supported OAuth providers (must match DB CHECK constraint)
// ---------------------------------------------------------------------------

const PROVIDERS = ['twitter', 'instagram', 'linkedin', 'tiktok'] as const;
type Provider = (typeof PROVIDERS)[number];

const ProviderSchema = z.enum(PROVIDERS);

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/**
 * Query params for the OAuth callback endpoint.
 * Either `code` (Authorization Code flow) or `access_token` (token flow) must be present,
 * but zValidator cannot enforce cross-field rules — that check is done in the handler.
 */
const CallbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  access_token: z.string().min(1).optional(),
  refresh_token: z.string().optional(),
  expires_in: z.string().optional(),
  error: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Encryption helpers
// ---------------------------------------------------------------------------

/**
 * Encrypt an OAuth token using AES-256-GCM.
 * Returns a colon-delimited string: `iv:authTag:ciphertext` (all hex-encoded).
 */
function encryptToken(token: string, key: string): string {
  const keyBuf = Buffer.from(key, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * Decrypt an AES-256-GCM token produced by `encryptToken`.
 */
function decryptToken(encrypted: string, key: string): string {
  const [ivHex, tagHex, dataHex] = encrypted.split(':');
  const keyBuf = Buffer.from(key, 'hex');
  const iv = Buffer.from(ivHex!, 'hex');
  const tag = Buffer.from(tagHex!, 'hex');
  const data = Buffer.from(dataHex!, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data).toString('utf8') + decipher.final('utf8');
}

/**
 * Apply encryption if OAUTH_ENCRYPTION_KEY is configured.
 * In dev mode (key absent) the token is stored as-is with a warning log.
 */
function maybeEncrypt(token: string): string {
  const key = process.env.OAUTH_ENCRYPTION_KEY;
  if (!key) {
    logger.warn('OAUTH_ENCRYPTION_KEY not set — storing OAuth token unencrypted (dev mode only)');
    return token;
  }
  return encryptToken(token, key);
}

// Exported for use in tests; not part of the public API surface.
export { encryptToken, decryptToken };

// ---------------------------------------------------------------------------
// Auth context helper (matches pattern used in social.ts)
// ---------------------------------------------------------------------------

function getAuthContext(c: { get: (key: string) => unknown }) {
  const walletAddress = c.get('walletAddress');
  const jwtToken = c.get('jwtToken');
  if (typeof walletAddress !== 'string' || typeof jwtToken !== 'string') {
    return null;
  }
  return { walletAddress, jwtToken };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const socialOAuthRoutes = new Hono<SocialOAuthEnv>();

// All routes require authentication
socialOAuthRoutes.use('/*', authMiddleware);

// ---------------------------------------------------------------------------
// GET /api/social/oauth/status
// Returns { connected: string[] } listing provider names with stored tokens.
// ---------------------------------------------------------------------------

socialOAuthRoutes.get('/status', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Resolve Supabase user ID from wallet address via users table
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', auth.walletAddress)
      .maybeSingle();

    if (userError) {
      logger.error('Failed to look up user for OAuth status', {
        walletAddress: auth.walletAddress,
        error: userError.message,
      });
      return c.json({ error: 'Failed to fetch OAuth status', code: 'DATABASE_ERROR' }, 500);
    }

    if (!userRow) {
      // No user row means no tokens — return empty list
      return c.json({ connected: [] }, 200);
    }

    const { data: tokens, error: tokensError } = await supabase
      .from('social_oauth_tokens')
      .select('provider')
      .eq('user_id', userRow.id);

    if (tokensError) {
      logger.error('Failed to query social_oauth_tokens', {
        walletAddress: auth.walletAddress,
        error: tokensError.message,
      });
      return c.json({ error: 'Failed to fetch OAuth status', code: 'DATABASE_ERROR' }, 500);
    }

    const connected = (tokens ?? []).map((t) => t.provider);
    return c.json({ connected }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Unexpected error in GET /social/oauth/status', { error: message });
    return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/social/oauth/:provider
// Revokes and deletes the stored token for a given provider.
// ---------------------------------------------------------------------------

socialOAuthRoutes.delete('/:provider', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const providerParam = c.req.param('provider');
  const providerResult = ProviderSchema.safeParse(providerParam);
  if (!providerResult.success) {
    return c.json(
      {
        error: `Invalid provider. Must be one of: ${PROVIDERS.join(', ')}`,
        code: 'VALIDATION_ERROR',
      },
      400
    );
  }
  const provider: Provider = providerResult.data;

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Resolve user ID
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', auth.walletAddress)
      .maybeSingle();

    if (userError) {
      logger.error('Failed to look up user for OAuth revoke', {
        walletAddress: auth.walletAddress,
        provider,
        error: userError.message,
      });
      return c.json({ error: 'Failed to revoke token', code: 'DATABASE_ERROR' }, 500);
    }

    if (!userRow) {
      return c.json({ error: 'Token not found', code: 'NOT_FOUND' }, 404);
    }

    const { error: deleteError, count } = await supabase
      .from('social_oauth_tokens')
      .delete({ count: 'exact' })
      .eq('user_id', userRow.id)
      .eq('provider', provider);

    if (deleteError) {
      logger.error('Failed to delete OAuth token', {
        walletAddress: auth.walletAddress,
        provider,
        error: deleteError.message,
      });
      return c.json({ error: 'Failed to revoke token', code: 'DATABASE_ERROR' }, 500);
    }

    if (!count || count === 0) {
      return c.json({ error: 'Token not found', code: 'NOT_FOUND' }, 404);
    }

    logger.info('OAuth token revoked', { walletAddress: auth.walletAddress, provider });
    return c.json({ success: true, message: `${provider} token revoked` }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Unexpected error in DELETE /social/oauth/:provider', {
      provider,
      error: message,
    });
    return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/social/oauth/callback/:provider
// OAuth callback handler — stores the token after the OAuth flow completes.
//
// Accepts either:
//   - Authorization Code flow: ?code=...&state=...
//   - Implicit / token flow:   ?access_token=...&refresh_token=...&expires_in=...
//
// After storing, redirects the user to the social settings page.
// ---------------------------------------------------------------------------

socialOAuthRoutes.get(
  '/callback/:provider',
  zValidator('query', CallbackQuerySchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const providerParam = c.req.param('provider');
    const providerResult = ProviderSchema.safeParse(providerParam);
    if (!providerResult.success) {
      return c.json(
        {
          error: `Invalid provider. Must be one of: ${PROVIDERS.join(', ')}`,
          code: 'VALIDATION_ERROR',
        },
        400
      );
    }
    const provider: Provider = providerResult.data;

    const query = c.req.valid('query');
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Handle provider-side error (e.g. user denied)
    if (query.error) {
      logger.warn('OAuth provider returned error', {
        provider,
        error: query.error,
        walletAddress: auth.walletAddress,
      });
      return c.redirect(
        `${appUrl}/dashboard/settings/social?error=${encodeURIComponent(query.error)}`
      );
    }

    // Require at least one token form
    const rawAccessToken = query.access_token ?? query.code;
    if (!rawAccessToken) {
      return c.json(
        { error: 'Missing access_token or code in callback', code: 'VALIDATION_ERROR' },
        400
      );
    }

    // Determine token expiry from expires_in (seconds), if provided
    let tokenExpiry: string | null = null;
    if (query.expires_in) {
      const expiresInSeconds = parseInt(query.expires_in, 10);
      if (!isNaN(expiresInSeconds) && expiresInSeconds > 0) {
        tokenExpiry = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
      }
    }

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Resolve Supabase user ID
      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', auth.walletAddress)
        .maybeSingle();

      if (userError || !userRow) {
        logger.error('Failed to look up user for OAuth callback', {
          walletAddress: auth.walletAddress,
          provider,
          error: userError?.message,
        });
        return c.redirect(
          `${appUrl}/dashboard/settings/social?error=${encodeURIComponent('Failed to store OAuth token')}`
        );
      }

      const encryptedAccessToken = maybeEncrypt(rawAccessToken);
      const encryptedRefreshToken =
        query.refresh_token ? maybeEncrypt(query.refresh_token) : null;

      // Upsert — re-connecting replaces the existing token
      const { error: upsertError } = await supabase
        .from('social_oauth_tokens')
        .upsert(
          {
            user_id: userRow.id,
            provider,
            access_token: encryptedAccessToken,
            refresh_token: encryptedRefreshToken,
            token_expiry: tokenExpiry,
            encrypted_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,provider' }
        );

      if (upsertError) {
        logger.error('Failed to upsert OAuth token', {
          walletAddress: auth.walletAddress,
          provider,
          error: upsertError.message,
        });
        return c.redirect(
          `${appUrl}/dashboard/settings/social?error=${encodeURIComponent('Failed to store OAuth token')}`
        );
      }

      logger.info('OAuth token stored', { walletAddress: auth.walletAddress, provider });

      return c.redirect(
        `${appUrl}/dashboard/settings/social?connected=${encodeURIComponent(provider)}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Unexpected error in GET /social/oauth/callback/:provider', {
        provider,
        error: message,
      });
      return c.redirect(
        `${appUrl}/dashboard/settings/social?error=${encodeURIComponent('Internal error during OAuth flow')}`
      );
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/social/oauth/twitter/initiate?character_id=<uuid>
// Generates PKCE code verifier + state, stores in pkce_state, redirects to
// Twitter's authorization endpoint.
// ---------------------------------------------------------------------------

socialOAuthRoutes.get('/twitter/initiate', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    logger.error('TWITTER_CLIENT_ID is not configured');
    return c.json({ error: 'Twitter integration is not configured', code: 'NOT_CONFIGURED' }, 503);
  }

  const characterId = c.req.query('character_id') ?? null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/social/oauth/twitter/callback`;

  try {
    const { authorizeUrl, state, codeVerifier } = await generateAuthUrl(clientId, redirectUri);

    const supabase = createAuthenticatedClient(auth.jwtToken);
    const { error: insertError } = await supabase.from('pkce_state').insert({
      state,
      code_verifier: codeVerifier,
      character_id: characterId,
      wallet_address: auth.walletAddress,
    });

    if (insertError) {
      logger.error('Failed to store PKCE state', { error: insertError.message });
      return c.json({ error: 'Failed to initiate OAuth flow', code: 'DATABASE_ERROR' }, 500);
    }

    logger.info('Twitter PKCE initiate', { walletAddress: auth.walletAddress, characterId });
    return c.redirect(authorizeUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Unexpected error in GET /social/oauth/twitter/initiate', { error: message });
    return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/social/oauth/twitter/callback?code=<code>&state=<state>
// PKCE code exchange callback. Looks up state from pkce_state, exchanges code,
// upserts social_accounts, stores encrypted tokens, then redirects.
// ---------------------------------------------------------------------------

socialOAuthRoutes.get('/twitter/callback', async (c) => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectBase = `${appUrl}/dashboard/social`;

  const code = c.req.query('code');
  const state = c.req.query('state');
  const providerError = c.req.query('error');

  if (providerError) {
    logger.warn('Twitter OAuth provider error in callback', { error: providerError });
    return c.redirect(`${redirectBase}?error=${encodeURIComponent(providerError)}`);
  }

  if (!code || !state) {
    return c.redirect(`${redirectBase}?error=${encodeURIComponent('Missing code or state in callback')}`);
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  if (!clientId) {
    return c.redirect(`${redirectBase}?error=${encodeURIComponent('Twitter integration is not configured')}`);
  }

  // Note: the callback does not go through authMiddleware because Twitter redirects
  // the browser here without the app's Authorization header. We use the wallet_address
  // stored in pkce_state (set at initiate time) to identify the user.
  // We use the service role client to read pkce_state.
  const { createSupabaseServerClient } = await import('@/lib/api/supabase');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return c.redirect(`${redirectBase}?error=${encodeURIComponent('Server misconfiguration')}`);
  }
  const supabase = createSupabaseServerClient(serviceRoleKey);

  try {
    // Look up PKCE state row
    const { data: pkceRow, error: pkceError } = await supabase
      .from('pkce_state')
      .select('*')
      .eq('state', state)
      .single();

    if (pkceError || !pkceRow) {
      logger.warn('PKCE state not found or already consumed', { state });
      return c.redirect(`${redirectBase}?error=${encodeURIComponent('Invalid or expired OAuth state')}`);
    }

    // Check TTL
    if (new Date(pkceRow.expires_at as string) < new Date()) {
      await supabase.from('pkce_state').delete().eq('state', state);
      logger.warn('PKCE state expired', { state });
      return c.redirect(`${redirectBase}?error=${encodeURIComponent('OAuth session expired. Please try again.')}`);
    }

    const walletAddress = pkceRow.wallet_address as string;
    const redirectUri = `${appUrl}/api/social/oauth/twitter/callback`;

    // Exchange the authorization code for tokens
    const tokens = await exchangeCode(code, pkceRow.code_verifier as string, clientId, redirectUri);

    // Fetch Twitter user profile
    const twitterUser = await fetchTwitterUser(tokens.access_token);

    // Upsert social_accounts row
    const { data: socialAccount, error: upsertError } = await supabase
      .from('social_accounts')
      .upsert(
        {
          wallet_address: walletAddress,
          platform: 'twitter',
          platform_account_id: twitterUser.id,
          platform_username: twitterUser.username,
          is_connected: true,
          connected_at: new Date().toISOString(),
          ayrshare_profile_key: '',
        },
        { onConflict: 'wallet_address,platform', ignoreDuplicates: false }
      )
      .select('id')
      .single();

    if (upsertError || !socialAccount) {
      logger.error('Failed to upsert social_accounts for Twitter', {
        walletAddress,
        error: upsertError?.message,
      });
      return c.redirect(`${redirectBase}?error=${encodeURIComponent('Failed to save account connection')}`);
    }

    // Store encrypted tokens
    await storeTokens(socialAccount.id as string, tokens, twitterUser.id);

    // Consume the PKCE state row
    await supabase.from('pkce_state').delete().eq('state', state);

    logger.info('Twitter PKCE OAuth complete', { walletAddress, twitterUsername: twitterUser.username });
    return c.redirect(`${redirectBase}?connected=twitter`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Unexpected error in GET /social/oauth/twitter/callback', { error: message });
    return c.redirect(`${redirectBase}?error=${encodeURIComponent('An unexpected error occurred. Please try again.')}`);
  }
});

// ---------------------------------------------------------------------------
// GET /api/social/oauth/twitter/bio-check
// Checks whether the connected Twitter account's bio contains "Automated"
// per X policy (Feb 2026) for agent-managed accounts.
// ---------------------------------------------------------------------------

socialOAuthRoutes.get('/twitter/bio-check', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    const { data: account, error: accountError } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('wallet_address', auth.walletAddress)
      .eq('platform', 'twitter')
      .eq('is_connected', true)
      .maybeSingle();

    if (accountError) {
      logger.error('Failed to query social_accounts for bio-check', { error: accountError.message });
      return c.json({ error: 'Database error', code: 'DATABASE_ERROR' }, 500);
    }

    if (!account) {
      return c.json({
        compliant: false,
        bio: null,
        message: 'No connected Twitter account',
      }, 200);
    }

    const accessToken = await getAccessToken(account.id as string);
    const twitterUser = await fetchTwitterUser(accessToken);
    const compliant = await checkBioCompliance(accessToken);
    const bio = twitterUser.description ?? null;

    return c.json({
      compliant,
      bio,
      message: compliant
        ? 'Bio is compliant with X agent policy'
        : 'Bio must contain "Automated by ozskr.ai" per X platform policy (Feb 2026)',
    }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Unexpected error in GET /social/oauth/twitter/bio-check', { error: message });
    return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
  }
});

export { socialOAuthRoutes };
