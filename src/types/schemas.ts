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
  GenerationType,
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
export const GenerationTypeSchema = z.nativeEnum(GenerationType);

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

/**
 * Visual style parameters for AI image generation
 */
export const VisualStyleParamsSchema = z.object({
  style: z.string().optional(),
  colorPalette: z.array(z.string()).optional(),
  composition: z.string().optional(),
  lighting: z.string().optional(),
  mood: z.string().optional(),
  aspectRatio: z.string().optional(),
});

export type VisualStyleParams = z.infer<typeof VisualStyleParamsSchema>;

/**
 * Social media account connections
 */
export const SocialAccountsSchema = z.object({
  twitter: z
    .object({
      handle: z.string().optional(),
      profileKey: z.string().optional(),
      connected: z.boolean().default(false),
    })
    .optional(),
  instagram: z
    .object({
      handle: z.string().optional(),
      connected: z.boolean().default(false),
    })
    .optional(),
  tiktok: z
    .object({
      handle: z.string().optional(),
      connected: z.boolean().default(false),
    })
    .optional(),
});

export type SocialAccounts = z.infer<typeof SocialAccountsSchema>;

export const CharacterCreateSchema = z.object({
  name: z.string().min(1).max(100),
  persona: z.string().min(10).max(2000),
  visualStyle: z.string().min(10).max(1000),
  voiceTone: z.string().min(10).max(1000),
  guardrails: z.array(z.string()).default([]),
  topicAffinity: z.array(z.string()).default([]),
  visualStyleParams: VisualStyleParamsSchema.optional(),
  socialAccounts: SocialAccountsSchema.optional(),
});

export type CharacterCreate = z.infer<typeof CharacterCreateSchema>;

export const CharacterUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  visualStyleParams: VisualStyleParamsSchema.optional(),
  socialAccounts: SocialAccountsSchema.optional(),
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
  visualStyleParams: z.record(z.string(), z.unknown()),
  socialAccounts: z.record(z.string(), z.unknown()),
  generationCount: z.number(),
  lastGeneratedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  agentPubkey: z.string().nullable(),
  delegationStatus: z.enum(['none', 'pending', 'active', 'revoked']),
  delegationAmount: z.string().nullable(),
  delegationRemaining: z.string().nullable(),
  delegationTokenMint: z.string().nullable(),
  delegationTokenAccount: z.string().nullable(),
  delegationTxSignature: z.string().nullable(),
});

export type CharacterResponse = z.infer<typeof CharacterResponseSchema>;

/**
 * Character response with recent generation stats
 */
export const CharacterWithStatsSchema = CharacterResponseSchema.extend({
  recentGenerations: z.array(z.unknown()).optional(),
});

export type CharacterWithStats = z.infer<typeof CharacterWithStatsSchema>;

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
// CONTENT GENERATION SCHEMAS
// =============================================================================

/**
 * Token usage tracking for AI generations
 */
export const TokenUsageSchema = z.object({
  input: z.number().int().min(0).optional(),
  output: z.number().int().min(0).optional(),
  cached: z.number().int().min(0).optional(),
});

export type TokenUsage = z.infer<typeof TokenUsageSchema>;

/**
 * Model parameters for content generation
 */
export const ModelParamsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
});

export type ModelParams = z.infer<typeof ModelParamsSchema>;

/**
 * Content generation request
 */
export const GenerateContentRequestSchema = z.object({
  generationType: GenerationTypeSchema,
  inputPrompt: z.string().min(1).max(5000),
  modelParams: ModelParamsSchema.optional(),
});

export type GenerateContentRequest = z.infer<typeof GenerateContentRequestSchema>;

/**
 * Content generation creation (internal)
 */
export const ContentGenerationCreateSchema = z.object({
  characterId: UuidSchema,
  generationType: GenerationTypeSchema,
  inputPrompt: z.string().min(1).max(5000),
  enhancedPrompt: z.string().optional(),
  modelUsed: z.string(),
  modelParams: ModelParamsSchema.optional(),
  outputUrl: z.string().url().optional(),
  outputText: z.string().optional(),
  qualityScore: z.number().min(0).max(1).optional(),
  moderationStatus: ModerationStatusSchema.optional(),
  moderationDetails: z.record(z.string(), z.unknown()).optional(),
  tokenUsage: TokenUsageSchema.optional(),
  costUsd: z.string().optional(),
  latencyMs: z.number().int().min(0).optional(),
  cacheHit: z.boolean().optional(),
});

export type ContentGenerationCreate = z.infer<typeof ContentGenerationCreateSchema>;

/**
 * Content generation response
 */
export const ContentGenerationResponseSchema = z.object({
  id: UuidSchema,
  characterId: UuidSchema,
  generationType: GenerationTypeSchema,
  inputPrompt: z.string(),
  enhancedPrompt: z.string().nullable(),
  modelUsed: z.string(),
  modelParams: z.record(z.string(), z.unknown()),
  outputUrl: z.string().url().nullable(),
  outputText: z.string().nullable(),
  qualityScore: z.number().nullable(),
  moderationStatus: ModerationStatusSchema,
  moderationDetails: z.record(z.string(), z.unknown()).nullable(),
  tokenUsage: z.record(z.string(), z.unknown()),
  costUsd: z.string().nullable(),
  latencyMs: z.number().nullable(),
  cacheHit: z.boolean(),
  createdAt: TimestampSchema,
});

export type ContentGenerationResponse = z.infer<typeof ContentGenerationResponseSchema>;

/**
 * Generation status response (202 Accepted)
 */
export const GenerationAcceptedResponseSchema = z.object({
  generationId: UuidSchema,
  status: z.literal('pending'),
  message: z.string(),
});

export type GenerationAcceptedResponse = z.infer<typeof GenerationAcceptedResponseSchema>;

// =============================================================================
// CHARACTER MEMORY SCHEMAS
// =============================================================================

export const CharacterMemoryCreateSchema = z.object({
  characterId: UuidSchema,
  mem0Namespace: z.string().min(1),
});

export type CharacterMemoryCreate = z.infer<typeof CharacterMemoryCreateSchema>;

export const CharacterMemoryResponseSchema = z.object({
  id: UuidSchema,
  characterId: UuidSchema,
  mem0Namespace: z.string(),
  memoryCount: z.number().int().min(0),
  lastSyncedAt: TimestampSchema.nullable(),
  totalRetrievals: z.number().int().min(0),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type CharacterMemoryResponse = z.infer<typeof CharacterMemoryResponseSchema>;

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
