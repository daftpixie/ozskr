/**
 * Ayrshare Adapter
 * Wraps the existing Ayrshare API client with the SocialPublisher interface
 */

import { publishPost, getPostAnalytics, deletePost } from './ayrshare';
import { logger } from '@/lib/utils/logger';
import {
  SocialProvider,
  PublisherError,
  type SocialPublisher,
  type SocialPost,
  type PublishResult,
  type PostAnalytics,
} from './types';
import { injectAiDisclosure } from './ai-disclosure';

/**
 * Estimated cost per platform publish via Ayrshare
 * Based on Ayrshare Business plan pricing (~$0.01 per post per platform)
 */
const AYRSHARE_COST_PER_PLATFORM_USD = 0.01;

/**
 * SocialPublisher implementation backed by Ayrshare
 *
 * Delegates to the existing Ayrshare client functions in `./ayrshare.ts`,
 * normalizing results into the unified PublishResult format.
 */
export class AyrshareAdapter implements SocialPublisher {
  readonly provider = SocialProvider.AYRSHARE;

  async publish(post: SocialPost): Promise<PublishResult> {
    try {
      // Inject AI disclosure (NY S.B. S6524-A compliance)
      const disclosedText = injectAiDisclosure(post.text);

      const response = await publishPost({
        post: disclosedText,
        platforms: post.platforms,
        mediaUrls: post.mediaUrls,
        profileKey: post.profileKey,
      });

      const costUsd = post.platforms.length * AYRSHARE_COST_PER_PLATFORM_USD;

      logger.info('Ayrshare publish succeeded', {
        externalId: response.id,
        platforms: post.platforms,
        costUsd,
      });

      return {
        provider: SocialProvider.AYRSHARE,
        externalId: response.id,
        platformPostIds: response.postIds,
        platformPostUrls: response.postUrls ?? {},
        costUsd,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Ayrshare publish failed', {
        platforms: post.platforms,
        error: message,
      });
      throw new PublisherError(message, SocialProvider.AYRSHARE, error);
    }
  }

  async delete(externalPostId: string, profileKey: string): Promise<void> {
    try {
      await deletePost(externalPostId, profileKey);
      logger.info('Ayrshare delete succeeded', { externalPostId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Ayrshare delete failed', { externalPostId, error: message });
      throw new PublisherError(message, SocialProvider.AYRSHARE, error);
    }
  }

  async getAnalytics(externalPostId: string, profileKey: string): Promise<PostAnalytics> {
    try {
      const response = await getPostAnalytics(externalPostId, profileKey);

      return {
        likes: response.likes + response.favorites,
        comments: response.comments,
        shares: response.shares + response.retweets,
        views: response.views,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Ayrshare analytics failed', { externalPostId, error: message });
      throw new PublisherError(message, SocialProvider.AYRSHARE, error);
    }
  }
}
