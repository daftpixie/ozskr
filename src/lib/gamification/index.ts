/**
 * Gamification Engine
 * Exports all gamification modules
 */

export { awardPoints, POINTS_VALUES } from './points';
export { checkAndUnlockAchievements } from './achievements';
export { updateStreak } from './streaks';
export { refreshLeaderboard, refreshAllLeaderboards } from './leaderboard';
export { getTierForPoints, getNextTier, calculateTierProgress, TIER_THRESHOLDS, TIER_ORDER } from './tiers';

export type { AwardPointsParams, AwardPointsResult } from './points';
export type { StreakUpdateResult } from './streaks';
export type { TierProgress } from '@/types/gamification';
