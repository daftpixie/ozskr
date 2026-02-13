/**
 * Feature Flags
 * Simple feature flags driven by network configuration
 */

import { isMainnet } from '@/lib/solana/network-config';
import { SocialProvider } from '@/lib/social/types';

export interface FeatureFlags {
  swapEnabled: boolean;
  socialPublishEnabled: boolean;
  socialPublishProvider: SocialProvider;
  mainnetWarningBanner: boolean;
  realMoneyDisclaimer: boolean;
  hopeTokenTrading: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  const mainnet = isMainnet();
  return {
    swapEnabled: true,
    socialPublishEnabled: true,
    socialPublishProvider: SocialProvider.AYRSHARE,
    mainnetWarningBanner: mainnet,
    realMoneyDisclaimer: mainnet,
    hopeTokenTrading: true,
  };
}
