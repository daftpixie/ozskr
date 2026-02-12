/**
 * Ayrshare API Client
 * Social media publishing and analytics integration
 */

import { z } from 'zod';
import type { SocialPlatform } from '@/types/database';

const AYRSHARE_BASE_URL = 'https://app.ayrshare.com/api';

/**
 * Ayrshare API authentication error
 */
export class AyrshareAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AyrshareAuthError';
  }
}

/**
 * Ayrshare API request error
 */
export class AyrshareRequestError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AyrshareRequestError';
  }
}

/**
 * Convert our SocialPlatform enum to Ayrshare platform string
 */
const mapPlatform = (platform: SocialPlatform): string => {
  // Our enum values match Ayrshare's platform strings
  return platform;
};

/**
 * Publish post response schema
 */
const PublishResponseSchema = z.object({
  id: z.string(),
  postIds: z.record(z.string(), z.string()),
  postUrls: z.record(z.string(), z.string()).optional(),
  errors: z.array(z.unknown()).optional(),
});

export type PublishResponse = z.infer<typeof PublishResponseSchema>;

/**
 * Post analytics response schema
 */
const AnalyticsResponseSchema = z.object({
  likes: z.number().optional().default(0),
  comments: z.number().optional().default(0),
  shares: z.number().optional().default(0),
  views: z.number().optional().default(0),
  retweets: z.number().optional().default(0),
  favorites: z.number().optional().default(0),
});

export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;

/**
 * Delete post response schema
 */
const DeleteResponseSchema = z.object({
  status: z.string(),
});

/**
 * Publish content to social media platforms
 *
 * @param params - Post parameters
 * @returns Publish response with post IDs and URLs
 */
export const publishPost = async (params: {
  post: string;
  platforms: SocialPlatform[];
  mediaUrls?: string[];
  profileKey: string;
}): Promise<PublishResponse> => {
  const apiKey = process.env.AYRSHARE_API_KEY;
  if (!apiKey) {
    throw new AyrshareAuthError('AYRSHARE_API_KEY environment variable not set');
  }

  const body = {
    post: params.post,
    platforms: params.platforms.map(mapPlatform),
    mediaUrls: params.mediaUrls,
    profileKey: params.profileKey,
  };

  try {
    const response = await fetch(`${AYRSHARE_BASE_URL}/post`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new AyrshareRequestError(
        `Ayrshare API request failed: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const data: unknown = await response.json();
    return PublishResponseSchema.parse(data);
  } catch (error) {
    if (error instanceof AyrshareRequestError || error instanceof AyrshareAuthError) {
      throw error;
    }
    if (error instanceof z.ZodError) {
      throw new AyrshareRequestError('Invalid response from Ayrshare API', undefined, error.issues);
    }
    throw new AyrshareRequestError(
      `Failed to publish post: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Get analytics for a published post
 *
 * @param postId - Ayrshare post ID
 * @param profileKey - User's profile key
 * @returns Engagement metrics
 */
export const getPostAnalytics = async (
  postId: string,
  profileKey: string
): Promise<AnalyticsResponse> => {
  const apiKey = process.env.AYRSHARE_API_KEY;
  if (!apiKey) {
    throw new AyrshareAuthError('AYRSHARE_API_KEY environment variable not set');
  }

  try {
    const url = new URL(`${AYRSHARE_BASE_URL}/analytics/post`);
    url.searchParams.set('id', postId);
    url.searchParams.set('profileKey', profileKey);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new AyrshareRequestError(
        `Ayrshare API request failed: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const data: unknown = await response.json();
    return AnalyticsResponseSchema.parse(data);
  } catch (error) {
    if (error instanceof AyrshareRequestError || error instanceof AyrshareAuthError) {
      throw error;
    }
    if (error instanceof z.ZodError) {
      throw new AyrshareRequestError('Invalid response from Ayrshare API', undefined, error.issues);
    }
    throw new AyrshareRequestError(
      `Failed to get post analytics: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

/**
 * Delete a published post
 *
 * @param postId - Ayrshare post ID
 * @param profileKey - User's profile key
 */
export const deletePost = async (postId: string, profileKey: string): Promise<void> => {
  const apiKey = process.env.AYRSHARE_API_KEY;
  if (!apiKey) {
    throw new AyrshareAuthError('AYRSHARE_API_KEY environment variable not set');
  }

  try {
    const response = await fetch(`${AYRSHARE_BASE_URL}/post`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: postId,
        profileKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new AyrshareRequestError(
        `Ayrshare API request failed: ${response.statusText}`,
        response.status,
        errorText
      );
    }

    const data: unknown = await response.json();
    DeleteResponseSchema.parse(data);
  } catch (error) {
    if (error instanceof AyrshareRequestError || error instanceof AyrshareAuthError) {
      throw error;
    }
    if (error instanceof z.ZodError) {
      throw new AyrshareRequestError('Invalid response from Ayrshare API', undefined, error.issues);
    }
    throw new AyrshareRequestError(
      `Failed to delete post: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};
