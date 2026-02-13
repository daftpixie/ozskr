/**
 * Publisher Factory Tests
 * Tests provider selection via feature flags
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SocialProvider } from './types';

// Hoisted mocks
const { mockGetFeatureFlags } = vi.hoisted(() => ({
  mockGetFeatureFlags: vi.fn(),
}));

vi.mock('@/lib/feature-flags', () => ({
  getFeatureFlags: mockGetFeatureFlags,
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getPublisher, isPublishingEnabled, resetPublisherCache } from './publisher-factory';
import { AyrshareAdapter } from './ayrshare-adapter';
import { TwitterAdapter } from './twitter-adapter';

describe('publisher-factory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPublisherCache();
  });

  describe('getPublisher', () => {
    it('should return AyrshareAdapter when provider is AYRSHARE', () => {
      mockGetFeatureFlags.mockReturnValue({
        socialPublishEnabled: true,
        socialPublishProvider: SocialProvider.AYRSHARE,
      });

      const publisher = getPublisher();

      expect(publisher).toBeInstanceOf(AyrshareAdapter);
      expect(publisher.provider).toBe(SocialProvider.AYRSHARE);
    });

    it('should return TwitterAdapter for DIRECT provider', () => {
      mockGetFeatureFlags.mockReturnValue({
        socialPublishEnabled: true,
        socialPublishProvider: SocialProvider.DIRECT,
      });

      const publisher = getPublisher();

      expect(publisher).toBeInstanceOf(TwitterAdapter);
      expect(publisher.provider).toBe(SocialProvider.DIRECT);
    });

    it('should cache publisher instances', () => {
      mockGetFeatureFlags.mockReturnValue({
        socialPublishEnabled: true,
        socialPublishProvider: SocialProvider.AYRSHARE,
      });

      const first = getPublisher();
      const second = getPublisher();

      expect(first).toBe(second);
    });

    it('should return fresh instance after cache reset', () => {
      mockGetFeatureFlags.mockReturnValue({
        socialPublishEnabled: true,
        socialPublishProvider: SocialProvider.AYRSHARE,
      });

      const first = getPublisher();
      resetPublisherCache();
      const second = getPublisher();

      expect(first).not.toBe(second);
      expect(second).toBeInstanceOf(AyrshareAdapter);
    });
  });

  describe('isPublishingEnabled', () => {
    it('should return true when socialPublishEnabled is true', () => {
      mockGetFeatureFlags.mockReturnValue({
        socialPublishEnabled: true,
        socialPublishProvider: SocialProvider.AYRSHARE,
      });

      expect(isPublishingEnabled()).toBe(true);
    });

    it('should return false when socialPublishEnabled is false', () => {
      mockGetFeatureFlags.mockReturnValue({
        socialPublishEnabled: false,
        socialPublishProvider: SocialProvider.AYRSHARE,
      });

      expect(isPublishingEnabled()).toBe(false);
    });
  });
});
