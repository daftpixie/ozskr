/**
 * Publisher Factory
 * Selects the appropriate SocialPublisher adapter based on feature flags
 */

import { getFeatureFlags } from '@/lib/feature-flags';
import { AyrshareAdapter } from './ayrshare-adapter';
import { TwitterAdapter } from './twitter-adapter';
import { SocialProvider, type SocialPublisher } from './types';

/** Cached publisher instance per provider (adapters are stateless singletons) */
const publisherCache = new Map<SocialProvider, SocialPublisher>();

/**
 * Create or retrieve a SocialPublisher for the given provider
 */
const getPublisherForProvider = (provider: SocialProvider): SocialPublisher => {
  const cached = publisherCache.get(provider);
  if (cached) return cached;

  let publisher: SocialPublisher;

  switch (provider) {
    case SocialProvider.AYRSHARE:
      publisher = new AyrshareAdapter();
      break;
    case SocialProvider.DIRECT:
      publisher = new TwitterAdapter();
      break;
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown social provider: ${_exhaustive}`);
    }
  }

  publisherCache.set(provider, publisher);
  return publisher;
};

/**
 * Get the active SocialPublisher based on feature flags
 *
 * Uses `socialPublishProvider` flag to select the backend.
 * Falls back to Ayrshare if publishing is disabled (caller should
 * check `socialPublishEnabled` before calling publish).
 */
export const getPublisher = (): SocialPublisher => {
  const flags = getFeatureFlags();
  const provider = flags.socialPublishProvider;

  return getPublisherForProvider(provider);
};

/**
 * Check if social publishing is enabled
 */
export const isPublishingEnabled = (): boolean => {
  const flags = getFeatureFlags();
  return flags.socialPublishEnabled;
};

/**
 * Reset the publisher cache (for testing)
 */
export const resetPublisherCache = (): void => {
  publisherCache.clear();
};
