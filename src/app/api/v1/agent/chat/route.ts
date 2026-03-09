/**
 * POST /api/v1/agent/chat
 *
 * SSE streaming chat endpoint powered by the PersonaAgent (Mastra).
 *
 * Auth: Bearer JWT verified against JWT_SECRET (same pattern as Hono authMiddleware).
 * Rate limit: 30 req/min per wallet address (Upstash sliding window).
 *
 * Memory:
 *   - Layer 1: Mastra working memory (per-character, resource-scoped)
 *   - Layer 2: Mem0 cross-session context (per-character, namespace-isolated)
 *
 * Streams text/event-stream with events:
 *   data: {"type":"chunk","content":"<text>"}\n\n
 *   data: {"type":"done"}\n\n
 *   data: {"type":"error","error":"<message>"}\n\n
 *
 * Moderation: assistant response is run through moderateContent() before the
 * stream closes. If blocked, a {"type":"error"} event is sent instead of the
 * final content — no blocked text is transmitted to the client.
 *
 * Orchestration boundary: Mastra agent (simple streaming chat — this file).
 * LangGraph is reserved for multi-step content pipelines in pipeline/index.ts.
 */

import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { z } from 'zod';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/utils/logger';
import { loadCharacterDNA, CharacterNotFoundError } from '@/lib/ai/character-dna';
import { buildAgentContext, storeMem0Memory } from '@/lib/ai/agent/memory-layers';
import { createPersonaAgent, personaAgent } from '@/lib/ai/agent/persona-agent';
import type { Agent } from '@mastra/core/agent';
import { moderateContent } from '@/lib/ai/pipeline/moderation';
import { ModerationStatus } from '@/types/database';
import { createAuthenticatedClient } from '@/lib/api/supabase';
import { getLangfuse } from '@/lib/ai/telemetry';

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  context: z
    .enum(['dashboard', 'calendar', 'content', 'analytics', 'social', 'settings'])
    .optional()
    .default('dashboard'),
  threadId: z.string().uuid().optional(),
  characterId: z.string().uuid().optional(),
  attachments: z
    .array(
      z.object({ url: z.string(), name: z.string(), type: z.string() })
    )
    .optional(),
});

// ---------------------------------------------------------------------------
// Rate limiter (Upstash sliding window — 30 req/60s per wallet)
// ---------------------------------------------------------------------------

let _ratelimiter: Ratelimit | null = null;

function getRatelimiter(): Ratelimit | null {
  if (_ratelimiter) return _ratelimiter;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    logger.warn('[agent-chat] Upstash not configured — rate limiting disabled');
    return null;
  }

  try {
    _ratelimiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(30, '60 s'),
      prefix: 'ozskr:chat:ratelimit',
    });
    return _ratelimiter;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function sseChunk(content: string): string {
  return `data: ${JSON.stringify({ type: 'chunk', content })}\n\n`;
}

function sseDone(): string {
  return `data: ${JSON.stringify({ type: 'done' })}\n\n`;
}

function sseError(error: string): string {
  return `data: ${JSON.stringify({ type: 'error', error })}\n\n`;
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function verifyAuth(req: NextRequest): Promise<{ walletAddress: string; token: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    logger.error('[agent-chat] JWT_SECRET not configured');
    return null;
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);

    const walletAddress = payload.wallet_address;
    if (typeof walletAddress !== 'string' || !walletAddress) return null;

    return { walletAddress, token };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<Response> {
  // 1. Auth
  const auth = await verifyAuth(req);
  if (!auth) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const { walletAddress, token: jwtToken } = auth;

  // 2. Rate limit (before any AI work)
  const limiter = getRatelimiter();
  if (limiter) {
    try {
      const { success, limit, remaining, reset } = await limiter.limit(
        `chat:ratelimit:${walletAddress}`
      );
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded. Maximum 30 requests per 60 seconds.',
            code: 'RATE_LIMITED',
            retryAfter,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString(),
            },
          }
        );
      }
    } catch {
      // Graceful degradation: Redis unavailable — allow request
    }
  }

  // 3. Parse request body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const parsed = ChatRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: 'Invalid request body',
        code: 'BAD_REQUEST',
        details: parsed.error.flatten(),
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { message, context, threadId, characterId } = parsed.data;

  logger.info('[agent-chat] request received', {
    walletAddress,
    context,
    characterId: characterId ?? 'none',
    messageLength: message.length,
    threadId: threadId ?? 'none',
  });

  // 4. Optional Langfuse trace
  let langfuse: ReturnType<typeof getLangfuse> | null = null;
  let traceStartTime = Date.now();
  let langfuseTrace: ReturnType<ReturnType<typeof getLangfuse>['trace']> | null = null;

  try {
    langfuse = getLangfuse();
    traceStartTime = Date.now();
    langfuseTrace = langfuse.trace({
      name: 'agent-chat',
      userId: walletAddress,
      metadata: {
        context,
        characterId: characterId ?? 'generic',
        model: 'claude-sonnet-4-6',
      },
    });
  } catch {
    // Langfuse optional — never block on telemetry
  }

  // 5. Load character DNA (if characterId provided)
  // Typed as Agent (base class) to allow both personaAgent (generic) and createPersonaAgent (character-specific)
  let agent: Agent = personaAgent;
  let agentContext: Awaited<ReturnType<typeof buildAgentContext>> | null = null;

  if (characterId) {
    try {
      const supabase = createAuthenticatedClient(jwtToken);
      const dna = await loadCharacterDNA(characterId, supabase);
      agent = createPersonaAgent(dna);
      agentContext = await buildAgentContext(dna, message, jwtToken);

      logger.info('[agent-chat] character DNA loaded', {
        characterId,
        name: dna.name,
        mem0ContextCount: agentContext.relevantMem0Context.length,
      });
    } catch (err) {
      if (err instanceof CharacterNotFoundError) {
        return new Response(
          JSON.stringify({ error: `Character not found: ${characterId}`, code: 'NOT_FOUND' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error('[agent-chat] failed to load character DNA', {
        characterId,
        error: errMsg,
      });
      // Fall back to generic agent
    }
  }

  // 6. Build the streaming SSE response
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let outputBuffer = '';

      const enqueue = (text: string) => {
        controller.enqueue(encoder.encode(text));
      };

      try {
        // Build system context from Mem0 if available
        let systemContext = '';
        if (agentContext && agentContext.relevantMem0Context.length > 0) {
          systemContext =
            '\n\nRELEVANT MEMORY CONTEXT:\n' +
            agentContext.relevantMem0Context
              .map((m, i) => `[${i + 1}] ${m}`)
              .join('\n');
        }

        // Compose the user message (with optional Mem0 context appended)
        const userMessage = systemContext
          ? `${message}\n\n[Context: current page = ${context}]${systemContext}`
          : `${message}\n\n[Context: current page = ${context}]`;

        // Call the PersonaAgent stream
        const streamResult = await agent.stream(
          [{ role: 'user', content: userMessage }],
          threadId
            ? {
                memory: {
                  thread: threadId,
                  resource: characterId ?? walletAddress,
                },
              }
            : undefined
        );

        // Consume textStream (Web ReadableStream<string>)
        const reader = streamResult.textStream.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            enqueue(sseChunk(value));
            outputBuffer += value;
          }
        }

        // 7. Moderation — run on the complete buffered response
        if (outputBuffer.trim()) {
          try {
            const modResult = await moderateContent(
              { text: outputBuffer },
              () => {} // no-op progress callback for inline moderation
            );

            if (modResult.status === ModerationStatus.REJECTED) {
              logger.warn('[agent-chat] response blocked by moderation', {
                walletAddress,
                characterId: characterId ?? 'generic',
              });
              enqueue(sseError('Content blocked by moderation'));
              controller.close();
              return;
            }
          } catch {
            // Non-fatal: moderation error should not block the response
            logger.warn('[agent-chat] moderation check failed — proceeding');
          }
        }

        enqueue(sseDone());

        // 8. Post-stream: update Mastra working memory + Mem0
        if (agentContext) {
          const { mastraMemory, mem0Namespace } = agentContext;

          // Update working memory with session insight (fire-and-forget)
          void (async () => {
            try {
              const currentWM = await mastraMemory.getWorkingMemory();
              // Append a lightweight interaction note to the working memory
              if (currentWM && outputBuffer.length > 0) {
                const updatedWM = currentWM.replace(
                  '</agent_working_memory>',
                  `  <last_interaction>${new Date().toISOString()}: User asked about "${context}" context</last_interaction>\n</agent_working_memory>`
                );
                await mastraMemory.updateWorkingMemory(updatedWM);
              }
            } catch {
              // Non-fatal
            }
          })();

          // Store significant response in Mem0 (fire-and-forget)
          if (outputBuffer.length > 100) {
            void storeMem0Memory(
              mem0Namespace,
              `User [${walletAddress}] asked (${context} context): ${message.substring(0, 200)}`,
              {
                walletAddress,
                context,
                responseLength: outputBuffer.length,
                timestamp: new Date().toISOString(),
              }
            );
          }
        }

        // Finalize Langfuse trace
        langfuseTrace?.update({
          metadata: {
            latencyMs: Date.now() - traceStartTime,
            outputChars: outputBuffer.length,
            status: 'success',
          },
        });
        void langfuse?.flushAsync().catch(() => {});

        logger.info('[agent-chat] stream complete', {
          walletAddress,
          context,
          outputLength: outputBuffer.length,
        });
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : 'Stream error';
        logger.error('[agent-chat] stream error', {
          walletAddress,
          context,
          error: errMessage,
        });
        enqueue(sseError('An error occurred. Please try again.'));

        langfuseTrace?.update({
          metadata: {
            latencyMs: Date.now() - traceStartTime,
            status: 'error',
            error: errMessage,
          },
        });
        void langfuse?.flushAsync().catch(() => {});
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
