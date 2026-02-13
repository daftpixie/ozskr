/**
 * Twitter/X API v2 Client
 * Tweet posting, media upload, deletion, and metrics
 *
 * All requests go through the rate limiter and use OAuth 2.0 user tokens.
 * Media uploads use the v1.1 upload endpoint (v2 does not yet support it).
 */

import { z } from 'zod';
import { logger } from '@/lib/utils/logger';
import { rateLimitedFetch } from './rate-limiter';

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

const TweetMetricsResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    public_metrics: z.object({
      retweet_count: z.number(),
      reply_count: z.number(),
      like_count: z.number(),
      quote_count: z.number(),
      bookmark_count: z.number().optional().default(0),
      impression_count: z.number().optional().default(0),
    }),
  }),
});

const MediaUploadResponseSchema = z.object({
  media_id_string: z.string(),
});

// =============================================================================
// ERROR
// =============================================================================

export class TwitterApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'TwitterApiError';
  }
}

// =============================================================================
// TYPES
// =============================================================================

export interface TweetResult {
  tweetId: string;
  text: string;
  url: string;
}

export interface TweetMetrics {
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  impressions: number;
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Make an authenticated request to Twitter API with rate limiting
 */
const twitterFetch = async (
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> => {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return rateLimitedFetch(url, { ...options, headers });
};

// =============================================================================
// MEDIA UPLOAD
// =============================================================================

/**
 * Upload media (image) to Twitter for attachment to a tweet.
 * Uses v1.1 media upload endpoint (v2 does not support media upload yet).
 *
 * @param mediaUrl - Public URL of the media to upload
 * @param accessToken - OAuth 2.0 access token
 * @returns media_id_string for tweet attachment
 */
export const uploadMedia = async (
  mediaUrl: string,
  accessToken: string
): Promise<string> => {
  try {
    // Download the media first
    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) {
      throw new TwitterApiError(`Failed to download media from ${mediaUrl}`, mediaResponse.status);
    }

    const mediaBuffer = await mediaResponse.arrayBuffer();

    const response = await twitterFetch(TWITTER_UPLOAD_URL, accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        media_data: Buffer.from(mediaBuffer).toString('base64'),
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new TwitterApiError(
        `Media upload failed: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const data: unknown = await response.json();
    const parsed = MediaUploadResponseSchema.parse(data);

    logger.info('Twitter media uploaded', { mediaId: parsed.media_id_string });
    return parsed.media_id_string;
  } catch (error) {
    if (error instanceof TwitterApiError) throw error;
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new TwitterApiError(`Media upload failed: ${message}`);
  }
};

// =============================================================================
// TWEET OPERATIONS
// =============================================================================

/**
 * Post a tweet with optional media attachments
 *
 * @param text - Tweet text (max 280 chars)
 * @param accessToken - OAuth 2.0 access token
 * @param mediaIds - Optional array of media_id_string values from uploadMedia
 * @returns Tweet ID, text, and URL
 */
export const postTweet = async (
  text: string,
  accessToken: string,
  mediaIds?: string[]
): Promise<TweetResult> => {
  const body: Record<string, unknown> = { text };

  if (mediaIds && mediaIds.length > 0) {
    body.media = { media_ids: mediaIds };
  }

  try {
    const response = await twitterFetch(`${TWITTER_API_V2}/tweets`, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new TwitterApiError(
        `Tweet creation failed: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const data: unknown = await response.json();
    const parsed = CreateTweetResponseSchema.parse(data);

    const tweetUrl = `https://twitter.com/i/status/${parsed.data.id}`;

    logger.info('Tweet posted', { tweetId: parsed.data.id });

    return {
      tweetId: parsed.data.id,
      text: parsed.data.text,
      url: tweetUrl,
    };
  } catch (error) {
    if (error instanceof TwitterApiError) throw error;
    if (error instanceof z.ZodError) {
      throw new TwitterApiError('Invalid tweet response from Twitter', undefined, error.issues);
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new TwitterApiError(`Tweet creation failed: ${message}`);
  }
};

/**
 * Delete a tweet
 *
 * @param tweetId - ID of the tweet to delete
 * @param accessToken - OAuth 2.0 access token
 */
export const deleteTweet = async (tweetId: string, accessToken: string): Promise<void> => {
  try {
    const response = await twitterFetch(`${TWITTER_API_V2}/tweets/${tweetId}`, accessToken, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new TwitterApiError(
        `Tweet deletion failed: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    logger.info('Tweet deleted', { tweetId });
  } catch (error) {
    if (error instanceof TwitterApiError) throw error;
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new TwitterApiError(`Tweet deletion failed: ${message}`);
  }
};

/**
 * Fetch engagement metrics for a tweet
 *
 * @param tweetId - ID of the tweet
 * @param accessToken - OAuth 2.0 access token
 * @returns Engagement metrics
 */
export const getTweetMetrics = async (
  tweetId: string,
  accessToken: string
): Promise<TweetMetrics> => {
  try {
    const url = `${TWITTER_API_V2}/tweets/${tweetId}?tweet.fields=public_metrics`;

    const response = await twitterFetch(url, accessToken, { method: 'GET' });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new TwitterApiError(
        `Tweet metrics fetch failed: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const data: unknown = await response.json();
    const parsed = TweetMetricsResponseSchema.parse(data);
    const m = parsed.data.public_metrics;

    return {
      likes: m.like_count,
      retweets: m.retweet_count,
      replies: m.reply_count,
      quotes: m.quote_count,
      impressions: m.impression_count,
    };
  } catch (error) {
    if (error instanceof TwitterApiError) throw error;
    if (error instanceof z.ZodError) {
      throw new TwitterApiError('Invalid metrics response from Twitter', undefined, error.issues);
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new TwitterApiError(`Tweet metrics fetch failed: ${message}`);
  }
};
