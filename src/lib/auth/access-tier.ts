/**
 * Access Tier Determination
 * Maps $HOPE token balance to platform access tiers.
 *
 * Tiers control feature gating across the platform:
 * - ALPHA: Full access (10,000+ $HOPE)
 * - BETA: Core features (5,000+ $HOPE)
 * - EARLY_ACCESS: Limited features (1,000+ $HOPE)
 * - WAITLIST: Landing page + waitlist only (0 $HOPE)
 */

import { z } from 'zod';

export enum AccessTier {
  ALPHA = 'ALPHA',
  BETA = 'BETA',
  EARLY_ACCESS = 'EARLY_ACCESS',
  WAITLIST = 'WAITLIST',
}

export const AccessTierSchema = z.nativeEnum(AccessTier);

/** $HOPE thresholds for each tier (human-readable amounts, not raw bigint) */
export const TIER_THRESHOLDS = {
  [AccessTier.ALPHA]: 10_000,
  [AccessTier.BETA]: 5_000,
  [AccessTier.EARLY_ACCESS]: 1_000,
  [AccessTier.WAITLIST]: 0,
} as const;

/** Max agents allowed per tier */
export const TIER_AGENT_LIMITS = {
  [AccessTier.ALPHA]: 5,
  [AccessTier.BETA]: 3,
  [AccessTier.EARLY_ACCESS]: 1,
  [AccessTier.WAITLIST]: 0,
} as const;

/**
 * Determine access tier from $HOPE balance.
 * Balance is in human-readable format (e.g., 10000 = 10,000 $HOPE).
 */
export function determineAccessTier(hopeBalance: number): AccessTier {
  if (hopeBalance >= TIER_THRESHOLDS[AccessTier.ALPHA]) {
    return AccessTier.ALPHA;
  }
  if (hopeBalance >= TIER_THRESHOLDS[AccessTier.BETA]) {
    return AccessTier.BETA;
  }
  if (hopeBalance >= TIER_THRESHOLDS[AccessTier.EARLY_ACCESS]) {
    return AccessTier.EARLY_ACCESS;
  }
  return AccessTier.WAITLIST;
}

/**
 * Check if a tier meets the minimum required tier.
 * Tier hierarchy: ALPHA > BETA > EARLY_ACCESS > WAITLIST
 */
export function meetsMinimumTier(currentTier: AccessTier, requiredTier: AccessTier): boolean {
  const hierarchy: AccessTier[] = [
    AccessTier.WAITLIST,
    AccessTier.EARLY_ACCESS,
    AccessTier.BETA,
    AccessTier.ALPHA,
  ];
  return hierarchy.indexOf(currentTier) >= hierarchy.indexOf(requiredTier);
}

/**
 * Get human-readable tier label for UI display
 */
export function getTierLabel(tier: AccessTier): string {
  switch (tier) {
    case AccessTier.ALPHA:
      return 'Alpha Tester';
    case AccessTier.BETA:
      return 'Beta Access';
    case AccessTier.EARLY_ACCESS:
      return 'Early Access';
    case AccessTier.WAITLIST:
      return 'Waitlist';
  }
}
