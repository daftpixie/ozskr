/**
 * Feature Flags Tests
 * Tests for client-side flags and server-side flag verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/solana/network-config', () => ({
  isMainnet: vi.fn(() => false),
}));

vi.mock('@/lib/social/types', () => ({
  SocialProvider: { AYRSHARE: 'ayrshare', DIRECT: 'direct' },
}));

import { getFeatureFlags, getServerFeatureFlag, getAllServerFlags } from './feature-flags';

describe('Feature Flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFeatureFlags (client-side)', () => {
    it('should return default flags for devnet', () => {
      const flags = getFeatureFlags();

      expect(flags.swapEnabled).toBe(true);
      expect(flags.socialPublishEnabled).toBe(true);
      expect(flags.socialPublishProvider).toBe('ayrshare');
      expect(flags.mainnetWarningBanner).toBe(false);
      expect(flags.realMoneyDisclaimer).toBe(false);
      expect(flags.hopeTokenTrading).toBe(true);
      expect(flags.waitlistEnabled).toBe(true);
      expect(flags.twitterDirectEnabled).toBe(false);
      expect(flags.mainnetEnabled).toBe(false);
    });

    it('should enable mainnet flags when on mainnet', async () => {
      const { isMainnet } = await import('@/lib/solana/network-config');
      vi.mocked(isMainnet).mockReturnValue(true);

      const flags = getFeatureFlags();

      expect(flags.mainnetWarningBanner).toBe(true);
      expect(flags.realMoneyDisclaimer).toBe(true);
      expect(flags.mainnetEnabled).toBe(true);
    });
  });

  describe('getServerFeatureFlag', () => {
    it('should return true when flag is enabled in DB', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      };

      const result = await getServerFeatureFlag(mockSupabase, 'jupiter_swap_enabled');

      expect(result).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('is_feature_enabled', {
        flag_key: 'jupiter_swap_enabled',
      });
    });

    it('should return false when flag is disabled in DB', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
      };

      const result = await getServerFeatureFlag(mockSupabase, 'mainnet_enabled');

      expect(result).toBe(false);
    });

    it('should return fallback on RPC error', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'rpc failed' } }),
      };

      const result = await getServerFeatureFlag(mockSupabase, 'waitlist_enabled', true);

      expect(result).toBe(true);
    });

    it('should return fallback (false by default) on exception', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockRejectedValue(new Error('network error')),
      };

      const result = await getServerFeatureFlag(mockSupabase, 'twitter_direct_enabled');

      expect(result).toBe(false);
    });
  });

  describe('getAllServerFlags', () => {
    it('should return all flags from DB', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [
              { key: 'waitlist_enabled', enabled: true },
              { key: 'twitter_direct_enabled', enabled: true },
              { key: 'mainnet_enabled', enabled: false },
              { key: 'jupiter_swap_enabled', enabled: true },
              { key: 'social_publishing_enabled', enabled: false },
            ],
            error: null,
          }),
        }),
      };

      const flags = await getAllServerFlags(mockSupabase);

      expect(flags.waitlist_enabled).toBe(true);
      expect(flags.twitter_direct_enabled).toBe(true);
      expect(flags.mainnet_enabled).toBe(false);
      expect(flags.jupiter_swap_enabled).toBe(true);
      expect(flags.social_publishing_enabled).toBe(false);
    });

    it('should return defaults on DB error', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'db error' },
          }),
        }),
      };

      const flags = await getAllServerFlags(mockSupabase);

      expect(flags.waitlist_enabled).toBe(true);
      expect(flags.twitter_direct_enabled).toBe(false);
      expect(flags.mainnet_enabled).toBe(false);
      expect(flags.jupiter_swap_enabled).toBe(true);
      expect(flags.social_publishing_enabled).toBe(true);
    });

    it('should return defaults on exception', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockRejectedValue(new Error('network error')),
        }),
      };

      const flags = await getAllServerFlags(mockSupabase);

      expect(flags.waitlist_enabled).toBe(true);
      expect(flags.mainnet_enabled).toBe(false);
    });
  });
});
