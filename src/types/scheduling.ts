/**
 * Scheduling Zod Schemas
 * Request/response validation for content scheduling endpoints
 */

import { z } from 'zod';
import { ScheduleType, ScheduleContentType } from './database';
import { UuidSchema, TimestampSchema } from './schemas';

// =============================================================================
// ENUMS
// =============================================================================

export const ScheduleTypeSchema = z.nativeEnum(ScheduleType);
export const ScheduleContentTypeSchema = z.nativeEnum(ScheduleContentType);

// =============================================================================
// CONTENT SCHEDULE SCHEMAS
// =============================================================================

/**
 * Request schema for creating a content schedule
 */
export const ContentScheduleCreateSchema = z.object({
  characterId: UuidSchema,
  scheduleType: ScheduleTypeSchema,
  cronExpression: z.string().optional(),
  nextRunAt: TimestampSchema,
  contentType: ScheduleContentTypeSchema,
  promptTemplate: z.string().min(10).max(5000),
  autoPublish: z.boolean().optional().default(false),
});

export type ContentScheduleCreate = z.infer<typeof ContentScheduleCreateSchema>;

/**
 * Request schema for updating a content schedule
 */
export const ContentScheduleUpdateSchema = z.object({
  scheduleType: ScheduleTypeSchema.optional(),
  cronExpression: z.string().optional(),
  nextRunAt: TimestampSchema.optional(),
  contentType: ScheduleContentTypeSchema.optional(),
  promptTemplate: z.string().min(10).max(5000).optional(),
  isActive: z.boolean().optional(),
  autoPublish: z.boolean().optional(),
});

export type ContentScheduleUpdate = z.infer<typeof ContentScheduleUpdateSchema>;

/**
 * Response schema for a content schedule
 */
export const ContentScheduleResponseSchema = z.object({
  id: UuidSchema,
  characterId: UuidSchema,
  scheduleType: ScheduleTypeSchema,
  cronExpression: z.string().nullable(),
  nextRunAt: TimestampSchema,
  contentType: ScheduleContentTypeSchema,
  promptTemplate: z.string(),
  isActive: z.boolean(),
  autoPublish: z.boolean(),
  lastRunAt: TimestampSchema.nullable(),
  runCount: z.number().int().min(0),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type ContentScheduleResponse = z.infer<typeof ContentScheduleResponseSchema>;
