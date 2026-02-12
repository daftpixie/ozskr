/**
 * Schedules Routes
 * Content scheduling management endpoints
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  ContentScheduleCreateSchema,
  ContentScheduleUpdateSchema,
  ContentScheduleResponseSchema,
} from '@/types/scheduling';
import { UuidSchema, paginatedResponse } from '@/types/schemas';
import { authMiddleware } from '../middleware/auth';
import { createAuthenticatedClient } from '../supabase';
import type { ContentSchedule } from '@/types/database';

/** Hono env with auth middleware variables */
type SchedulesEnv = {
  Variables: {
    walletAddress: string;
    jwtToken: string;
  };
};

const schedules = new Hono<SchedulesEnv>();

// All schedule routes require authentication
schedules.use('/*', authMiddleware);

/**
 * Helper to extract auth context from Hono context with type narrowing
 */
function getAuthContext(c: { get: (key: string) => unknown }) {
  const walletAddress = c.get('walletAddress');
  const jwtToken = c.get('jwtToken');
  if (typeof walletAddress !== 'string' || typeof jwtToken !== 'string') {
    return null;
  }
  return { walletAddress, jwtToken };
}

/**
 * Helper to map database ContentSchedule to API response
 */
function mapScheduleToResponse(schedule: ContentSchedule) {
  return {
    id: schedule.id,
    characterId: schedule.character_id,
    scheduleType: schedule.schedule_type,
    cronExpression: schedule.cron_expression,
    nextRunAt: schedule.next_run_at,
    contentType: schedule.content_type,
    promptTemplate: schedule.prompt_template,
    isActive: schedule.is_active,
    lastRunAt: schedule.last_run_at,
    runCount: schedule.run_count,
    createdAt: schedule.created_at,
    updatedAt: schedule.updated_at,
  };
}

// =============================================================================
// SCHEDULE ROUTES
// =============================================================================

/**
 * POST /api/ai/schedules
 * Create a new content schedule
 */
schedules.post('/', zValidator('json', ContentScheduleCreateSchema), async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const input = c.req.valid('json');

  // Validate cron expression for recurring schedules
  if (input.scheduleType === 'recurring' && !input.cronExpression) {
    return c.json(
      {
        error: 'Cron expression is required for recurring schedules',
        code: 'VALIDATION_ERROR',
      },
      400
    );
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Verify character ownership
    const { data: character, error: characterError } = await supabase
      .from('characters')
      .select('id')
      .eq('id', input.characterId)
      .eq('wallet_address', auth.walletAddress)
      .single();

    if (characterError || !character) {
      return c.json(
        { error: 'Character not found', code: 'NOT_FOUND' },
        404
      );
    }

    // Create schedule
    const { data: schedule, error: insertError } = await supabase
      .from('content_schedules')
      .insert({
        character_id: input.characterId,
        schedule_type: input.scheduleType,
        cron_expression: input.cronExpression || null,
        next_run_at: input.nextRunAt,
        content_type: input.contentType,
        prompt_template: input.promptTemplate,
      })
      .select()
      .single();

    if (insertError || !schedule) {
      return c.json(
        { error: 'Failed to create schedule', code: 'DATABASE_ERROR' },
        500
      );
    }

    return c.json(mapScheduleToResponse(schedule), 201);
  } catch {
    return c.json(
      { error: 'Failed to create schedule', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

/**
 * GET /api/ai/schedules
 * List user's content schedules with pagination
 */
schedules.get(
  '/',
  zValidator(
    'query',
    z.object({
      page: z.string().optional().default('1').transform(Number),
      limit: z.string().optional().default('20').transform(Number),
      characterId: UuidSchema.optional(),
    })
  ),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const { page, limit, characterId } = c.req.valid('query');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);
      const offset = (page - 1) * limit;

      // Build query with character ownership filter
      let countQuery = supabase
        .from('content_schedules')
        .select('*, characters!inner(wallet_address)', { count: 'exact', head: true })
        .eq('characters.wallet_address', auth.walletAddress);

      let selectQuery = supabase
        .from('content_schedules')
        .select('*, characters!inner(wallet_address)')
        .eq('characters.wallet_address', auth.walletAddress)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Optional character filter
      if (characterId) {
        countQuery = countQuery.eq('character_id', characterId);
        selectQuery = selectQuery.eq('character_id', characterId);
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        return c.json(
          { error: 'Failed to count schedules', code: 'DATABASE_ERROR' },
          500
        );
      }

      const { data: schedulesData, error: selectError } = await selectQuery;

      if (selectError) {
        return c.json(
          { error: 'Failed to fetch schedules', code: 'DATABASE_ERROR' },
          500
        );
      }

      const totalPages = Math.ceil((count || 0) / limit);

      const response = paginatedResponse(ContentScheduleResponseSchema).parse({
        data: schedulesData?.map(mapScheduleToResponse) || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
      });

      return c.json(response, 200);
    } catch {
      return c.json(
        { error: 'Failed to fetch schedules', code: 'INTERNAL_ERROR' },
        500
      );
    }
  }
);

/**
 * GET /api/ai/schedules/:id
 * Get single schedule
 */
schedules.get('/:id', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const scheduleId = c.req.param('id');

  // Validate UUID format
  const validationResult = UuidSchema.safeParse(scheduleId);
  if (!validationResult.success) {
    return c.json(
      { error: 'Invalid schedule ID format', code: 'VALIDATION_ERROR' },
      400
    );
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Fetch schedule with character ownership join
    const { data: schedule, error: scheduleError } = await supabase
      .from('content_schedules')
      .select('*, characters!inner(wallet_address)')
      .eq('id', scheduleId)
      .eq('characters.wallet_address', auth.walletAddress)
      .single();

    if (scheduleError || !schedule) {
      return c.json(
        { error: 'Schedule not found', code: 'NOT_FOUND' },
        404
      );
    }

    return c.json(mapScheduleToResponse(schedule), 200);
  } catch {
    return c.json(
      { error: 'Failed to fetch schedule', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

/**
 * PUT /api/ai/schedules/:id
 * Update a content schedule
 */
schedules.put(
  '/:id',
  zValidator('json', ContentScheduleUpdateSchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const scheduleId = c.req.param('id');
    const input = c.req.valid('json');

    // Validate UUID format
    const validationResult = UuidSchema.safeParse(scheduleId);
    if (!validationResult.success) {
      return c.json(
        { error: 'Invalid schedule ID format', code: 'VALIDATION_ERROR' },
        400
      );
    }

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Verify ownership first
      const { data: existing, error: verifyError } = await supabase
        .from('content_schedules')
        .select('*, characters!inner(wallet_address)')
        .eq('id', scheduleId)
        .eq('characters.wallet_address', auth.walletAddress)
        .single();

      if (verifyError || !existing) {
        return c.json(
          { error: 'Schedule not found', code: 'NOT_FOUND' },
          404
        );
      }

      // Build update object
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.scheduleType !== undefined) updateData.schedule_type = input.scheduleType;
      if (input.cronExpression !== undefined) updateData.cron_expression = input.cronExpression;
      if (input.nextRunAt !== undefined) updateData.next_run_at = input.nextRunAt;
      if (input.contentType !== undefined) updateData.content_type = input.contentType;
      if (input.promptTemplate !== undefined) updateData.prompt_template = input.promptTemplate;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;

      const { data: schedule, error: updateError } = await supabase
        .from('content_schedules')
        .update(updateData)
        .eq('id', scheduleId)
        .select()
        .single();

      if (updateError || !schedule) {
        return c.json(
          { error: 'Failed to update schedule', code: 'DATABASE_ERROR' },
          500
        );
      }

      return c.json(mapScheduleToResponse(schedule), 200);
    } catch {
      return c.json(
        { error: 'Failed to update schedule', code: 'INTERNAL_ERROR' },
        500
      );
    }
  }
);

/**
 * DELETE /api/ai/schedules/:id
 * Delete a content schedule
 */
schedules.delete('/:id', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const scheduleId = c.req.param('id');

  // Validate UUID format
  const validationResult = UuidSchema.safeParse(scheduleId);
  if (!validationResult.success) {
    return c.json(
      { error: 'Invalid schedule ID format', code: 'VALIDATION_ERROR' },
      400
    );
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Verify ownership first
    const { data: existing, error: verifyError } = await supabase
      .from('content_schedules')
      .select('*, characters!inner(wallet_address)')
      .eq('id', scheduleId)
      .eq('characters.wallet_address', auth.walletAddress)
      .single();

    if (verifyError || !existing) {
      return c.json(
        { error: 'Schedule not found', code: 'NOT_FOUND' },
        404
      );
    }

    const { error: deleteError } = await supabase
      .from('content_schedules')
      .delete()
      .eq('id', scheduleId);

    if (deleteError) {
      return c.json(
        { error: 'Failed to delete schedule', code: 'DATABASE_ERROR' },
        500
      );
    }

    return c.json({ success: true, message: 'Schedule deleted' }, 200);
  } catch {
    return c.json(
      { error: 'Failed to delete schedule', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

/**
 * POST /api/ai/schedules/:id/trigger
 * Manually trigger a scheduled run (sets next_run_at to now)
 */
schedules.post('/:id/trigger', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const scheduleId = c.req.param('id');

  // Validate UUID format
  const validationResult = UuidSchema.safeParse(scheduleId);
  if (!validationResult.success) {
    return c.json(
      { error: 'Invalid schedule ID format', code: 'VALIDATION_ERROR' },
      400
    );
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Verify ownership first
    const { data: existing, error: verifyError } = await supabase
      .from('content_schedules')
      .select('*, characters!inner(wallet_address)')
      .eq('id', scheduleId)
      .eq('characters.wallet_address', auth.walletAddress)
      .single();

    if (verifyError || !existing) {
      return c.json(
        { error: 'Schedule not found', code: 'NOT_FOUND' },
        404
      );
    }

    // Update next_run_at to now to trigger immediate execution
    const { data: schedule, error: updateError } = await supabase
      .from('content_schedules')
      .update({ next_run_at: new Date().toISOString() })
      .eq('id', scheduleId)
      .select()
      .single();

    if (updateError || !schedule) {
      return c.json(
        { error: 'Failed to trigger schedule', code: 'DATABASE_ERROR' },
        500
      );
    }

    return c.json(
      {
        success: true,
        message: 'Schedule triggered for immediate execution',
        schedule: mapScheduleToResponse(schedule),
      },
      200
    );
  } catch {
    return c.json(
      { error: 'Failed to trigger schedule', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

export { schedules };
