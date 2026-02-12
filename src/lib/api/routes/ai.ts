/**
 * AI Routes
 * Character management and content generation endpoints
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { stream } from 'hono/streaming';
import type {
  CharacterCreate,
  CharacterUpdate,
  GenerateContentRequest,
} from '@/types/schemas';
import {
  CharacterCreateSchema,
  CharacterUpdateSchema,
  CharacterResponseSchema,
  CharacterWithStatsSchema,
  GenerateContentRequestSchema,
  GenerationAcceptedResponseSchema,
  ContentGenerationResponseSchema,
  UuidSchema,
  paginatedResponse,
} from '@/types/schemas';
import { authMiddleware } from '../middleware/auth';
import { createAuthenticatedClient } from '../supabase';
import type { Context } from 'hono';
import type { Character, ContentGeneration } from '@/types/database';

const ai = new Hono();

// All AI routes require authentication
ai.use('/*', authMiddleware);

/**
 * Helper to create service role client for background operations
 */
function getServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  const { createSupabaseServerClient } = require('../supabase');
  return createSupabaseServerClient(serviceRoleKey);
}

/**
 * Helper to map database Character to API response
 */
function mapCharacterToResponse(char: Character) {
  return CharacterResponseSchema.parse({
    id: char.id,
    walletAddress: char.wallet_address,
    name: char.name,
    persona: char.persona,
    visualStyle: char.visual_style,
    voiceTone: char.voice_tone,
    guardrails: char.guardrails,
    topicAffinity: char.topic_affinity,
    mem0Namespace: char.mem0_namespace,
    status: char.status,
    visualStyleParams: char.visual_style_params,
    socialAccounts: char.social_accounts,
    generationCount: char.generation_count,
    lastGeneratedAt: char.last_generated_at,
    createdAt: char.created_at,
    updatedAt: char.updated_at,
  });
}

/**
 * Helper to map database ContentGeneration to API response
 */
function mapGenerationToResponse(gen: ContentGeneration) {
  return ContentGenerationResponseSchema.parse({
    id: gen.id,
    characterId: gen.character_id,
    generationType: gen.generation_type,
    inputPrompt: gen.input_prompt,
    enhancedPrompt: gen.enhanced_prompt,
    modelUsed: gen.model_used,
    modelParams: gen.model_params,
    outputUrl: gen.output_url,
    outputText: gen.output_text,
    qualityScore: gen.quality_score,
    moderationStatus: gen.moderation_status,
    moderationDetails: gen.moderation_details,
    tokenUsage: gen.token_usage,
    costUsd: gen.cost_usd,
    latencyMs: gen.latency_ms,
    cacheHit: gen.cache_hit,
    createdAt: gen.created_at,
  });
}

// =============================================================================
// CHARACTER ROUTES
// =============================================================================

/**
 * POST /api/ai/characters
 * Create a new AI character with full DNA
 */
ai.post('/characters', zValidator('json', CharacterCreateSchema), async (c: Context) => {
  const walletAddress = c.get('walletAddress') as string;
  const jwtToken = c.get('jwtToken') as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input = (c.req as any).valid('json') as CharacterCreate;

  try {
    const supabase = createAuthenticatedClient(jwtToken);

    // Generate unique mem0_namespace
    const mem0Namespace = `char_${crypto.randomUUID()}`;

    // Insert character
    const { data: character, error: characterError } = await supabase
      .from('characters')
      .insert({
        wallet_address: walletAddress,
        name: input.name,
        persona: input.persona,
        visual_style: input.visualStyle,
        voice_tone: input.voiceTone,
        guardrails: input.guardrails || [],
        topic_affinity: input.topicAffinity || [],
        mem0_namespace: mem0Namespace,
        visual_style_params: input.visualStyleParams || {},
        social_accounts: input.socialAccounts || {},
      })
      .select()
      .single();

    if (characterError || !character) {
      return c.json(
        {
          error: 'Failed to create character',
          code: 'DATABASE_ERROR',
          details: characterError,
        },
        500
      );
    }

    // Auto-create character_memory record
    const { error: memoryError } = await supabase.from('character_memory').insert({
      character_id: character.id,
      mem0_namespace: mem0Namespace,
    });

    if (memoryError) {
      return c.json(
        {
          error: 'Character created but memory record failed',
          code: 'DATABASE_ERROR',
          details: memoryError,
        },
        500
      );
    }

    return c.json(mapCharacterToResponse(character), 201);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create character',
        code: 'INTERNAL_ERROR',
      },
      500
    );
  }
});

/**
 * GET /api/ai/characters
 * List user's characters with pagination
 */
ai.get(
  '/characters',
  zValidator(
    'query',
    z.object({
      page: z.string().optional().default('1').transform(Number),
      limit: z.string().optional().default('20').transform(Number),
    })
  ),
  async (c: Context) => {
    const walletAddress = c.get('walletAddress') as string;
    const jwtToken = c.get('jwtToken') as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { page, limit } = (c.req as any).valid('query') as { page: number; limit: number };

    try {
      const supabase = createAuthenticatedClient(jwtToken);
      const offset = (page - 1) * limit;

      // Get total count
      const { count, error: countError } = await supabase
        .from('characters')
        .select('*', { count: 'exact', head: true })
        .eq('wallet_address', walletAddress);

      if (countError) {
        return c.json(
          {
            error: 'Failed to count characters',
            code: 'DATABASE_ERROR',
            details: countError,
          },
          500
        );
      }

      // Get paginated results
      const { data: characters, error: selectError } = await supabase
        .from('characters')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (selectError) {
        return c.json(
          {
            error: 'Failed to fetch characters',
            code: 'DATABASE_ERROR',
            details: selectError,
          },
          500
        );
      }

      const totalPages = Math.ceil((count || 0) / limit);

      const response = paginatedResponse(CharacterResponseSchema).parse({
        data: characters?.map(mapCharacterToResponse) || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
      });

      return c.json(response, 200);
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : 'Failed to fetch characters',
          code: 'INTERNAL_ERROR',
        },
        500
      );
    }
  }
);

/**
 * GET /api/ai/characters/:id
 * Get character with generation stats
 */
ai.get('/characters/:id', async (c: Context) => {
  const walletAddress = c.get('walletAddress') as string;
  const jwtToken = c.get('jwtToken') as string;
  const characterId = c.req.param('id');

  // Validate UUID format
  const validationResult = UuidSchema.safeParse(characterId);
  if (!validationResult.success) {
    return c.json(
      {
        error: 'Invalid character ID format',
        code: 'VALIDATION_ERROR',
        details: validationResult.error,
      },
      400
    );
  }

  try {
    const supabase = createAuthenticatedClient(jwtToken);

    // Fetch character with ownership verification
    const { data: character, error: characterError } = await supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .eq('wallet_address', walletAddress)
      .single();

    if (characterError || !character) {
      return c.json(
        {
          error: 'Character not found',
          code: 'NOT_FOUND',
        },
        404
      );
    }

    // Fetch recent generations (last 5)
    const { data: recentGenerations } = await supabase
      .from('content_generations')
      .select('*')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false })
      .limit(5);

    const response = CharacterWithStatsSchema.parse({
      ...mapCharacterToResponse(character),
      recentGenerations: recentGenerations?.map(mapGenerationToResponse) || [],
    });

    return c.json(response, 200);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch character',
        code: 'INTERNAL_ERROR',
      },
      500
    );
  }
});

/**
 * PUT /api/ai/characters/:id
 * Update character (non-DNA fields only)
 */
ai.put(
  '/characters/:id',
  zValidator('json', CharacterUpdateSchema),
  async (c: Context) => {
    const walletAddress = c.get('walletAddress') as string;
    const jwtToken = c.get('jwtToken') as string;
    const characterId = c.req.param('id');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = (c.req as any).valid('json') as CharacterUpdate;

    // Validate UUID format
    const validationResult = UuidSchema.safeParse(characterId);
    if (!validationResult.success) {
      return c.json(
        {
          error: 'Invalid character ID format',
          code: 'VALIDATION_ERROR',
          details: validationResult.error,
        },
        400
      );
    }

    try {
      const supabase = createAuthenticatedClient(jwtToken);

      // Verify ownership first
      const { data: existing, error: verifyError } = await supabase
        .from('characters')
        .select('id')
        .eq('id', characterId)
        .eq('wallet_address', walletAddress)
        .single();

      if (verifyError || !existing) {
        return c.json(
          {
            error: 'Character not found',
            code: 'NOT_FOUND',
          },
          404
        );
      }

      // Build update object (only allowed fields)
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.visualStyleParams !== undefined)
        updateData.visual_style_params = input.visualStyleParams;
      if (input.socialAccounts !== undefined)
        updateData.social_accounts = input.socialAccounts;
      if (input.status !== undefined) updateData.status = input.status;

      const { data: character, error: updateError } = await supabase
        .from('characters')
        .update(updateData)
        .eq('id', characterId)
        .select()
        .single();

      if (updateError || !character) {
        return c.json(
          {
            error: 'Failed to update character',
            code: 'DATABASE_ERROR',
            details: updateError,
          },
          500
        );
      }

      return c.json(mapCharacterToResponse(character), 200);
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : 'Failed to update character',
          code: 'INTERNAL_ERROR',
        },
        500
      );
    }
  }
);

// =============================================================================
// CONTENT GENERATION ROUTES
// =============================================================================

/**
 * POST /api/ai/characters/:id/generate
 * Trigger content generation (202 Accepted)
 */
ai.post(
  '/characters/:id/generate',
  zValidator('json', GenerateContentRequestSchema),
  async (c: Context) => {
    const walletAddress = c.get('walletAddress') as string;
    const jwtToken = c.get('jwtToken') as string;
    const characterId = c.req.param('id');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = (c.req as any).valid('json') as GenerateContentRequest;

    // Validate UUID format
    const validationResult = UuidSchema.safeParse(characterId);
    if (!validationResult.success) {
      return c.json(
        {
          error: 'Invalid character ID format',
          code: 'VALIDATION_ERROR',
          details: validationResult.error,
        },
        400
      );
    }

    try {
      const supabase = createAuthenticatedClient(jwtToken);

      // Verify ownership
      const { data: character, error: verifyError } = await supabase
        .from('characters')
        .select('id')
        .eq('id', characterId)
        .eq('wallet_address', walletAddress)
        .single();

      if (verifyError || !character) {
        return c.json(
          {
            error: 'Character not found',
            code: 'NOT_FOUND',
          },
          404
        );
      }

      // Rate limit: check generation_count in last hour (max 30 per wallet)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentGenerations, error: countError } = await supabase
        .from('content_generations')
        .select('id')
        .eq('character_id', characterId)
        .gte('created_at', oneHourAgo);

      if (countError) {
        return c.json(
          {
            error: 'Failed to check rate limit',
            code: 'DATABASE_ERROR',
            details: countError,
          },
          500
        );
      }

      if ((recentGenerations?.length || 0) >= 30) {
        c.header('Retry-After', '3600');
        return c.json(
          {
            error: 'Rate limit exceeded: maximum 30 generations per hour',
            code: 'RATE_LIMITED',
          },
          429
        );
      }

      // Create generation record with status 'pending'
      // Actual generation will be handled by background job in Sprint 2.2
      const { data: generation, error: insertError } = await supabase
        .from('content_generations')
        .insert({
          character_id: characterId,
          generation_type: input.generationType,
          input_prompt: input.inputPrompt,
          model_used: 'pending', // Will be set by background job
          model_params: input.modelParams || {},
          moderation_status: 'pending',
        })
        .select()
        .single();

      if (insertError || !generation) {
        return c.json(
          {
            error: 'Failed to create generation record',
            code: 'DATABASE_ERROR',
            details: insertError,
          },
          500
        );
      }

      const response = GenerationAcceptedResponseSchema.parse({
        generationId: generation.id,
        status: 'pending',
        message: 'Content generation request accepted and queued',
      });

      return c.json(response, 202);
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : 'Failed to trigger generation',
          code: 'INTERNAL_ERROR',
        },
        500
      );
    }
  }
);

/**
 * GET /api/ai/generations/:id
 * Get generation result
 */
ai.get('/generations/:id', async (c: Context) => {
  const walletAddress = c.get('walletAddress') as string;
  const jwtToken = c.get('jwtToken') as string;
  const generationId = c.req.param('id');

  // Validate UUID format
  const validationResult = UuidSchema.safeParse(generationId);
  if (!validationResult.success) {
    return c.json(
      {
        error: 'Invalid generation ID format',
        code: 'VALIDATION_ERROR',
        details: validationResult.error,
      },
      400
    );
  }

  try {
    const supabase = createAuthenticatedClient(jwtToken);

    // Fetch generation with character ownership verification
    const { data: generation, error: generationError } = await supabase
      .from('content_generations')
      .select('*, characters!inner(wallet_address)')
      .eq('id', generationId)
      .single();

    if (generationError || !generation) {
      return c.json(
        {
          error: 'Generation not found',
          code: 'NOT_FOUND',
        },
        404
      );
    }

    // Verify ownership through character
    const characterData = generation.characters as unknown as { wallet_address: string };
    if (characterData.wallet_address !== walletAddress) {
      return c.json(
        {
          error: 'Unauthorized access to this generation',
          code: 'FORBIDDEN',
        },
        403
      );
    }

    return c.json(mapGenerationToResponse(generation as unknown as ContentGeneration), 200);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch generation',
        code: 'INTERNAL_ERROR',
      },
      500
    );
  }
});

/**
 * GET /api/ai/generations/:id/stream
 * SSE endpoint for generation progress
 */
ai.get('/generations/:id/stream', async (c: Context) => {
  // For SSE with EventSource, auth token comes via query param
  const token = c.req.query('token');
  const generationId = c.req.param('id');

  if (!token) {
    return c.json(
      {
        error: 'Missing auth token in query params',
        code: 'UNAUTHORIZED',
      },
      401
    );
  }

  // Validate UUID format
  const validationResult = UuidSchema.safeParse(generationId);
  if (!validationResult.success) {
    return c.json(
      {
        error: 'Invalid generation ID format',
        code: 'VALIDATION_ERROR',
      },
      400
    );
  }

  try {
    // Verify JWT manually for SSE
    const { jwtVerify } = require('jose');
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return c.json({ error: 'JWT configuration error', code: 'INTERNAL_ERROR' }, 500);
    }

    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    const walletAddress = payload.wallet_address as string;

    if (!walletAddress) {
      return c.json({ error: 'Invalid token', code: 'UNAUTHORIZED' }, 401);
    }

    const supabase = createAuthenticatedClient(token);

    // Verify ownership
    const { data: generation, error: verifyError } = await supabase
      .from('content_generations')
      .select('*, characters!inner(wallet_address)')
      .eq('id', generationId)
      .single();

    if (verifyError || !generation) {
      return c.json({ error: 'Generation not found', code: 'NOT_FOUND' }, 404);
    }

    const characterData = generation.characters as unknown as { wallet_address: string };
    if (characterData.wallet_address !== walletAddress) {
      return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
    }

    // Return SSE stream
    return stream(c, async (stream) => {
      // Set SSE headers
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');

      const startTime = Date.now();
      const maxDuration = 5 * 60 * 1000; // 5 minutes timeout

      // Poll database for status updates
      const pollInterval = setInterval(async () => {
        try {
          const { data: currentGen } = await supabase
            .from('content_generations')
            .select('moderation_status')
            .eq('id', generationId)
            .single();

          if (currentGen) {
            await stream.write(
              `event: status\ndata: ${JSON.stringify({ status: currentGen.moderation_status })}\n\n`
            );

            // Close stream if complete or failed
            if (
              currentGen.moderation_status === 'approved' ||
              currentGen.moderation_status === 'rejected'
            ) {
              clearInterval(pollInterval);
              await stream.close();
            }
          }
        } catch (error) {
          clearInterval(pollInterval);
          await stream.close();
        }

        // Timeout after 5 minutes
        if (Date.now() - startTime > maxDuration) {
          clearInterval(pollInterval);
          await stream.close();
        }
      }, 2000); // Poll every 2 seconds

      // Cleanup on stream close
      stream.onAbort(() => {
        clearInterval(pollInterval);
      });
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to establish stream',
        code: 'INTERNAL_ERROR',
      },
      500
    );
  }
});

export { ai };
