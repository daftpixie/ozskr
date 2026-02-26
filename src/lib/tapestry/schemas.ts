/**
 * Tapestry Social Graph — Zod Schemas
 * Validation for all Tapestry-related data at API and service boundaries.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Core entity schemas
// ---------------------------------------------------------------------------

export const TapestryProfileSchema = z.object({
  id: z.string(),
  namespace: z.string(),
  username: z.string(),
  bio: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  created_at: z.number(),
});

export const TapestryContentSchema = z.object({
  id: z.string(),
  namespace: z.string(),
  created_at: z.number(),
});

// ---------------------------------------------------------------------------
// Service-layer input schemas
// ---------------------------------------------------------------------------

export const CreateProfileInputSchema = z.object({
  walletAddress: z.string().min(32),
  username: z.string().min(1).max(50),
  bio: z.string().max(500).optional(),
  image: z.string().url().optional(),
});

export const CreateContentInputSchema = z.object({
  contentId: z.string().uuid(),
  profileId: z.string().min(1),
  sourcePlatform: z.string().optional(),
  sourcePostId: z.string().optional(),
  contentType: z.string().optional(),
  tags: z.string().optional(),
});

export const CreateFollowInputSchema = z.object({
  followerProfileId: z.string().min(1),
  followingProfileId: z.string().min(1),
});

export const BulkFollowInputSchema = z.object({
  followerProfileId: z.string().min(1),
  followingProfileIds: z.array(z.string().min(1)).min(1).max(50),
});

// ---------------------------------------------------------------------------
// API route input schemas (for Hono zValidator)
// ---------------------------------------------------------------------------

export const GetProfileSchema = z.object({
  profileId: z.string().min(1),
});

export const GetFeedSchema = z.object({
  profileId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  page: z.coerce.number().int().min(1).optional().default(1),
});

export const GetGraphSchema = z.object({
  profileId: z.string().min(1),
  type: z.enum(['followers', 'following']),
});

export const FollowInputSchema = z.object({
  followerProfileId: z.string().min(1),
  followingProfileId: z.string().min(1),
});

export const UnfollowInputSchema = z.object({
  followerProfileId: z.string().min(1),
  followingProfileId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Route body schemas for Hono handlers
// ---------------------------------------------------------------------------

export const SyncProfileBodySchema = z.object({
  username: z.string().min(1).max(50),
  bio: z.string().max(500).optional(),
});

export const MirrorContentBodySchema = z.object({
  contentId: z.string().uuid(),
  sourcePlatform: z.string().min(1),
  sourcePostId: z.string().optional(),
  contentText: z.string().optional(),
});

export const FollowBodySchema = z.object({
  followerCharacterId: z.string().uuid(),
  followingCharacterId: z.string().uuid(),
});
