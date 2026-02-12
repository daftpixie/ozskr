/**
 * Social Zod Schemas
 * Request/response validation for social media endpoints
 */

import { z } from 'zod';
import { SocialPlatform, SocialPostStatus } from './database';
import { UuidSchema, TimestampSchema } from './schemas';

// =============================================================================
// ENUMS
// =============================================================================

export const SocialPlatformSchema = z.nativeEnum(SocialPlatform);
export const SocialPostStatusSchema = z.nativeEnum(SocialPostStatus);

// =============================================================================
// SOCIAL ACCOUNT SCHEMAS
// =============================================================================

/**
 * Request schema for connecting a social account
 */
export const SocialAccountConnectSchema = z.object({
  platform: SocialPlatformSchema,
  platformAccountId: z.string().min(1).max(255),
  platformUsername: z.string().min(1).max(255),
  ayrshareProfileKey: z.string().min(1).max(500),
});

export type SocialAccountConnect = z.infer<typeof SocialAccountConnectSchema>;

/**
 * Response schema for a social account
 */
export const SocialAccountResponseSchema = z.object({
  id: UuidSchema,
  walletAddress: z.string(),
  platform: SocialPlatformSchema,
  platformAccountId: z.string(),
  platformUsername: z.string(),
  isConnected: z.boolean(),
  connectedAt: TimestampSchema,
  lastPostedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
});

export type SocialAccountResponse = z.infer<typeof SocialAccountResponseSchema>;

// =============================================================================
// PUBLISHING SCHEMAS
// =============================================================================

/**
 * Request schema for publishing content to social platforms
 */
export const PublishRequestSchema = z.object({
  contentGenerationId: UuidSchema,
  socialAccountIds: z.array(UuidSchema).min(1).max(10),
});

export type PublishRequest = z.infer<typeof PublishRequestSchema>;

/**
 * Response schema for a social post
 */
export const SocialPostResponseSchema = z.object({
  id: UuidSchema,
  contentGenerationId: UuidSchema,
  socialAccountId: UuidSchema,
  platform: SocialPlatformSchema,
  postId: z.string().nullable(),
  postUrl: z.string().nullable(),
  status: SocialPostStatusSchema,
  postedAt: TimestampSchema.nullable(),
  errorMessage: z.string().nullable(),
  engagementMetrics: z.record(z.string(), z.unknown()),
  lastMetricsUpdate: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
});

export type SocialPostResponse = z.infer<typeof SocialPostResponseSchema>;

// =============================================================================
// ANALYTICS SCHEMAS
// =============================================================================

/**
 * Response schema for an analytics snapshot
 */
export const AnalyticsSnapshotResponseSchema = z.object({
  id: UuidSchema,
  characterId: UuidSchema,
  snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  totalGenerations: z.number().int().min(0),
  totalPosts: z.number().int().min(0),
  totalEngagement: z.record(z.string(), z.unknown()),
  avgQualityScore: z.number().nullable(),
  topPerformingContentId: UuidSchema.nullable(),
  createdAt: TimestampSchema,
});

export type AnalyticsSnapshotResponse = z.infer<typeof AnalyticsSnapshotResponseSchema>;

/**
 * Response schema for aggregated analytics summary
 */
export const AnalyticsSummaryResponseSchema = z.object({
  totalGenerations: z.number().int().min(0),
  totalPosts: z.number().int().min(0),
  totalEngagement: z.record(z.string(), z.unknown()),
  avgQualityScore: z.number().nullable(),
  period: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});

export type AnalyticsSummaryResponse = z.infer<typeof AnalyticsSummaryResponseSchema>;

/**
 * Query schema for analytics history
 */
export const AnalyticsHistoryQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  granularity: z.enum(['day', 'week', 'month']).optional().default('day'),
});

export type AnalyticsHistoryQuery = z.infer<typeof AnalyticsHistoryQuerySchema>;
