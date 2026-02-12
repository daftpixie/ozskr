/**
 * Gamification Zod Schemas
 * Request/response validation for gamification endpoints
 */

import { z } from 'zod';
import {
  PointsType,
  PointsSourceType,
  UserTier,
  AchievementCategory,
  AchievementRequirementType,
  LeaderboardPeriod,
} from './database';
import { UuidSchema, TimestampSchema, WalletAddressSchema, PaginationSchema, paginatedResponse } from './schemas';

// =============================================================================
// ENUMS
// =============================================================================

export const PointsTypeSchema = z.nativeEnum(PointsType);
export const PointsSourceTypeSchema = z.nativeEnum(PointsSourceType);
export const UserTierSchema = z.nativeEnum(UserTier);
export const AchievementCategorySchema = z.nativeEnum(AchievementCategory);
export const AchievementRequirementTypeSchema = z.nativeEnum(AchievementRequirementType);
export const LeaderboardPeriodSchema = z.nativeEnum(LeaderboardPeriod);

// =============================================================================
// USER POINTS SCHEMAS
// =============================================================================

/**
 * Response schema for user points entry
 */
export const UserPointsResponseSchema = z.object({
  id: UuidSchema,
  walletAddress: WalletAddressSchema,
  pointsType: PointsTypeSchema,
  pointsAmount: z.number().int(),
  description: z.string(),
  sourceType: PointsSourceTypeSchema,
  sourceId: UuidSchema.nullable(),
  createdAt: TimestampSchema,
});

export type UserPointsResponse = z.infer<typeof UserPointsResponseSchema>;

/**
 * Paginated user points response
 */
export const UserPointsPaginatedResponseSchema = paginatedResponse(UserPointsResponseSchema);

export type UserPointsPaginatedResponse = z.infer<typeof UserPointsPaginatedResponseSchema>;

// =============================================================================
// USER STATS SCHEMAS
// =============================================================================

/**
 * Tier progress information
 */
export const TierProgressSchema = z.object({
  currentTier: UserTierSchema,
  nextTier: UserTierSchema.nullable(),
  pointsToNextTier: z.number().int().min(0),
  progress: z.number().min(0).max(100), // Percentage 0-100
});

export type TierProgress = z.infer<typeof TierProgressSchema>;

/**
 * Response schema for user stats with tier progress
 */
export const UserStatsResponseSchema = z.object({
  walletAddress: WalletAddressSchema,
  totalPoints: z.number().int().min(0),
  currentStreakDays: z.number().int().min(0),
  longestStreakDays: z.number().int().min(0),
  lastActiveDate: z.string().nullable(), // DATE string
  totalAgentsCreated: z.number().int().min(0),
  totalContentGenerated: z.number().int().min(0),
  totalPostsPublished: z.number().int().min(0),
  tier: UserTierSchema,
  updatedAt: TimestampSchema,
  tierProgress: TierProgressSchema,
});

export type UserStatsResponse = z.infer<typeof UserStatsResponseSchema>;

// =============================================================================
// ACHIEVEMENT SCHEMAS
// =============================================================================

/**
 * Base achievement response
 */
export const AchievementResponseSchema = z.object({
  id: UuidSchema,
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  category: AchievementCategorySchema,
  requirementType: AchievementRequirementTypeSchema,
  requirementValue: z.number().int().min(0),
  pointsReward: z.number().int().min(0),
  tierRequired: UserTierSchema.nullable(),
  createdAt: TimestampSchema,
});

export type AchievementResponse = z.infer<typeof AchievementResponseSchema>;

/**
 * Unlocked achievement with unlock timestamp
 */
export const UnlockedAchievementResponseSchema = AchievementResponseSchema.extend({
  unlockedAt: TimestampSchema,
});

export type UnlockedAchievementResponse = z.infer<typeof UnlockedAchievementResponseSchema>;

/**
 * Locked achievement with progress percentage
 */
export const LockedAchievementResponseSchema = AchievementResponseSchema.extend({
  progress: z.number().min(0).max(100), // Percentage 0-100
  currentValue: z.number().int().min(0), // Current count/value towards requirement
});

export type LockedAchievementResponse = z.infer<typeof LockedAchievementResponseSchema>;

/**
 * All achievements response (unlocked and locked)
 */
export const AllAchievementsResponseSchema = z.object({
  unlocked: z.array(UnlockedAchievementResponseSchema),
  locked: z.array(LockedAchievementResponseSchema),
});

export type AllAchievementsResponse = z.infer<typeof AllAchievementsResponseSchema>;

// =============================================================================
// LEADERBOARD SCHEMAS
// =============================================================================

/**
 * Leaderboard entry response
 */
export const LeaderboardEntryResponseSchema = z.object({
  walletAddress: WalletAddressSchema,
  displayName: z.string().nullable(),
  totalPoints: z.number().int().min(0),
  rank: z.number().int().min(1),
  tier: UserTierSchema,
});

export type LeaderboardEntryResponse = z.infer<typeof LeaderboardEntryResponseSchema>;

/**
 * Leaderboard response
 */
export const LeaderboardResponseSchema = z.object({
  period: LeaderboardPeriodSchema,
  entries: z.array(LeaderboardEntryResponseSchema),
  cachedAt: TimestampSchema,
});

export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

/**
 * User leaderboard position with surrounding entries
 */
export const LeaderboardPositionResponseSchema = z.object({
  currentUser: LeaderboardEntryResponseSchema,
  above: z.array(LeaderboardEntryResponseSchema), // 2 users above
  below: z.array(LeaderboardEntryResponseSchema), // 2 users below
});

export type LeaderboardPositionResponse = z.infer<typeof LeaderboardPositionResponseSchema>;
