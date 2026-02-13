/**
 * Feature Flags
 * Client-side flags driven by network config + server-side verification via Supabase
 *
 * Client reads flags for UI purposes, but API routes MUST re-verify via
 * getServerFeatureFlag() before executing gated operations.
 */

import { isMainnet } from '@/lib/solana/network-config';
import { SocialProvider } from '@/lib/social/types';

/** Flags available for client-side UI rendering */
export interface FeatureFlags {
  swapEnabled: boolean;
  socialPublishEnabled: boolean;
  socialPublishProvider: SocialProvider;
  mainnetWarningBanner: boolean;
  realMoneyDisclaimer: boolean;
  hopeTokenTrading: boolean;
  waitlistEnabled: boolean;
  twitterDirectEnabled: boolean;
  mainnetEnabled: boolean;
}

/** All server-verifiable flag keys (must match feature_flags table) */
export type ServerFlagKey =
  | 'waitlist_enabled'
  | 'twitter_direct_enabled'
  | 'mainnet_enabled'
  | 'jupiter_swap_enabled'
  | 'social_publishing_enabled';

/**
 * Get client-side feature flags based on network config.
 * These are hints for UI rendering only — the API re-verifies before executing.
 */
export function getFeatureFlags(): FeatureFlags {
  const mainnet = isMainnet();
  return {
    swapEnabled: true,
    socialPublishEnabled: true,
    socialPublishProvider: SocialProvider.AYRSHARE,
    mainnetWarningBanner: mainnet,
    realMoneyDisclaimer: mainnet,
    hopeTokenTrading: true,
    waitlistEnabled: true,
    twitterDirectEnabled: false,
    mainnetEnabled: mainnet,
  };
}

/**
 * Server-side flag verification via Supabase RPC.
 * MUST be called in API routes before executing flag-gated operations.
 *
 * @param supabase - Supabase client instance (anon or authenticated)
 * @param key - The flag key to check
 * @param fallback - Default value if the DB lookup fails (defaults to false for safety)
 * @returns Whether the flag is enabled
 */
export async function getServerFeatureFlag(
  supabase: { rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: boolean | null; error: unknown }> },
  key: ServerFlagKey,
  fallback = false
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_feature_enabled', { flag_key: key });

    if (error || data === null) {
      return fallback;
    }

    return data;
  } catch {
    return fallback;
  }
}

/**
 * Bulk-fetch all server flags in a single query.
 * Useful for API routes that need to check multiple flags.
 */
export async function getAllServerFlags(
  supabase: { from: (table: string) => { select: (columns: string) => Promise<{ data: Array<{ key: string; enabled: boolean }> | null; error: unknown }> } }
): Promise<Record<ServerFlagKey, boolean>> {
  const defaults: Record<ServerFlagKey, boolean> = {
    waitlist_enabled: true,
    twitter_direct_enabled: false,
    mainnet_enabled: false,
    jupiter_swap_enabled: true,
    social_publishing_enabled: true,
  };

  try {
    const { data, error } = await supabase.from('feature_flags').select('key, enabled');

    if (error || !data) {
      return defaults;
    }

    const flags = { ...defaults };
    for (const row of data) {
      if (row.key in flags) {
        flags[row.key as ServerFlagKey] = row.enabled;
      }
    }
    return flags;
  } catch {
    return defaults;
  }
}
