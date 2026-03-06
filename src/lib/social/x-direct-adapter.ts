/**
 * X Direct Adapter
 * SocialPublisher implementation for the @ozskr account using OAuth 1.0a
 * app-level credentials (X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET).
 *
 * This is distinct from TwitterAdapter (which uses per-user OAuth 2.0 PKCE tokens).
 * XDirectAdapter is for single-account posting on the free/basic X API tier — no
 * per-user token storage or refresh required.
 *
 * AI disclosure is injected automatically (NY S.B. S6524-A compliance).
 */

import { logger } from '@/lib/utils/logger';
import { SocialPlatform } from '@/types/database';
import {
  SocialProvider,
  PublisherError,
  type SocialPublisher,
  type SocialPost,
  type PublishResult,
  type PostAnalytics,
} from './types';
import { createXClient, XClientError } from './x-client';
import { injectTwitterAiDisclosure } from './ai-disclosure';
import { validatePublicImageUrl } from './image-url-validator';

/**
 * Direct X API cost is $0 per post (app credentials, no Ayrshare intermediary)
 */
const X_DIRECT_COST_USD = 0;

/**
 * SocialPublisher backed by OAuth 1.0a app credentials for single-account @ozskr posting.
 *
 * Handles only the 'twitter' platform — other platforms are rejected.
 * Image media URLs are downloaded and re-uploaded to X before posting.
 */
export class XDirectAdapter implements SocialPublisher {
  readonly provider = SocialProvider.DIRECT;

  async publish(post: SocialPost): Promise<PublishResult> {
    // Only handles twitter platform
    const hasTwitter = post.platforms.some((p) => p === SocialPlatform.TWITTER);
    if (!hasTwitter) {
      throw new PublisherError(
        'XDirectAdapter only supports the twitter platform',
        SocialProvider.DIRECT
      );
    }

    try {
      const client = createXClient();

      // Inject AI disclosure before anything else (NY S.B. S6524-A)
      const disclosedText = injectTwitterAiDisclosure(post.text);

      // Download and upload media if provided
      let mediaIds: string[] | undefined;
      if (post.mediaUrls && post.mediaUrls.length > 0) {
        mediaIds = [];
        for (const mediaUrl of post.mediaUrls) {
          // SECURITY: Validate mediaUrl is a public HTTPS domain (SSRF guard)
          validatePublicImageUrl(mediaUrl);

          const mediaResponse = await fetch(mediaUrl);
          if (!mediaResponse.ok) {
            throw new XClientError(
              `Failed to download media from ${mediaUrl}: ${mediaResponse.statusText}`,
              mediaResponse.status
            );
          }
          const contentType = mediaResponse.headers.get('content-type') ?? 'image/jpeg';
          const arrayBuffer = await mediaResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const mediaId = await client.uploadMedia(buffer, contentType);
          mediaIds.push(mediaId);
        }
      }

      const result = await client.postTweet(disclosedText, mediaIds);

      logger.info('X direct (OAuth 1.0a) publish succeeded', {
        tweetId: result.tweetId,
        platforms: post.platforms,
      });

      return {
        provider: SocialProvider.DIRECT,
        externalId: result.tweetId,
        platformPostIds: { twitter: result.tweetId },
        platformPostUrls: { twitter: result.tweetUrl },
        costUsd: X_DIRECT_COST_USD,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('X direct publish failed', { error: message });
      throw new PublisherError(message, SocialProvider.DIRECT, error);
    }
  }

  async delete(_externalPostId: string, _profileKey: string): Promise<void> {
    throw new PublisherError(
      'XDirectAdapter: delete is not supported for OAuth 1.0a app credentials. ' +
        'Use TwitterAdapter with user OAuth 2.0 tokens to delete user-owned tweets.',
      SocialProvider.DIRECT
    );
  }

  async getAnalytics(_externalPostId: string, _profileKey: string): Promise<PostAnalytics> {
    // Analytics read (GET /2/tweets/:id?tweet.fields=public_metrics) requires
    // Bearer token auth, not OAuth 1.0a. Wire up when needed.
    throw new PublisherError(
      'XDirectAdapter: analytics are not yet implemented for OAuth 1.0a app credentials.',
      SocialProvider.DIRECT
    );
  }
}
