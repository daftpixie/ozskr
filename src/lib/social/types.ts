/**
 * SocialPublisher Abstraction Layer
 * Unified interface for social media publishing across multiple backend providers
 */

import { z } from 'zod';
import type { SocialPlatform } from '@/types/database';

// =============================================================================
// PROVIDER ENUM
// =============================================================================

/**
 * Backend provider for social media publishing
 * Platform (twitter, instagram, etc.) is separate from provider (ayrshare, direct API)
 */
export enum SocialProvider {
  AYRSHARE = 'ayrshare',
  DIRECT = 'direct', // Future: direct Twitter/X API
}

export const SocialProviderSchema = z.nativeEnum(SocialProvider);

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Content to publish via the SocialPublisher abstraction
 */
export interface SocialPost {
  /** Text content to publish */
  text: string;
  /** Target platforms */
  platforms: SocialPlatform[];
  /** Optional media attachment URLs */
  mediaUrls?: string[];
  /** Provider-specific profile/auth key */
  profileKey: string;
}

// =============================================================================
// RESULT TYPES
// =============================================================================

/**
 * Result from a successful publish operation
 */
export interface PublishResult {
  /** Which provider handled the publish */
  provider: SocialProvider;
  /** Provider-level external ID for the publish batch */
  externalId: string;
  /** Per-platform post IDs returned by the provider */
  platformPostIds: Record<string, string>;
  /** Per-platform post URLs returned by the provider */
  platformPostUrls: Record<string, string>;
  /** Estimated cost in USD for this publish call */
  costUsd: number;
}

/**
 * Post analytics returned by the provider
 */
export interface PostAnalytics {
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

// =============================================================================
// PUBLISHER INTERFACE
// =============================================================================

/**
 * Unified interface for social media publishing backends.
 *
 * Implementations wrap provider-specific APIs (Ayrshare, direct Twitter/X, etc.)
 * behind a common contract. Content MUST pass moderation before reaching this layer.
 */
export interface SocialPublisher {
  /** Which provider this publisher uses */
  readonly provider: SocialProvider;

  /**
   * Publish content to one or more social platforms
   * @throws PublisherError on failure
   */
  publish(post: SocialPost): Promise<PublishResult>;

  /**
   * Delete a previously published post
   * @param externalPostId - Provider-level post ID
   * @param profileKey - Provider-specific profile/auth key
   * @throws PublisherError on failure
   */
  delete(externalPostId: string, profileKey: string): Promise<void>;

  /**
   * Fetch analytics/engagement for a published post
   * @param externalPostId - Provider-level post ID
   * @param profileKey - Provider-specific profile/auth key
   * @throws PublisherError on failure
   */
  getAnalytics(externalPostId: string, profileKey: string): Promise<PostAnalytics>;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Base error for publisher operations
 */
export class PublisherError extends Error {
  constructor(
    message: string,
    public provider: SocialProvider,
    public details?: unknown
  ) {
    super(message);
    this.name = 'PublisherError';
  }
}
