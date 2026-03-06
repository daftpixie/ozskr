/**
 * Publisher Factory
 * Selects the appropriate SocialPublisher adapter based on feature flags
 *
 * Architecture:
 *   - AyrshareAdapter   — Ayrshare backend (Instagram, LinkedIn, TikTok)
 *   - TwitterAdapter    — Direct Twitter/X API v2 with OAuth 2.0 PKCE (per-user)
 *   - XDirectAdapter    — Direct X API v2 with OAuth 1.0a app credentials (single @ozskr account)
 */

import { getFeatureFlags } from '@/lib/feature-flags';
import { AyrshareAdapter } from './ayrshare-adapter';
import { XDirectAdapter } from './x-direct-adapter';
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
      publisher = new XDirectAdapter();
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

// =============================================================================
// X DIRECT (OAUTH 1.0A APP CREDENTIALS)
// =============================================================================

/** Cached XDirectAdapter singleton */
let xDirectPublisher: XDirectAdapter | null = null;

/**
 * Get the XDirectAdapter for posting as @ozskr via OAuth 1.0a app credentials.
 *
 * This is a separate path from the standard SocialPublisher flow:
 *   - No per-user OAuth token required
 *   - Reads X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET from env
 *   - Intended for single-account direct posting on the free/basic X API tier
 *
 * Throws XClientError at call time if credentials are missing.
 */
export const getXDirectPublisher = (): XDirectAdapter => {
  if (!xDirectPublisher) {
    xDirectPublisher = new XDirectAdapter();
  }
  return xDirectPublisher;
};

/**
 * Reset the X direct publisher singleton (for testing)
 */
export const resetXDirectPublisher = (): void => {
  xDirectPublisher = null;
};
