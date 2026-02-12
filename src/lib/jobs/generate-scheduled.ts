/**
 * Scheduled Content Generation Job
 * Processes due content schedules and generates content via the pipeline
 */

import { createSupabaseServerClient } from '@/lib/api/supabase';
import { runPipeline } from '@/lib/ai/pipeline';
import { getNextRunTime } from './cron-utils';
import { GenerationType, ModerationStatus } from '@/types/database';
import type {
  ContentSchedule,
  Character,
} from '@/types/database';

/**
 * Concurrency limit for simultaneous pipeline executions
 */
const MAX_CONCURRENT_PIPELINES = 5;

/**
 * Error for schedule processing failures
 */
export class ScheduleProcessError extends Error {
  constructor(
    message: string,
    public scheduleId: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ScheduleProcessError';
  }
}

/**
 * Result from processing a single schedule
 */
export interface ScheduleProcessResult {
  scheduleId: string;
  success: boolean;
  generationId?: string;
  error?: string;
}

/**
 * Map ScheduleContentType to GenerationType
 */
const mapContentType = (contentType: string): GenerationType => {
  switch (contentType) {
    case 'text':
      return GenerationType.TEXT;
    case 'image':
      return GenerationType.IMAGE;
    case 'video':
      return GenerationType.VIDEO;
    default:
      return GenerationType.TEXT;
  }
};

/**
 * Process a single content schedule
 */
const processSingleSchedule = async (
  schedule: ContentSchedule,
  character: Character,
  supabase: ReturnType<typeof createSupabaseServerClient>
): Promise<ScheduleProcessResult> => {
  try {
    // Create a content_generations record
    const { data: generation, error: insertError } = await supabase
      .from('content_generations')
      .insert({
        character_id: schedule.character_id,
        generation_type: mapContentType(schedule.content_type),
        input_prompt: schedule.prompt_template,
        model_used: 'claude-sonnet-4-20250514', // Default model
        model_params: {},
        moderation_status: 'pending' as ModerationStatus,
        token_usage: {},
        cache_hit: false,
      })
      .select('id')
      .single();

    if (insertError || !generation) {
      throw new Error(`Failed to create generation record: ${insertError?.message}`);
    }

    // Run the content generation pipeline
    // Note: We use a no-op progress callback for background jobs
    await runPipeline(
      {
        generationId: generation.id,
        characterId: schedule.character_id,
        generationType: mapContentType(schedule.content_type),
        inputPrompt: schedule.prompt_template,
        modelParams: {},
        jwtToken: '', // Background job - no user JWT needed (pipeline will use service client for storage)
      },
      () => {
        // No-op progress callback for background jobs
      }
    );

    // Update schedule metadata
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      last_run_at: now,
      run_count: schedule.run_count + 1,
    };

    // Compute next run time for recurring schedules
    if (schedule.schedule_type === 'recurring' && schedule.cron_expression) {
      try {
        const nextRun = getNextRunTime(schedule.cron_expression);
        updates.next_run_at = nextRun.toISOString();
      } catch {
        // If cron parsing fails, disable the schedule
        updates.is_active = false;
      }
    } else if (schedule.schedule_type === 'one_time') {
      // One-time schedules are disabled after execution
      updates.is_active = false;
    }

    await supabase
      .from('content_schedules')
      .update(updates)
      .eq('id', schedule.id);

    return {
      scheduleId: schedule.id,
      success: true,
      generationId: generation.id,
    };
  } catch (error) {
    // Log error but don't disable schedule - let it retry next time
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Schedule ${schedule.id} failed:`, errorMessage);

    return {
      scheduleId: schedule.id,
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Process all due content schedules
 *
 * This function:
 * 1. Queries for schedules where next_run_at <= now() AND is_active = true
 * 2. For each schedule, creates a generation and runs the pipeline
 * 3. Updates schedule metadata (last_run_at, run_count, next_run_at)
 * 4. For one_time schedules, sets is_active = false
 * 5. For recurring schedules, computes next_run_at from cron_expression
 *
 * @returns Array of results for all processed schedules
 */
export const processScheduledContent = async (): Promise<ScheduleProcessResult[]> => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  }

  const supabase = createSupabaseServerClient(serviceRoleKey);

  // Fetch all due schedules
  const now = new Date().toISOString();
  const { data: schedules, error: fetchError } = await supabase
    .from('content_schedules')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_at', now)
    .order('next_run_at', { ascending: true });

  if (fetchError) {
    throw new Error(`Failed to fetch schedules: ${fetchError.message}`);
  }

  if (!schedules || schedules.length === 0) {
    return [];
  }

  // Fetch characters for all schedules (to get wallet_address)
  const characterIds = [...new Set(schedules.map((s) => s.character_id))];
  const { data: characters, error: charError } = await supabase
    .from('characters')
    .select('*')
    .in('id', characterIds);

  if (charError || !characters) {
    throw new Error(`Failed to fetch characters: ${charError?.message}`);
  }

  // Map characters by ID for quick lookup
  const characterMap = new Map<string, Character>();
  for (const char of characters) {
    characterMap.set(char.id, char);
  }

  // Process schedules with concurrency limit
  const results: ScheduleProcessResult[] = [];
  const processingQueue = [...schedules];

  while (processingQueue.length > 0) {
    // Take up to MAX_CONCURRENT_PIPELINES schedules
    const batch = processingQueue.splice(0, MAX_CONCURRENT_PIPELINES);

    // Process batch in parallel
    const batchPromises = batch.map((schedule) => {
      const character = characterMap.get(schedule.character_id);
      if (!character) {
        return Promise.resolve({
          scheduleId: schedule.id,
          success: false,
          error: 'Character not found',
        });
      }
      return processSingleSchedule(schedule, character, supabase);
    });

    const batchResults = await Promise.allSettled(batchPromises);

    // Collect results
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // Promise rejected - shouldn't happen since processSingleSchedule catches errors
        console.error('Unexpected promise rejection:', result.reason);
      }
    }
  }

  return results;
};
