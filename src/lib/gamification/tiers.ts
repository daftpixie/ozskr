/**
 * User Tier System
 * Tier thresholds and progression logic for ozskr.ai gamification
 */

import { UserTier } from '@/types/database';
import type { TierProgress } from '@/types/gamification';

/**
 * Tier thresholds in total points
 */
export const TIER_THRESHOLDS: Record<UserTier, number> = {
  [UserTier.NEWCOMER]: 0,
  [UserTier.CREATOR]: 500,
  [UserTier.INFLUENCER]: 2000,
  [UserTier.MOGUL]: 10000,
  [UserTier.LEGEND]: 50000,
};

/**
 * Ordered list of tiers (ascending)
 */
export const TIER_ORDER: UserTier[] = [
  UserTier.NEWCOMER,
  UserTier.CREATOR,
  UserTier.INFLUENCER,
  UserTier.MOGUL,
  UserTier.LEGEND,
];

/**
 * Get user tier based on total points
 */
export function getTierForPoints(points: number): UserTier {
  // Start from highest tier and find first one user qualifies for
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = TIER_ORDER[i];
    if (points >= TIER_THRESHOLDS[tier]) {
      return tier;
    }
  }
  return UserTier.NEWCOMER;
}

/**
 * Get next tier in progression (null if already at max tier)
 */
export function getNextTier(currentTier: UserTier): UserTier | null {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex === TIER_ORDER.length - 1) {
    return null; // Invalid tier or already at max
  }
  return TIER_ORDER[currentIndex + 1];
}

/**
 * Calculate tier progress for a user
 */
export function calculateTierProgress(totalPoints: number): TierProgress {
  const currentTier = getTierForPoints(totalPoints);
  const nextTier = getNextTier(currentTier);

  if (!nextTier) {
    // User is at max tier
    return {
      currentTier,
      nextTier: null,
      pointsToNextTier: 0,
      progress: 100,
    };
  }

  const currentThreshold = TIER_THRESHOLDS[currentTier];
  const nextThreshold = TIER_THRESHOLDS[nextTier];
  const pointsIntoCurrentTier = totalPoints - currentThreshold;
  const pointsRequiredForNextTier = nextThreshold - currentThreshold;
  const progress = Math.min(
    100,
    Math.floor((pointsIntoCurrentTier / pointsRequiredForNextTier) * 100)
  );

  return {
    currentTier,
    nextTier,
    pointsToNextTier: nextThreshold - totalPoints,
    progress,
  };
}
