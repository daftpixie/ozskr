/**
 * X (Twitter) API v2 Direct Client
 * OAuth 1.0a app-level credentials for posting as @ozskr
 *
 * Uses app-level credentials from environment variables — no per-user OAuth
 * flow required. Suitable for single-account posting on the free/basic tier.
 *
 * Credentials required (set in .env.local / Vercel env):
 *   X_API_KEY             — OAuth 1.0a Consumer Key
 *   X_API_SECRET          — OAuth 1.0a Consumer Secret
 *   X_ACCESS_TOKEN        — OAuth 1.0a Access Token (for @ozskr)
 *   X_ACCESS_TOKEN_SECRET — OAuth 1.0a Access Token Secret
 *
 * OAuth 1.0a reference:
 *   https://developer.twitter.com/en/docs/authentication/oauth-1-0a
 */

import { createHmac, randomBytes } from 'crypto';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { rateLimitedFetch } from './twitter/rate-limiter';

const TWITTER_API_V2 = 'https://api.twitter.com/2';
const TWITTER_UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';

// =============================================================================
// RESPONSE SCHEMAS
// =============================================================================

const CreateTweetResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    text: z.string(),
  }),
});

const MediaUploadResponseSchema = z.object({
  media_id_string: z.string(),
});

// =============================================================================
// ERRORS
// =============================================================================

export class XClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'XClientError';
  }
}

// =============================================================================
// RESULT TYPES
// =============================================================================

export interface PostTweetResult {
  tweetId: string;
  tweetUrl: string;
}

// =============================================================================
// OAUTH 1.0a SIGNATURE GENERATION
// =============================================================================

/**
 * Percent-encode a string per RFC 3986
 * Twitter requires this encoding for OAuth signature components.
 */
const percentEncode = (value: string): string =>
  encodeURIComponent(value)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');

/**
 * Generate a cryptographically random nonce string
 */
const generateNonce = (): string => randomBytes(16).toString('hex');

/**
 * Build the OAuth 1.0a Authorization header for a given request.
 *
 * Steps per spec:
 *  1. Collect all OAuth params + any query/body params
 *  2. Sort and percent-encode all key=value pairs
 *  3. Build signature base string: METHOD&encoded_url&encoded_params
 *  4. Sign with HMAC-SHA1 using consumerSecret&tokenSecret
 *  5. Assemble Authorization header
 *
 * @param method       HTTP method (GET, POST)
 * @param url          Full request URL (no query string)
 * @param credentials  App + user credentials
 * @param extraParams  Additional params to include in signature (e.g. form fields)
 */
const buildOAuthHeader = (
  method: string,
  url: string,
  credentials: XClientCredentials,
  extraParams: Record<string, string> = {}
): string => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  // OAuth protocol parameters
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: credentials.accessToken,
    oauth_version: '1.0',
  };

  // Collect all parameters for signature base string
  const allParams: Record<string, string> = { ...oauthParams, ...extraParams };

  // Sort parameters alphabetically by key, percent-encode each key and value
  const sortedParams = Object.entries(allParams)
    .map(([k, v]) => [percentEncode(k), percentEncode(v)] as [string, string])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  // Signature base string: METHOD&percent_encoded_url&percent_encoded_params
  const signatureBaseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sortedParams),
  ].join('&');

  // Signing key: percent_encoded_consumer_secret&percent_encoded_token_secret
  const signingKey = `${percentEncode(credentials.apiSecret)}&${percentEncode(credentials.accessTokenSecret)}`;

  // HMAC-SHA1 signature, base64-encoded
  const signature = createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  // Build OAuth header value with signature included
  const headerParams = { ...oauthParams, oauth_signature: signature };

  const headerValue = Object.entries(headerParams)
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(', ');

  return `OAuth ${headerValue}`;
};

// =============================================================================
// CREDENTIALS
// =============================================================================

export interface XClientCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

/**
 * Read OAuth 1.0a credentials from environment variables.
 * Throws a clear error if any required credential is missing.
 */
const readCredentialsFromEnv = (): XClientCredentials => {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  const missing: string[] = [];
  if (!apiKey) missing.push('X_API_KEY');
  if (!apiSecret) missing.push('X_API_SECRET');
  if (!accessToken) missing.push('X_ACCESS_TOKEN');
  if (!accessTokenSecret) missing.push('X_ACCESS_TOKEN_SECRET');

  if (missing.length > 0) {
    throw new XClientError(
      `Missing required X API credentials: ${missing.join(', ')}. ` +
        'Set these environment variables to enable direct X posting.'
    );
  }

  return {
    apiKey: apiKey!,
    apiSecret: apiSecret!,
    accessToken: accessToken!,
    accessTokenSecret: accessTokenSecret!,
  };
};

// =============================================================================
// CLIENT
// =============================================================================

export class XClient {
  private readonly credentials: XClientCredentials;

  constructor(credentials: XClientCredentials) {
    this.credentials = credentials;
  }

  /**
   * Post a tweet with optional media attachments.
   *
   * @param text      Tweet text (max 280 chars, enforced by X API)
   * @param mediaIds  Optional array of media IDs from uploadMedia()
   * @returns tweetId and public tweetUrl
   */
  async postTweet(text: string, mediaIds?: string[]): Promise<PostTweetResult> {
    const url = `${TWITTER_API_V2}/tweets`;
    const authHeader = buildOAuthHeader('POST', url, this.credentials);

    const body: Record<string, unknown> = { text };
    if (mediaIds && mediaIds.length > 0) {
      body.media = { media_ids: mediaIds };
    }

    try {
      const response = await rateLimitedFetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new XClientError(
          `Tweet creation failed: ${response.statusText}`,
          response.status,
          errorText
        );
      }

      const data: unknown = await response.json();
      const parsed = CreateTweetResponseSchema.parse(data);
      const tweetId = parsed.data.id;
      const tweetUrl = `https://x.com/i/status/${tweetId}`;

      logger.info('X direct tweet posted', { tweetId });

      return { tweetId, tweetUrl };
    } catch (error) {
      if (error instanceof XClientError) throw error;
      if (error instanceof z.ZodError) {
        throw new XClientError('Invalid tweet response from X API', undefined, error.issues);
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new XClientError(`Tweet creation failed: ${message}`);
    }
  }

  /**
   * Upload an image buffer to X via the v1.1 media upload endpoint.
   * The v2 API does not yet support media uploads.
   *
   * @param buffer    Raw image bytes
   * @param mimeType  MIME type of the image (e.g. "image/jpeg", "image/png")
   * @returns media_id_string for attachment to a tweet
   */
  async uploadMedia(buffer: Buffer, mimeType: string): Promise<string> {
    // The media upload endpoint uses OAuth 1.0a but does NOT include the
    // media_data body param in the OAuth signature — only the URL is signed.
    const authHeader = buildOAuthHeader('POST', TWITTER_UPLOAD_URL, this.credentials);
    const base64Data = buffer.toString('base64');

    try {
      const body = new URLSearchParams({
        media_data: base64Data,
        media_type: mimeType,
      });

      const response = await rateLimitedFetch(TWITTER_UPLOAD_URL, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new XClientError(
          `Media upload failed: ${response.statusText}`,
          response.status,
          errorText
        );
      }

      const data: unknown = await response.json();
      const parsed = MediaUploadResponseSchema.parse(data);

      logger.info('X media uploaded', { mediaId: parsed.media_id_string });
      return parsed.media_id_string;
    } catch (error) {
      if (error instanceof XClientError) throw error;
      if (error instanceof z.ZodError) {
        throw new XClientError('Invalid media upload response from X API', undefined, error.issues);
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new XClientError(`Media upload failed: ${message}`);
    }
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create an XClient instance using credentials from environment variables.
 *
 * Reads X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.
 * Throws XClientError with a clear message if any credential is missing.
 */
export const createXClient = (): XClient => {
  const credentials = readCredentialsFromEnv();
  return new XClient(credentials);
};
