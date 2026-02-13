/**
 * Twitter/X Direct Adapter
 * SocialPublisher implementation using Twitter API v2 directly
 *
 * Wires together:
 *   - token-store: encrypted OAuth token retrieval with auto-refresh
 *   - client: Twitter API v2 for tweets, media, metrics
 *   - rate-limiter: exponential backoff on 429s
 *
 * The profileKey field from SocialPost maps to the social_account_id,
 * which is used to look up the encrypted OAuth tokens.
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
import { getAccessToken } from './twitter/token-store';
import { postTweet, uploadMedia, deleteTweet, getTweetMetrics } from './twitter/client';
import { injectTwitterAiDisclosure } from './ai-disclosure';

/**
 * Direct Twitter API costs $0 for posting (API access is free tier / Basic)
 * Set to 0 since there's no per-post API cost like Ayrshare
 */
const TWITTER_DIRECT_COST_USD = 0;

/**
 * SocialPublisher implementation for direct Twitter/X API integration.
 *
 * Only handles the 'twitter' platform — other platforms in the SocialPost
 * are silently skipped (they should be routed to the appropriate adapter).
 */
export class TwitterAdapter implements SocialPublisher {
  readonly provider = SocialProvider.DIRECT;

  async publish(post: SocialPost): Promise<PublishResult> {
    // Filter to only twitter platform
    const twitterPlatforms = post.platforms.filter((p) => p === SocialPlatform.TWITTER);
    if (twitterPlatforms.length === 0) {
      throw new PublisherError(
        'TwitterAdapter only supports the twitter platform',
        SocialProvider.DIRECT
      );
    }

    try {
      // profileKey = social_account_id for direct adapter
      const accessToken = await getAccessToken(post.profileKey);

      // Upload media if provided
      let mediaIds: string[] | undefined;
      if (post.mediaUrls && post.mediaUrls.length > 0) {
        mediaIds = [];
        for (const mediaUrl of post.mediaUrls) {
          const mediaId = await uploadMedia(mediaUrl, accessToken);
          mediaIds.push(mediaId);
        }
      }

      // Inject AI disclosure (NY S.B. S6524-A compliance)
      const disclosedText = injectTwitterAiDisclosure(post.text);

      // Post tweet
      const result = await postTweet(disclosedText, accessToken, mediaIds);

      logger.info('Twitter direct publish succeeded', {
        tweetId: result.tweetId,
      });

      return {
        provider: SocialProvider.DIRECT,
        externalId: result.tweetId,
        platformPostIds: { twitter: result.tweetId },
        platformPostUrls: { twitter: result.url },
        costUsd: TWITTER_DIRECT_COST_USD,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Twitter direct publish failed', { error: message });
      throw new PublisherError(message, SocialProvider.DIRECT, error);
    }
  }

  async delete(externalPostId: string, profileKey: string): Promise<void> {
    try {
      const accessToken = await getAccessToken(profileKey);
      await deleteTweet(externalPostId, accessToken);
      logger.info('Twitter direct delete succeeded', { tweetId: externalPostId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Twitter direct delete failed', { tweetId: externalPostId, error: message });
      throw new PublisherError(message, SocialProvider.DIRECT, error);
    }
  }

  async getAnalytics(externalPostId: string, profileKey: string): Promise<PostAnalytics> {
    try {
      const accessToken = await getAccessToken(profileKey);
      const metrics = await getTweetMetrics(externalPostId, accessToken);

      return {
        likes: metrics.likes,
        comments: metrics.replies,
        shares: metrics.retweets + metrics.quotes,
        views: metrics.impressions,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Twitter direct analytics failed', {
        tweetId: externalPostId,
        error: message,
      });
      throw new PublisherError(message, SocialProvider.DIRECT, error);
    }
  }
}
