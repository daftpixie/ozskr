/**
 * Zod Schemas for ozskr.ai
 * Request/response validation for all API endpoints
 */

import { z } from 'zod';
import {
  CharacterStatus,
  RunType,
  RunStatus,
  ContentType,
  ModerationStatus,
} from './database';

// =============================================================================
// PRIMITIVES
// =============================================================================

/**
 * Solana wallet address (base58 encoded, 32-44 chars)
 */
export const WalletAddressSchema = z
  .string()
  .min(32)
  .max(44)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid base58 address');

/**
 * UUID v4
 */
export const UuidSchema = z.string().uuid();

/**
 * ISO 8601 timestamp
 */
export const TimestampSchema = z.string().datetime();

// =============================================================================
// ENUMS
// =============================================================================

export const CharacterStatusSchema = z.nativeEnum(CharacterStatus);
export const RunTypeSchema = z.nativeEnum(RunType);
export const RunStatusSchema = z.nativeEnum(RunStatus);
export const ContentTypeSchema = z.nativeEnum(ContentType);
export const ModerationStatusSchema = z.nativeEnum(ModerationStatus);

// =============================================================================
// AUTH SCHEMAS
// =============================================================================

/**
 * SIWS (Sign-In With Solana) verification request
 */
export const SiwsVerifyRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  signature: z.string().min(1, 'Signature is required'),
  publicKey: WalletAddressSchema,
});

export type SiwsVerifyRequest = z.infer<typeof SiwsVerifyRequestSchema>;

/**
 * Session response (after successful authentication)
 */
export const SessionResponseSchema = z.object({
  token: z.string(),
  expiresAt: TimestampSchema,
  user: z.object({
    walletAddress: WalletAddressSchema,
    displayName: z.string().nullable(),
    avatarUrl: z.string().url().nullable(),
  }),
});

export type SessionResponse = z.infer<typeof SessionResponseSchema>;

// =============================================================================
// USER SCHEMAS
// =============================================================================

export const UserCreateSchema = z.object({
  walletAddress: WalletAddressSchema,
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
});

export type UserCreate = z.infer<typeof UserCreateSchema>;

export const UserUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
});

export type UserUpdate = z.infer<typeof UserUpdateSchema>;

export const UserResponseSchema = z.object({
  walletAddress: WalletAddressSchema,
  displayName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type UserResponse = z.infer<typeof UserResponseSchema>;

// =============================================================================
// CHARACTER SCHEMAS
// =============================================================================

export const CharacterCreateSchema = z.object({
  name: z.string().min(1).max(100),
  persona: z.string().min(10).max(2000),
  visualStyle: z.string().min(10).max(1000),
  voiceTone: z.string().min(10).max(1000),
  guardrails: z.array(z.string()).default([]),
  topicAffinity: z.array(z.string()).default([]),
});

export type CharacterCreate = z.infer<typeof CharacterCreateSchema>;

export const CharacterUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  persona: z.string().min(10).max(2000).optional(),
  visualStyle: z.string().min(10).max(1000).optional(),
  voiceTone: z.string().min(10).max(1000).optional(),
  guardrails: z.array(z.string()).optional(),
  topicAffinity: z.array(z.string()).optional(),
  status: CharacterStatusSchema.optional(),
});

export type CharacterUpdate = z.infer<typeof CharacterUpdateSchema>;

export const CharacterResponseSchema = z.object({
  id: UuidSchema,
  walletAddress: WalletAddressSchema,
  name: z.string(),
  persona: z.string(),
  visualStyle: z.string(),
  voiceTone: z.string(),
  guardrails: z.array(z.string()),
  topicAffinity: z.array(z.string()),
  mem0Namespace: z.string(),
  status: CharacterStatusSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type CharacterResponse = z.infer<typeof CharacterResponseSchema>;

// =============================================================================
// AGENT RUN SCHEMAS
// =============================================================================

export const AgentRunCreateSchema = z.object({
  characterId: UuidSchema,
  runType: RunTypeSchema,
});

export type AgentRunCreate = z.infer<typeof AgentRunCreateSchema>;

export const AgentRunResponseSchema = z.object({
  id: UuidSchema,
  characterId: UuidSchema,
  runType: RunTypeSchema,
  status: RunStatusSchema,
  startedAt: TimestampSchema.nullable(),
  completedAt: TimestampSchema.nullable(),
  resultMetadata: z.record(z.string(), z.unknown()),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type AgentRunResponse = z.infer<typeof AgentRunResponseSchema>;

// =============================================================================
// CONTENT SCHEMAS
// =============================================================================

export const ContentCreateSchema = z.object({
  characterId: UuidSchema,
  contentType: ContentTypeSchema,
  promptUsed: z.string().min(1).max(5000),
  outputText: z.string().max(10000).optional(),
  outputUrl: z.string().url().optional(),
  qualityScore: z.number().min(0).max(1).optional(),
});

export type ContentCreate = z.infer<typeof ContentCreateSchema>;

export const ContentResponseSchema = z.object({
  id: UuidSchema,
  characterId: UuidSchema,
  contentType: ContentTypeSchema,
  promptUsed: z.string(),
  outputText: z.string().nullable(),
  outputUrl: z.string().url().nullable(),
  qualityScore: z.number().min(0).max(1).nullable(),
  moderationStatus: ModerationStatusSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type ContentResponse = z.infer<typeof ContentResponseSchema>;

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

/**
 * Standard API error response
 */
export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Standard success response
 */
export const ApiSuccessSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export type ApiSuccess = z.infer<typeof ApiSuccessSchema>;

/**
 * Pagination metadata
 */
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export type Pagination = z.infer<typeof PaginationSchema>;

/**
 * Paginated response wrapper
 */
export function paginatedResponse<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: PaginationSchema,
  });
}
