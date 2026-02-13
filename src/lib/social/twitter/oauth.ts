/**
 * Twitter/X OAuth 2.0 PKCE Flow
 * Public client authorization — no client_secret for user tokens
 *
 * Flow:
 *   1. generateAuthUrl() — creates PKCE challenge, returns authorize URL + verifier
 *   2. exchangeCode()    — swaps authorization code for access + refresh tokens
 *   3. refreshToken()    — refreshes expired access token using refresh token
 *
 * Scopes: tweet.read, tweet.write, users.read, offline.access
 * Reference: https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code
 */

import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

const TWITTER_AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
const TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';

/**
 * Required OAuth scopes for ozskr.ai publishing
 * - tweet.read: read own tweets for analytics
 * - tweet.write: post tweets
 * - users.read: fetch own profile info
 * - offline.access: get refresh token for long-lived access
 */
const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];

/**
 * Token response from Twitter OAuth 2.0
 */
const TokenResponseSchema = z.object({
  token_type: z.string(),
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
  scope: z.string(),
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;

/**
 * Twitter user info from /2/users/me
 */
const TwitterUserSchema = z.object({
  data: z.object({
    id: z.string(),
    name: z.string(),
    username: z.string(),
  }),
});

export type TwitterUser = z.infer<typeof TwitterUserSchema>['data'];

export class TwitterOAuthError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'TwitterOAuthError';
  }
}

/**
 * Generate a cryptographically random string for PKCE/state
 */
const generateRandomString = (length: number): string => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length);
};

/**
 * Generate PKCE code verifier (43-128 chars, unreserved URI chars)
 */
const generateCodeVerifier = (): string => {
  return generateRandomString(64);
};

/**
 * Generate PKCE code challenge from verifier (SHA-256, base64url)
 */
const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  // Convert to base64url
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * Authorization URL result — caller must store state + verifier for callback
 */
export interface AuthorizationParams {
  /** Full authorize URL to redirect user to */
  authorizeUrl: string;
  /** CSRF state token — must match in callback */
  state: string;
  /** PKCE code verifier — needed to exchange auth code for tokens */
  codeVerifier: string;
}

/**
 * Generate Twitter OAuth 2.0 authorization URL with PKCE
 *
 * @param clientId - Twitter OAuth 2.0 Client ID
 * @param redirectUri - Registered callback URI
 * @returns Authorization params including URL, state, and PKCE verifier
 */
export const generateAuthUrl = async (
  clientId: string,
  redirectUri: string
): Promise<AuthorizationParams> => {
  const state = generateRandomString(32);
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return {
    authorizeUrl: `${TWITTER_AUTH_URL}?${params.toString()}`,
    state,
    codeVerifier,
  };
};

/**
 * Exchange authorization code for access + refresh tokens
 *
 * @param code - Authorization code from callback
 * @param codeVerifier - PKCE verifier from generateAuthUrl
 * @param clientId - Twitter OAuth 2.0 Client ID
 * @param redirectUri - Same redirect URI used in authorize request
 * @returns Token response with access_token, refresh_token, expires_in
 */
export const exchangeCode = async (
  code: string,
  codeVerifier: string,
  clientId: string,
  redirectUri: string
): Promise<TokenResponse> => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  try {
    const response = await fetch(TWITTER_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new TwitterOAuthError(
        `Token exchange failed: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const data: unknown = await response.json();
    return TokenResponseSchema.parse(data);
  } catch (error) {
    if (error instanceof TwitterOAuthError) throw error;
    if (error instanceof z.ZodError) {
      throw new TwitterOAuthError('Invalid token response from Twitter', undefined, error.issues);
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new TwitterOAuthError(`Token exchange failed: ${message}`);
  }
};

/**
 * Refresh an expired access token
 *
 * @param refreshTokenValue - Current refresh token
 * @param clientId - Twitter OAuth 2.0 Client ID
 * @returns New token response (includes new refresh_token — must update stored value)
 */
export const refreshAccessToken = async (
  refreshTokenValue: string,
  clientId: string
): Promise<TokenResponse> => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshTokenValue,
    client_id: clientId,
  });

  try {
    const response = await fetch(TWITTER_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      logger.error('Twitter token refresh failed', {
        status: response.status,
      });
      throw new TwitterOAuthError(
        `Token refresh failed: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const data: unknown = await response.json();
    return TokenResponseSchema.parse(data);
  } catch (error) {
    if (error instanceof TwitterOAuthError) throw error;
    if (error instanceof z.ZodError) {
      throw new TwitterOAuthError('Invalid refresh response from Twitter', undefined, error.issues);
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new TwitterOAuthError(`Token refresh failed: ${message}`);
  }
};

/**
 * Fetch the authenticated user's Twitter profile
 *
 * @param accessToken - Valid OAuth 2.0 access token
 * @returns Twitter user data (id, name, username)
 */
export const fetchTwitterUser = async (accessToken: string): Promise<TwitterUser> => {
  try {
    const response = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new TwitterOAuthError(
        `Failed to fetch user profile: ${response.statusText}`,
        response.status
      );
    }

    const data: unknown = await response.json();
    return TwitterUserSchema.parse(data).data;
  } catch (error) {
    if (error instanceof TwitterOAuthError) throw error;
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new TwitterOAuthError(`Failed to fetch user profile: ${message}`);
  }
};
