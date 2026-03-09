/**
 * AI Routes
 * Character management and content generation endpoints
 */

import { Hono } from 'hono';
import type { Address } from '@solana/kit';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { stream } from 'hono/streaming';
import { jwtVerify } from 'jose';
import {
  CharacterCreateSchema,
  CharacterUpdateSchema,
  CharacterResponseSchema,
  CharacterWithStatsSchema,
  ContentGenerationResponseSchema,
  GenerateContentRequestSchema,
  GenerationAcceptedResponseSchema,
  UuidSchema,
  paginatedResponse,
} from '@/types/schemas';
import { authMiddleware } from '../middleware/auth';
import { createAuthenticatedClient } from '../supabase';
import type { Character, ContentGeneration } from '@/types/database';
import { GenerationType, ModerationStatus, PointsType, PointsSourceType } from '@/types/database';
import { runPipeline } from '@/lib/ai/pipeline';
import type { PipelineProgress, PipelineStage } from '@/lib/ai/pipeline/types';

/** Hono env with auth middleware variables */
type AiEnv = {
  Variables: {
    walletAddress: string;
    jwtToken: string;
  };
};

const ai = new Hono<AiEnv>();

// All AI routes require authentication
ai.use('/*', authMiddleware);

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
 * Helper to map database Character to API response
 */
function mapCharacterToResponse(char: Character) {
  return {
    id: char.id,
    walletAddress: char.wallet_address,
    name: char.name,
    persona: char.persona,
    visualStyle: char.visual_style,
    voiceTone: char.voice_tone,
    guardrails: char.guardrails ?? [],
    topicAffinity: char.topic_affinity ?? [],
    mem0Namespace: char.mem0_namespace,
    status: char.status,
    visualStyleParams: char.visual_style_params ?? {},
    socialAccounts: char.social_accounts ?? {},
    generationCount: char.generation_count ?? 0,
    lastGeneratedAt: char.last_generated_at,
    createdAt: char.created_at,
    updatedAt: char.updated_at,
    agentPubkey: char.agent_pubkey ?? null,
    delegationStatus: char.delegation_status ?? 'none',
    delegationAmount: char.delegation_amount ?? null,
    delegationRemaining: char.delegation_remaining ?? null,
    delegationTokenMint: char.delegation_token_mint ?? null,
    delegationTokenAccount: char.delegation_token_account ?? null,
    delegationTxSignature: char.delegation_tx_signature ?? null,
    nftMintAddress: char.nft_mint_address ?? null,
    nftMetadataUri: char.nft_metadata_uri ?? null,
    registryAgentId: char.registry_agent_id ?? null,
    registryUrl: char.registry_url ?? null,
    isTransferable: char.is_transferable ?? null,
    reputationScore: char.reputation_score != null ? String(char.reputation_score) : null,
    capabilities: char.capabilities ?? null,
    transferCount: char.transfer_count ?? null,
    lastTransferredAt: char.last_transferred_at ?? null,
    workingMemoryTemplate: char.working_memory_template ?? null,
  };
}

/**
 * Helper to map database ContentGeneration to API response
 */
function mapGenerationToResponse(gen: ContentGeneration) {
  return {
    id: gen.id,
    characterId: gen.character_id,
    generationType: gen.generation_type,
    inputPrompt: gen.input_prompt,
    enhancedPrompt: gen.enhanced_prompt,
    modelUsed: gen.model_used,
    modelParams: gen.model_params ?? {},
    outputUrl: gen.output_url,
    outputText: gen.output_text,
    qualityScore: gen.quality_score,
    moderationStatus: gen.moderation_status,
    moderationDetails: gen.moderation_details,
    tokenUsage: gen.token_usage ?? {},
    costUsd: gen.cost_usd !== null ? String(gen.cost_usd) : null,
    latencyMs: gen.latency_ms,
    cacheHit: gen.cache_hit ?? false,
    createdAt: gen.created_at,
  };
}

/**
 * Extract wallet_address from a Supabase join result safely.
 * Used when querying content_generations with characters!inner join.
 */
function extractOwnerWallet(joinResult: unknown): string | null {
  if (
    typeof joinResult === 'object' &&
    joinResult !== null &&
    'wallet_address' in joinResult
  ) {
    const addr = (joinResult as Record<string, unknown>).wallet_address;
    return typeof addr === 'string' ? addr : null;
  }
  return null;
}

/**
 * Map pipeline stage names to client-facing stage names.
 * Returns null for internal-only stages that should not be sent to the client.
 */
const PIPELINE_STAGE_MAP: Record<PipelineStage, string | null> = {
  parsing: 'loading_character',
  loading_context: 'loading_character',
  enhancing: 'enhancing_prompt',
  generating: 'generating_content',
  quality_check: 'quality_check',
  moderating: 'moderation',
  storing: null,
  complete: 'complete',
  error: 'error',
};

// =============================================================================
// CHARACTER ROUTES
// =============================================================================

/**
 * POST /api/ai/characters
 * Create a new AI character with full DNA
 */
ai.post('/characters', zValidator('json', CharacterCreateSchema), async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const input = c.req.valid('json');

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Generate unique mem0_namespace
    const mem0Namespace = `char_${crypto.randomUUID()}`;

    // Insert character
    const { data: character, error: characterError } = await supabase
      .from('characters')
      .insert({
        wallet_address: auth.walletAddress,
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
        { error: 'Failed to create character', code: 'DATABASE_ERROR' },
        500
      );
    }

    // Auto-create character_memory record
    const { error: memoryError } = await supabase
      .from('character_memory')
      .insert({
        character_id: character.id,
        mem0_namespace: mem0Namespace,
      });

    if (memoryError) {
      return c.json(
        {
          error: 'Character created but memory record failed',
          code: 'DATABASE_ERROR',
        },
        500
      );
    }

    // Generate agent keypair (async, but we need the pubkey for the response)
    let agentPubkey: string | null = null;
    try {
      const { createAgentKeypair } = await import('@/lib/agent-wallet');
      agentPubkey = await createAgentKeypair(character.id);

      // Store pubkey in characters table
      await supabase
        .from('characters')
        .update({ agent_pubkey: agentPubkey })
        .eq('id', character.id);
    } catch (agentError) {
      // Log but don't fail character creation — keypair can be generated later
      const { logger } = await import('@/lib/utils/logger');
      logger.error('Failed to generate agent keypair', { error: agentError, characterId: character.id });
    }

    // Award points for agent creation (async, don't fail the main operation)
    import('@/lib/gamification/points')
      .then(({ awardPoints, POINTS_VALUES }) =>
        awardPoints({
          walletAddress: auth.walletAddress,
          pointsType: PointsType.CREATION,
          pointsAmount: POINTS_VALUES.AGENT_CREATED,
          description: `Created agent: ${character.name}`,
          sourceType: PointsSourceType.CHARACTER,
          sourceId: character.id,
        })
      )
      .catch(() => {});

    // Update streak (async, don't fail the main operation)
    import('@/lib/gamification/streaks')
      .then(({ updateStreak }) => updateStreak(auth.walletAddress))
      .catch(() => {});

    // Provision Tapestry social profile (async, fire-and-forget)
    void (async () => {
      try {
        const { isTapestryConfigured } = await import('@/lib/tapestry/client');
        if (!isTapestryConfigured()) return;
        const { tapestryService } = await import('@/lib/tapestry/service');
        const slug = character.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 43); // ozskr_ prefix + 43 = 50 max
        const username = `ozskr_${slug}`;
        const bio = character.persona.slice(0, 200);
        const result = await tapestryService.createOrFindProfile(
          character.wallet_address,
          username,
          bio
        );
        if ('error' in result) return;
        const serviceClient = createAuthenticatedClient(auth.jwtToken);
        await serviceClient
          .from('characters')
          .update({ tapestry_profile_id: result.data.id, tapestry_username: result.data.username })
          .eq('id', character.id);
        const { onAgentCreated } = await import('@/lib/tapestry/hooks');
        void onAgentCreated(
          character.id,
          result.data.id,
          { name: character.name, persona: character.persona, topic_affinity: character.topic_affinity as string[] | undefined },
          serviceClient
        ).catch(() => {});
      } catch {
        // Fire-and-forget: never surface Tapestry errors to the user
      }
    })();

    // Merge agentPubkey into response (character was fetched before keypair gen)
    const response = mapCharacterToResponse(character);
    if (agentPubkey) {
      response.agentPubkey = agentPubkey;
    }

    return c.json(response, 201);
  } catch {
    return c.json(
      { error: 'Failed to create character', code: 'INTERNAL_ERROR' },
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
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const { page, limit } = c.req.valid('query');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);
      const offset = (page - 1) * limit;

      // Get total count
      const { count, error: countError } = await supabase
        .from('characters')
        .select('*', { count: 'exact', head: true })
        .eq('wallet_address', auth.walletAddress);

      if (countError) {
        return c.json(
          { error: 'Failed to count characters', code: 'DATABASE_ERROR' },
          500
        );
      }

      // Get paginated results
      const { data: characters, error: selectError } = await supabase
        .from('characters')
        .select('*')
        .eq('wallet_address', auth.walletAddress)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (selectError) {
        return c.json(
          { error: 'Failed to fetch characters', code: 'DATABASE_ERROR' },
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
    } catch {
      return c.json(
        { error: 'Failed to fetch characters', code: 'INTERNAL_ERROR' },
        500
      );
    }
  }
);

/**
 * GET /api/ai/characters/:id
 * Get character with generation stats
 */
ai.get('/characters/:id', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const characterId = c.req.param('id');

  // Validate UUID format
  const validationResult = UuidSchema.safeParse(characterId);
  if (!validationResult.success) {
    return c.json(
      { error: 'Invalid character ID format', code: 'VALIDATION_ERROR' },
      400
    );
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Fetch character with ownership verification
    const { data: character, error: characterError } = await supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .eq('wallet_address', auth.walletAddress)
      .single();

    if (characterError || !character) {
      return c.json(
        { error: 'Character not found', code: 'NOT_FOUND' },
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
      recentGenerations:
        recentGenerations?.map(mapGenerationToResponse) || [],
    });

    return c.json(response, 200);
  } catch {
    return c.json(
      { error: 'Failed to fetch character', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

/**
 * GET /api/ai/characters/:id/generations
 * Paginated list of content generations for a specific character
 */
ai.get(
  '/characters/:id/generations',
  zValidator(
    'query',
    z.object({
      page: z.string().optional().default('1').transform(Number),
      limit: z.string().optional().default('20').transform(Number),
      type: z.enum(['text', 'image', 'video']).optional(),
    })
  ),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const characterId = c.req.param('id');

    // Validate UUID format
    const validationResult = UuidSchema.safeParse(characterId);
    if (!validationResult.success) {
      return c.json(
        { error: 'Invalid character ID format', code: 'VALIDATION_ERROR' },
        400
      );
    }

    const { page, limit: rawLimit, type } = c.req.valid('query');
    const limit = Math.min(rawLimit, 50);

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Verify character exists and belongs to the authenticated wallet
      const { data: character, error: characterError } = await supabase
        .from('characters')
        .select('id')
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (characterError || !character) {
        return c.json(
          { error: 'Character not found', code: 'NOT_FOUND' },
          404
        );
      }

      const offset = (page - 1) * limit;

      // Build count query
      let countQuery = supabase
        .from('content_generations')
        .select('*', { count: 'exact', head: true })
        .eq('character_id', characterId);

      if (type) {
        countQuery = countQuery.eq('generation_type', type);
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        return c.json(
          { error: 'Failed to count generations', code: 'DATABASE_ERROR' },
          500
        );
      }

      // Build paginated data query
      let dataQuery = supabase
        .from('content_generations')
        .select('*')
        .eq('character_id', characterId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (type) {
        dataQuery = dataQuery.eq('generation_type', type);
      }

      const { data: generations, error: selectError } = await dataQuery;

      if (selectError) {
        return c.json(
          { error: 'Failed to fetch generations', code: 'DATABASE_ERROR' },
          500
        );
      }

      const totalPages = Math.ceil((count || 0) / limit);

      const parseResult = paginatedResponse(ContentGenerationResponseSchema).safeParse({
        data: generations?.map(mapGenerationToResponse) || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
      });

      if (!parseResult.success) {
        const { logger } = await import('@/lib/utils/logger');
        logger.error('Generations parse failure', {
          characterId,
          error: parseResult.error.issues,
        });
        return c.json(
          { error: 'Failed to parse generation data', code: 'INTERNAL_ERROR' },
          500
        );
      }

      return c.json(parseResult.data, 200);
    } catch (err) {
      const { logger } = await import('@/lib/utils/logger');
      logger.error('GET /characters/:id/generations error', {
        characterId,
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json(
        { error: 'Failed to fetch generations', code: 'INTERNAL_ERROR' },
        500
      );
    }
  }
);

/**
 * PUT /api/ai/characters/:id
 * Update character (non-DNA fields only)
 */
ai.put(
  '/characters/:id',
  zValidator('json', CharacterUpdateSchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const characterId = c.req.param('id');
    const input = c.req.valid('json');

    // Validate UUID format
    const validationResult = UuidSchema.safeParse(characterId);
    if (!validationResult.success) {
      return c.json(
        { error: 'Invalid character ID format', code: 'VALIDATION_ERROR' },
        400
      );
    }

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Verify ownership first
      const { data: existing, error: verifyError } = await supabase
        .from('characters')
        .select('id')
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (verifyError || !existing) {
        return c.json(
          { error: 'Character not found', code: 'NOT_FOUND' },
          404
        );
      }

      // Build update object (only allowed fields)
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.persona !== undefined) updateData.persona = input.persona;
      if (input.voiceTone !== undefined) updateData.voice_tone = input.voiceTone;
      if (input.visualStyle !== undefined) updateData.visual_style = input.visualStyle;
      if (input.topicAffinity !== undefined) updateData.topic_affinity = input.topicAffinity;
      if (input.guardrails !== undefined) updateData.guardrails = input.guardrails;
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
          { error: 'Failed to update character', code: 'DATABASE_ERROR' },
          500
        );
      }

      return c.json(mapCharacterToResponse(character), 200);
    } catch {
      return c.json(
        { error: 'Failed to update character', code: 'INTERNAL_ERROR' },
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
 * Create generation record and return 202. Client subscribes to SSE to trigger execution.
 */
ai.post(
  '/characters/:id/generate',
  zValidator('json', GenerateContentRequestSchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const characterId = c.req.param('id');
    const input = c.req.valid('json');

    // Validate UUID format
    const validationResult = UuidSchema.safeParse(characterId);
    if (!validationResult.success) {
      return c.json(
        { error: 'Invalid character ID format', code: 'VALIDATION_ERROR' },
        400
      );
    }

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Verify ownership
      const { data: character, error: verifyError } = await supabase
        .from('characters')
        .select('id')
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (verifyError || !character) {
        return c.json(
          { error: 'Character not found', code: 'NOT_FOUND' },
          404
        );
      }

      // Rate limit: max 30 generations per character per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentGenerations, error: countError } = await supabase
        .from('content_generations')
        .select('id')
        .eq('character_id', characterId)
        .gte('created_at', oneHourAgo);

      if (countError) {
        return c.json(
          { error: 'Failed to check rate limit', code: 'DATABASE_ERROR' },
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

      // Create generation record — pipeline runs when client subscribes to SSE
      const { data: generation, error: insertError } = await supabase
        .from('content_generations')
        .insert({
          character_id: characterId,
          generation_type: input.generationType,
          input_prompt: input.inputPrompt,
          model_used: 'pending',
          model_params: input.modelParams || {},
          moderation_status: ModerationStatus.PENDING,
        })
        .select()
        .single();

      if (insertError || !generation) {
        return c.json(
          {
            error: 'Failed to create generation record',
            code: 'DATABASE_ERROR',
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
    } catch {
      return c.json(
        { error: 'Failed to trigger generation', code: 'INTERNAL_ERROR' },
        500
      );
    }
  }
);

/**
 * GET /api/ai/generations/:id
 * Get generation result
 */
ai.get('/generations/:id', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const generationId = c.req.param('id');

  // Validate UUID format
  const validationResult = UuidSchema.safeParse(generationId);
  if (!validationResult.success) {
    return c.json(
      { error: 'Invalid generation ID format', code: 'VALIDATION_ERROR' },
      400
    );
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Fetch generation with character ownership join
    const { data: generation, error: generationError } = await supabase
      .from('content_generations')
      .select('*, characters!inner(wallet_address)')
      .eq('id', generationId)
      .single();

    if (generationError || !generation) {
      return c.json(
        { error: 'Generation not found', code: 'NOT_FOUND' },
        404
      );
    }

    // Verify ownership through character join
    const ownerWallet = extractOwnerWallet(generation.characters);
    if (ownerWallet !== auth.walletAddress) {
      return c.json(
        { error: 'Unauthorized access to this generation', code: 'FORBIDDEN' },
        403
      );
    }

    return c.json(mapGenerationToResponse(generation), 200);
  } catch {
    return c.json(
      { error: 'Failed to fetch generation', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

/**
 * GET /api/ai/generations/:id/stream
 * SSE endpoint — runs the pipeline inline and streams progress events.
 *
 * Flow:
 * 1. Verify JWT from query param (EventSource can't set Authorization header)
 * 2. Verify ownership via character join
 * 3. Atomically claim the generation (pending → processing)
 * 4. Run pipeline with progress callback that writes SSE events
 * 5. On completion, send final result and close
 */
ai.get('/generations/:id/stream', async (c) => {
  const token = c.req.query('token');
  const generationId = c.req.param('id');

  if (!token) {
    return c.json(
      { error: 'Missing auth token in query params', code: 'UNAUTHORIZED' },
      401
    );
  }

  // Validate UUID format
  const validationResult = UuidSchema.safeParse(generationId);
  if (!validationResult.success) {
    return c.json(
      { error: 'Invalid generation ID format', code: 'VALIDATION_ERROR' },
      400
    );
  }

  try {
    // Verify JWT manually for SSE
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return c.json(
        { error: 'JWT configuration error', code: 'INTERNAL_ERROR' },
        500
      );
    }

    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    const walletAddress = payload.wallet_address;

    if (typeof walletAddress !== 'string' || !walletAddress) {
      return c.json({ error: 'Invalid token', code: 'UNAUTHORIZED' }, 401);
    }

    const supabase = createAuthenticatedClient(token);

    // Fetch generation with ownership verification
    const { data: generation, error: verifyError } = await supabase
      .from('content_generations')
      .select('*, characters!inner(wallet_address)')
      .eq('id', generationId)
      .single();

    if (verifyError || !generation) {
      return c.json(
        { error: 'Generation not found', code: 'NOT_FOUND' },
        404
      );
    }

    const ownerWallet = extractOwnerWallet(generation.characters);
    if (ownerWallet !== walletAddress) {
      return c.json({ error: 'Forbidden', code: 'FORBIDDEN' }, 403);
    }

    // If already complete, send the final result immediately
    if (
      generation.moderation_status === ModerationStatus.APPROVED ||
      generation.moderation_status === ModerationStatus.REJECTED ||
      generation.moderation_status === ModerationStatus.FLAGGED
    ) {
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');

      return stream(c, async (sseStream) => {
        const stage =
          generation.moderation_status === ModerationStatus.APPROVED
            ? 'complete'
            : 'error';
        await sseStream.write(
          `data: ${JSON.stringify({
            stage,
            message: 'Generation already completed',
            result: mapGenerationToResponse(generation),
          })}\n\n`
        );
      });
    }

    // If already being processed by another connection, tell client to wait
    if (generation.moderation_status === ModerationStatus.PROCESSING) {
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');

      return stream(c, async (sseStream) => {
        await sseStream.write(
          `data: ${JSON.stringify({
            stage: 'generating_content',
            message: 'Generation already in progress',
          })}\n\n`
        );

        // Poll until complete (max 5 min)
        const startTime = Date.now();
        const maxDuration = 5 * 60 * 1000;

        const poll = async (): Promise<void> => {
          while (Date.now() - startTime < maxDuration) {
            await new Promise((r) => setTimeout(r, 2000));

            const { data: currentGen } = await supabase
              .from('content_generations')
              .select('*')
              .eq('id', generationId)
              .single();

            if (!currentGen) break;

            if (
              currentGen.moderation_status === ModerationStatus.APPROVED ||
              currentGen.moderation_status === ModerationStatus.REJECTED ||
              currentGen.moderation_status === ModerationStatus.FLAGGED
            ) {
              const endStage =
                currentGen.moderation_status === ModerationStatus.APPROVED
                  ? 'complete'
                  : 'error';
              await sseStream.write(
                `data: ${JSON.stringify({
                  stage: endStage,
                  message: 'Generation complete',
                  result: mapGenerationToResponse(currentGen),
                })}\n\n`
              );
              return;
            }
          }
        };

        await poll();
      });
    }

    // Atomically claim the generation (pending → processing)
    const { data: claimed, error: claimError } = await supabase
      .from('content_generations')
      .update({ moderation_status: ModerationStatus.PROCESSING })
      .eq('id', generationId)
      .eq('moderation_status', ModerationStatus.PENDING)
      .select()
      .single();

    if (claimError || !claimed) {
      // Log claim failure for diagnostics (common causes: CHECK constraint missing
      // 'processing' value, concurrent HMR connection, or RLS issue).
      const { logger } = await import('@/lib/utils/logger');
      logger.error('Generation claim failed', {
        generationId,
        claimError: claimError?.message ?? claimError,
        claimErrorCode: (claimError as { code?: string } | null)?.code,
      });

      // Re-fetch current state and return the appropriate SSE response.
      const { data: currentGen } = await supabase
        .from('content_generations')
        .select('*')
        .eq('id', generationId)
        .single();

      if (!currentGen) {
        return c.json({ error: 'Generation not found', code: 'NOT_FOUND' }, 404);
      }

      // If the claim failed AND the generation is still PENDING, the pipeline
      // never ran (most likely cause: DB CHECK constraint missing 'processing').
      // Surface this as an error immediately rather than polling forever.
      if (currentGen.moderation_status === ModerationStatus.PENDING) {
        const errorMsg = claimError
          ? `Failed to claim generation: ${claimError.message}`
          : 'Generation claim failed — check that migration 20260212000001 has been applied in Supabase (adds processing to moderation_status CHECK constraint)';
        c.header('Content-Type', 'text/event-stream');
        c.header('Cache-Control', 'no-cache');
        c.header('Connection', 'keep-alive');
        return stream(c, async (sseStream) => {
          await sseStream.write(
            `data: ${JSON.stringify({ stage: 'error', message: errorMsg, error: errorMsg })}\n\n`
          );
        });
      }

      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');

      // Already finished — send the result immediately
      if (
        currentGen.moderation_status === ModerationStatus.APPROVED ||
        currentGen.moderation_status === ModerationStatus.REJECTED ||
        currentGen.moderation_status === ModerationStatus.FLAGGED
      ) {
        return stream(c, async (sseStream) => {
          const stage =
            currentGen.moderation_status === ModerationStatus.APPROVED ? 'complete' : 'error';
          await sseStream.write(
            `data: ${JSON.stringify({
              stage,
              message: 'Generation already completed',
              result: mapGenerationToResponse(currentGen),
            })}\n\n`
          );
        });
      }

      // Still processing — poll until done (same logic as the PROCESSING branch above)
      return stream(c, async (sseStream) => {
        await sseStream.write(
          `data: ${JSON.stringify({
            stage: 'generating_content',
            message: 'Generation already in progress',
          })}\n\n`
        );
        const startTime = Date.now();
        const maxDuration = 5 * 60 * 1000;
        while (Date.now() - startTime < maxDuration) {
          await new Promise((r) => setTimeout(r, 2000));
          const { data: polledGen } = await supabase
            .from('content_generations')
            .select('*')
            .eq('id', generationId)
            .single();
          if (!polledGen) break;
          if (
            polledGen.moderation_status === ModerationStatus.APPROVED ||
            polledGen.moderation_status === ModerationStatus.REJECTED ||
            polledGen.moderation_status === ModerationStatus.FLAGGED
          ) {
            const endStage =
              polledGen.moderation_status === ModerationStatus.APPROVED ? 'complete' : 'error';
            await sseStream.write(
              `data: ${JSON.stringify({
                stage: endStage,
                message: 'Generation complete',
                result: mapGenerationToResponse(polledGen),
              })}\n\n`
            );
            return;
          }
        }
      });
    }

    // Run pipeline and stream progress via SSE
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    return stream(c, async (sseStream) => {
      // Progress callback: map pipeline stages to client-facing names and write SSE
      const onProgress = (progress: PipelineProgress): void => {
        const frontendStage = PIPELINE_STAGE_MAP[progress.stage];
        if (frontendStage === null || frontendStage === undefined) return;

        void sseStream.write(
          `data: ${JSON.stringify({
            stage: frontendStage,
            message: progress.message,
          })}\n\n`
        );
      };

      try {
        await runPipeline(
          {
            generationId,
            characterId: generation.character_id,
            generationType: generation.generation_type as GenerationType,
            inputPrompt: generation.input_prompt,
            modelParams: (generation.model_params as Record<string, unknown>) || {},
            jwtToken: token,
          },
          onProgress
        );

        // Fetch final generation record for the complete event
        const { data: finalGen } = await supabase
          .from('content_generations')
          .select('*')
          .eq('id', generationId)
          .single();

        await sseStream.write(
          `data: ${JSON.stringify({
            stage: 'complete',
            message: 'Generation complete',
            result: finalGen ? mapGenerationToResponse(finalGen) : null,
          })}\n\n`
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Pipeline failed';
        await sseStream.write(
          `data: ${JSON.stringify({
            stage: 'error',
            message,
            error: message,
          })}\n\n`
        );
      }
    });
  } catch {
    return c.json(
      { error: 'Failed to establish stream', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

// =============================================================================
// AGENT NFT IDENTITY ROUTES
// =============================================================================

/**
 * POST /api/ai/characters/:id/mint-nft
 * Construct an NFT mint transaction for client-side signing.
 *
 * Returns a base64-encoded unsigned transaction, the pre-derived mint address,
 * and the metadata URI. The client signs via wallet adapter and submits.
 * After on-chain confirmation, the client calls /confirm-mint.
 *
 * SECURITY: The server NEVER signs transactions. The transaction is returned
 * unsigned for the owner wallet to sign client-side.
 */
ai.post('/characters/:id/mint-nft', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const characterId = c.req.param('id');

  const validationResult = UuidSchema.safeParse(characterId);
  if (!validationResult.success) {
    return c.json(
      { error: 'Invalid character ID format', code: 'VALIDATION_ERROR' },
      400
    );
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Verify ownership
    const { data: character, error: characterError } = await supabase
      .from('characters')
      .select('id, name, persona, topic_affinity, agent_pubkey, nft_mint_address, tapestry_profile_id')
      .eq('id', characterId)
      .eq('wallet_address', auth.walletAddress)
      .single();

    if (characterError || !character) {
      return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
    }

    // Block double-minting
    if (character.nft_mint_address) {
      return c.json(
        {
          error: 'Agent identity already minted',
          code: 'ALREADY_MINTED',
          mintAddress: character.nft_mint_address,
        },
        409
      );
    }

    let ownerAddress: Address;
    try {
      const { address } = await import('@solana/kit');
      ownerAddress = address(auth.walletAddress);
    } catch {
      return c.json(
        { error: 'Invalid wallet address', code: 'VALIDATION_ERROR' },
        400
      );
    }

    const { constructMintTransaction } = await import('@/lib/solana/agent-nft');

    const capabilities: string[] = [
      'content-generation',
      'social-publishing',
    ];
    const topicAffinity = (character.topic_affinity as string[] | null) ?? [];
    if (topicAffinity.length > 0) {
      capabilities.push('topical-alignment');
    }

    const result = await constructMintTransaction({
      characterId,
      name: character.name,
      description: character.persona,
      imageUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/og/agent/${characterId}`,
      capabilities,
      ownerWallet: ownerAddress,
    });

    return c.json(
      {
        transactionBase64: result.transactionBase64,
        mintAddress: result.mintAddress,
        metadataUri: result.metadataUri,
        costBreakdown: result.costBreakdown,
      },
      200
    );
  } catch (err) {
    const { logger } = await import('@/lib/utils/logger');
    logger.error('POST /characters/:id/mint-nft error', {
      characterId,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json(
      { error: 'Failed to construct mint transaction', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

/**
 * POST /api/ai/characters/:id/confirm-mint
 * After the client signs and submits the mint transaction, confirm on-chain
 * and update the character record with NFT identity fields.
 *
 * Request body: { mintAddress, transactionSignature, metadataUri }
 * Response: updated character object with nft_mint_address + registry_agent_id
 */
ai.post(
  '/characters/:id/confirm-mint',
  zValidator(
    'json',
    z.object({
      mintAddress: z.string().min(32).max(44),
      transactionSignature: z.string().min(32),
      metadataUri: z.string().url(),
    })
  ),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const characterId = c.req.param('id');

    const validationResult = UuidSchema.safeParse(characterId);
    if (!validationResult.success) {
      return c.json(
        { error: 'Invalid character ID format', code: 'VALIDATION_ERROR' },
        400
      );
    }

    const { mintAddress, transactionSignature, metadataUri } =
      c.req.valid('json');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Verify ownership and that NFT is not already confirmed
      const { data: character, error: characterError } = await supabase
        .from('characters')
        .select(
          'id, name, persona, topic_affinity, agent_pubkey, nft_mint_address, tapestry_profile_id, tapestry_username'
        )
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (characterError || !character) {
        return c.json(
          { error: 'Character not found', code: 'NOT_FOUND' },
          404
        );
      }

      if (character.nft_mint_address) {
        return c.json(
          {
            error: 'Agent identity already confirmed',
            code: 'ALREADY_MINTED',
            mintAddress: character.nft_mint_address,
          },
          409
        );
      }

      // Validate mint address format
      let mintAddr: Address;
      try {
        const { address } = await import('@solana/kit');
        mintAddr = address(mintAddress);
      } catch {
        return c.json(
          { error: 'Invalid mint address format', code: 'VALIDATION_ERROR' },
          400
        );
      }

      // Step 1: Verify transaction is confirmed on-chain
      const { verifyMintConfirmation } = await import('@/lib/solana/agent-nft');
      try {
        await verifyMintConfirmation(mintAddr, transactionSignature);
      } catch (confirmErr) {
        return c.json(
          {
            error:
              confirmErr instanceof Error
                ? confirmErr.message
                : 'Transaction not yet confirmed',
            code: 'NOT_CONFIRMED',
          },
          202
        );
      }

      // Step 2: Generate CAIP-2 agent ID
      const { buildAgentId, generateRegistrationFile, publishRegistrationFile } =
        await import('@/lib/solana/agent-registry');

      const agentId = buildAgentId(mintAddress);

      // Step 3: Generate and publish registration file to R2
      const capabilities: string[] = ['content-generation', 'social-publishing'];
      const topicAffinity = (character.topic_affinity as string[] | null) ?? [];
      if (topicAffinity.length > 0) capabilities.push('topical-alignment');

      const registrationFile = generateRegistrationFile({
        mintAddress,
        characterId,
        name: character.name,
        persona: character.persona,
        capabilities,
        agentWalletPubkey: character.agent_pubkey ?? undefined,
        tapestryProfile: character.tapestry_profile_id ?? undefined,
        socialPlatforms: [],
      });

      let registryUrl = '';
      try {
        const published = await publishRegistrationFile(
          characterId,
          registrationFile
        );
        registryUrl = published.url;
      } catch (publishErr) {
        // Non-fatal: R2 upload failure should not block DB update
        const { logger } = await import('@/lib/utils/logger');
        logger.error('Failed to publish registration file', {
          characterId,
          error:
            publishErr instanceof Error ? publishErr.message : String(publishErr),
        });
      }

      // Step 4: Update characters table with NFT identity fields
      const { data: updatedCharacter, error: updateError } = await supabase
        .from('characters')
        .update({
          nft_mint_address: mintAddress,
          nft_metadata_uri: metadataUri,
          registry_agent_id: agentId,
          registry_url: registryUrl || null,
        })
        .eq('id', characterId)
        .select()
        .single();

      if (updateError || !updatedCharacter) {
        const { logger } = await import('@/lib/utils/logger');
        logger.error('Failed to update character with NFT fields', {
          characterId,
          mintAddress,
          error: updateError?.message,
        });
        return c.json(
          { error: 'Failed to update character record', code: 'DATABASE_ERROR' },
          500
        );
      }

      const { logger } = await import('@/lib/utils/logger');
      logger.info('Agent NFT identity confirmed', {
        characterId,
        mintAddress,
        agentId,
        txSignature: transactionSignature,
      });

      return c.json(
        {
          ...mapCharacterToResponse(updatedCharacter),
          nftMintAddress: mintAddress,
          nftMetadataUri: metadataUri,
          registryAgentId: agentId,
          registryUrl: registryUrl || null,
        },
        200
      );
    } catch (err) {
      const { logger } = await import('@/lib/utils/logger');
      logger.error('POST /characters/:id/confirm-mint error', {
        characterId,
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json(
        { error: 'Failed to confirm mint', code: 'INTERNAL_ERROR' },
        500
      );
    }
  }
);

/**
 * GET /api/ai/characters/:id/registry
 * Get agent registration file metadata (public endpoint — but auth required
 * to prevent information leakage about unregistered agents).
 *
 * Returns the registry_agent_id and the registration file URL.
 * Returns 404 if the agent identity has not been minted yet.
 */
ai.get('/characters/:id/registry', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const characterId = c.req.param('id');

  const validationResult = UuidSchema.safeParse(characterId);
  if (!validationResult.success) {
    return c.json(
      { error: 'Invalid character ID format', code: 'VALIDATION_ERROR' },
      400
    );
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    const { data: character, error: characterError } = await supabase
      .from('characters')
      .select(
        'id, name, nft_mint_address, nft_metadata_uri, registry_agent_id, registry_url'
      )
      .eq('id', characterId)
      .eq('wallet_address', auth.walletAddress)
      .single();

    if (characterError || !character) {
      return c.json(
        { error: 'Character not found', code: 'NOT_FOUND' },
        404
      );
    }

    if (!character.nft_mint_address || !character.registry_agent_id) {
      return c.json(
        {
          error: 'Agent identity not minted yet',
          code: 'NOT_MINTED',
          message:
            'Mint an NFT identity for this agent to register it with the Solana Agent Registry.',
        },
        404
      );
    }

    return c.json(
      {
        characterId,
        agentName: character.name,
        mintAddress: character.nft_mint_address,
        metadataUri: character.nft_metadata_uri,
        registryAgentId: character.registry_agent_id,
        registryUrl: character.registry_url ?? null,
      },
      200
    );
  } catch (err) {
    const { logger } = await import('@/lib/utils/logger');
    logger.error('GET /characters/:id/registry error', {
      characterId,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json(
      { error: 'Failed to fetch registry data', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

export { ai };

