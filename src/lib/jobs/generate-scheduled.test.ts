/**
 * Scheduled Content Generation Tests
 * Tests scheduled content generation job processing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModerationStatus, GenerationType, ScheduleType, ScheduleContentType, CharacterStatus } from '@/types/database';
import type { ContentSchedule, Character } from '@/types/database';

// Hoisted mock references
const { mockFrom, mockRunPipeline, mockGetNextRunTime } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRunPipeline: vi.fn(),
  mockGetNextRunTime: vi.fn(),
}));

// Module mocks
vi.mock('@/lib/api/supabase', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@/lib/ai/pipeline', () => ({
  runPipeline: mockRunPipeline,
}));

vi.mock('./cron-utils', () => ({
  getNextRunTime: mockGetNextRunTime,
}));

import { processScheduledContent } from './generate-scheduled';

describe('generate-scheduled', () => {
  const mockCharacterId = '550e8400-e29b-41d4-a716-446655440000';
  const mockGenerationId = '123e4567-e89b-12d3-a456-426614174000';
  const mockScheduleId = '987e6543-e21b-12d3-a456-426614174000';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    // Default successful responses
    mockRunPipeline.mockResolvedValue(undefined);
    mockGetNextRunTime.mockReturnValue(new Date('2024-01-16T10:00:00Z'));
  });

  describe('processScheduledContent', () => {
    it('should throw error when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      await expect(processScheduledContent()).rejects.toThrow(
        'SUPABASE_SERVICE_ROLE_KEY environment variable not set'
      );
    });

    it('should return empty array when no due schedules exist', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }));

      const results = await processScheduledContent();

      expect(results).toEqual([]);
    });

    it('should query due schedules with correct filters', async () => {
      const selectSpy = vi.fn().mockReturnThis();
      const eqSpy = vi.fn().mockReturnThis();
      const lteSpy = vi.fn().mockReturnThis();
      const orderSpy = vi.fn().mockResolvedValue({ data: [], error: null });

      mockFrom.mockImplementation(() => ({
        select: selectSpy,
        eq: eqSpy,
        lte: lteSpy,
        order: orderSpy,
      }));

      await processScheduledContent();

      expect(eqSpy).toHaveBeenCalledWith('is_active', true);
      expect(orderSpy).toHaveBeenCalledWith('next_run_at', { ascending: true });
    });

    it('should create content_generations record for each schedule', async () => {
      const mockSchedule: ContentSchedule = {
        id: mockScheduleId,
        character_id: mockCharacterId,
        schedule_type: ScheduleType.ONE_TIME,
        cron_expression: null,
        next_run_at: '2024-01-15T09:00:00Z',
        content_type: ScheduleContentType.TEXT,
        prompt_template: 'Create a tweet about AI',
        is_active: true,
        last_run_at: null,
        run_count: 0,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z',
      };

      const mockCharacter: Character = {
        id: mockCharacterId,
        wallet_address: 'So11111111111111111111111111111111111111112',
        name: 'TestBot',
        persona: 'Test persona',
        visual_style: 'Modern',
        voice_tone: 'Friendly',
        guardrails: [],
        topic_affinity: [],
        mem0_namespace: 'test-namespace',
        status: CharacterStatus.ACTIVE,
        visual_style_params: {},
        social_accounts: {},
        generation_count: 0,
        last_generated_at: null,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
      };

      const insertSpy = vi.fn().mockReturnThis();
      const updateSpy = vi.fn().mockReturnThis();

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'content_schedules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [mockSchedule], error: null }),
            update: updateSpy,
          };
        }
        if (tableName === 'characters') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [mockCharacter], error: null }),
          };
        }
        if (tableName === 'content_generations') {
          return {
            insert: insertSpy,
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockGenerationId },
              error: null,
            }),
          };
        }
        return {};
      });

      const results = await processScheduledContent();

      expect(insertSpy).toHaveBeenCalledWith({
        character_id: mockCharacterId,
        generation_type: GenerationType.TEXT,
        input_prompt: 'Create a tweet about AI',
        model_used: 'claude-sonnet-4-20250514',
        model_params: {},
        moderation_status: ModerationStatus.PENDING,
        token_usage: {},
        cache_hit: false,
      });
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].generationId).toBe(mockGenerationId);
    });

    it('should call runPipeline with correct params', async () => {
      const mockSchedule: ContentSchedule = {
        id: mockScheduleId,
        character_id: mockCharacterId,
        schedule_type: ScheduleType.ONE_TIME,
        cron_expression: null,
        next_run_at: '2024-01-15T09:00:00Z',
        content_type: ScheduleContentType.IMAGE,
        prompt_template: 'Generate an image',
        is_active: true,
        last_run_at: null,
        run_count: 0,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z',
      };

      const mockCharacter: Character = {
        id: mockCharacterId,
        wallet_address: 'So11111111111111111111111111111111111111112',
        name: 'TestBot',
        persona: 'Test persona',
        visual_style: 'Modern',
        voice_tone: 'Friendly',
        guardrails: [],
        topic_affinity: [],
        mem0_namespace: 'test-namespace',
        status: CharacterStatus.ACTIVE,
        visual_style_params: {},
        social_accounts: {},
        generation_count: 0,
        last_generated_at: null,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
      };

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'content_schedules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [mockSchedule], error: null }),
            update: vi.fn().mockReturnThis(),
          };
        }
        if (tableName === 'characters') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [mockCharacter], error: null }),
          };
        }
        if (tableName === 'content_generations') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockGenerationId },
              error: null,
            }),
          };
        }
        return {};
      });

      await processScheduledContent();

      expect(mockRunPipeline).toHaveBeenCalledWith(
        {
          generationId: mockGenerationId,
          characterId: mockCharacterId,
          generationType: GenerationType.IMAGE,
          inputPrompt: 'Generate an image',
          modelParams: {},
          jwtToken: '',
        },
        expect.any(Function)
      );
    });

    it('should update last_run_at and run_count after successful run', async () => {
      const mockSchedule: ContentSchedule = {
        id: mockScheduleId,
        character_id: mockCharacterId,
        schedule_type: ScheduleType.ONE_TIME,
        cron_expression: null,
        next_run_at: '2024-01-15T09:00:00Z',
        content_type: ScheduleContentType.TEXT,
        prompt_template: 'Test',
        is_active: true,
        last_run_at: null,
        run_count: 5,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z',
      };

      const mockCharacter: Character = {
        id: mockCharacterId,
        wallet_address: 'So11111111111111111111111111111111111111112',
        name: 'TestBot',
        persona: 'Test',
        visual_style: 'Modern',
        voice_tone: 'Friendly',
        guardrails: [],
        topic_affinity: [],
        mem0_namespace: 'test-namespace',
        status: CharacterStatus.ACTIVE,
        visual_style_params: {},
        social_accounts: {},
        generation_count: 0,
        last_generated_at: null,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
      };

      const updateSpy = vi.fn().mockReturnThis();

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'content_schedules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [mockSchedule], error: null }),
            update: updateSpy,
          };
        }
        if (tableName === 'characters') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [mockCharacter], error: null }),
          };
        }
        if (tableName === 'content_generations') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockGenerationId },
              error: null,
            }),
          };
        }
        return {};
      });

      await processScheduledContent();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          run_count: 6,
          is_active: false,
        })
      );
    });

    it('should compute next_run_at for recurring schedules', async () => {
      const mockSchedule: ContentSchedule = {
        id: mockScheduleId,
        character_id: mockCharacterId,
        schedule_type: ScheduleType.RECURRING,
        cron_expression: '0 9 * * *',
        next_run_at: '2024-01-15T09:00:00Z',
        content_type: ScheduleContentType.TEXT,
        prompt_template: 'Test',
        is_active: true,
        last_run_at: null,
        run_count: 0,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z',
      };

      const mockCharacter: Character = {
        id: mockCharacterId,
        wallet_address: 'So11111111111111111111111111111111111111112',
        name: 'TestBot',
        persona: 'Test',
        visual_style: 'Modern',
        voice_tone: 'Friendly',
        guardrails: [],
        topic_affinity: [],
        mem0_namespace: 'test-namespace',
        status: CharacterStatus.ACTIVE,
        visual_style_params: {},
        social_accounts: {},
        generation_count: 0,
        last_generated_at: null,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
      };

      const nextRunTime = new Date('2024-01-16T09:00:00Z');
      mockGetNextRunTime.mockReturnValue(nextRunTime);

      const updateSpy = vi.fn().mockReturnThis();

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'content_schedules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [mockSchedule], error: null }),
            update: updateSpy,
          };
        }
        if (tableName === 'characters') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [mockCharacter], error: null }),
          };
        }
        if (tableName === 'content_generations') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockGenerationId },
              error: null,
            }),
          };
        }
        return {};
      });

      await processScheduledContent();

      expect(mockGetNextRunTime).toHaveBeenCalledWith('0 9 * * *');
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          next_run_at: nextRunTime.toISOString(),
        })
      );
    });

    it('should disable one_time schedules after execution', async () => {
      const mockSchedule: ContentSchedule = {
        id: mockScheduleId,
        character_id: mockCharacterId,
        schedule_type: ScheduleType.ONE_TIME,
        cron_expression: null,
        next_run_at: '2024-01-15T09:00:00Z',
        content_type: ScheduleContentType.TEXT,
        prompt_template: 'Test',
        is_active: true,
        last_run_at: null,
        run_count: 0,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z',
      };

      const mockCharacter: Character = {
        id: mockCharacterId,
        wallet_address: 'So11111111111111111111111111111111111111112',
        name: 'TestBot',
        persona: 'Test',
        visual_style: 'Modern',
        voice_tone: 'Friendly',
        guardrails: [],
        topic_affinity: [],
        mem0_namespace: 'test-namespace',
        status: CharacterStatus.ACTIVE,
        visual_style_params: {},
        social_accounts: {},
        generation_count: 0,
        last_generated_at: null,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
      };

      const updateSpy = vi.fn().mockReturnThis();

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'content_schedules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [mockSchedule], error: null }),
            update: updateSpy,
          };
        }
        if (tableName === 'characters') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [mockCharacter], error: null }),
          };
        }
        if (tableName === 'content_generations') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockGenerationId },
              error: null,
            }),
          };
        }
        return {};
      });

      await processScheduledContent();

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
        })
      );
    });

    it('should handle pipeline failures gracefully without disabling schedule', async () => {
      const mockSchedule: ContentSchedule = {
        id: mockScheduleId,
        character_id: mockCharacterId,
        schedule_type: ScheduleType.RECURRING,
        cron_expression: '0 9 * * *',
        next_run_at: '2024-01-15T09:00:00Z',
        content_type: ScheduleContentType.TEXT,
        prompt_template: 'Test',
        is_active: true,
        last_run_at: null,
        run_count: 0,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z',
      };

      const mockCharacter: Character = {
        id: mockCharacterId,
        wallet_address: 'So11111111111111111111111111111111111111112',
        name: 'TestBot',
        persona: 'Test',
        visual_style: 'Modern',
        voice_tone: 'Friendly',
        guardrails: [],
        topic_affinity: [],
        mem0_namespace: 'test-namespace',
        status: CharacterStatus.ACTIVE,
        visual_style_params: {},
        social_accounts: {},
        generation_count: 0,
        last_generated_at: null,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
      };

      mockRunPipeline.mockRejectedValue(new Error('Pipeline failed'));

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'content_schedules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [mockSchedule], error: null }),
            update: vi.fn().mockReturnThis(),
          };
        }
        if (tableName === 'characters') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [mockCharacter], error: null }),
          };
        }
        if (tableName === 'content_generations') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockGenerationId },
              error: null,
            }),
          };
        }
        return {};
      });

      const results = await processScheduledContent();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Pipeline failed');
    });

    it('should respect MAX_CONCURRENT_PIPELINES limit', async () => {
      // Create 10 schedules
      const schedules = Array.from({ length: 10 }, (_, i) => ({
        id: `schedule-${i}`,
        character_id: mockCharacterId,
        schedule_type: ScheduleType.ONE_TIME,
        cron_expression: null,
        next_run_at: '2024-01-15T09:00:00Z',
        content_type: ScheduleContentType.TEXT,
        prompt_template: `Test ${i}`,
        is_active: true,
        last_run_at: null,
        run_count: 0,
        created_at: '2024-01-15T08:00:00Z',
        updated_at: '2024-01-15T08:00:00Z',
      })) as ContentSchedule[];

      const mockCharacter: Character = {
        id: mockCharacterId,
        wallet_address: 'So11111111111111111111111111111111111111112',
        name: 'TestBot',
        persona: 'Test',
        visual_style: 'Modern',
        voice_tone: 'Friendly',
        guardrails: [],
        topic_affinity: [],
        mem0_namespace: 'test-namespace',
        status: CharacterStatus.ACTIVE,
        visual_style_params: {},
        social_accounts: {},
        generation_count: 0,
        last_generated_at: null,
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
      };

      mockFrom.mockImplementation((tableName: string) => {
        if (tableName === 'content_schedules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: schedules, error: null }),
            update: vi.fn().mockReturnThis(),
          };
        }
        if (tableName === 'characters') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [mockCharacter], error: null }),
          };
        }
        if (tableName === 'content_generations') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: mockGenerationId },
              error: null,
            }),
          };
        }
        return {};
      });

      const results = await processScheduledContent();

      expect(results).toHaveLength(10);
      expect(mockRunPipeline).toHaveBeenCalledTimes(10);
    });
  });
});
