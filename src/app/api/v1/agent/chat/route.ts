/**
 * POST /api/v1/agent/chat
 *
 * SSE streaming chat endpoint for the YellowBrick command bar.
 *
 * Auth: Bearer JWT verified against JWT_SECRET (same pattern as Hono authMiddleware).
 * Supabase auth-helpers cookies are NOT used — the app issues its own JWTs.
 *
 * Streams text/event-stream with events:
 *   data: {"type":"chunk","content":"<text>"}\n\n
 *   data: {"type":"done"}\n\n
 *   data: {"type":"error","error":"<message>"}\n\n
 *
 * Langfuse tracing is enabled when LANGFUSE_SECRET_KEY is present — the endpoint
 * does not fail if the key is absent.
 */

import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { jwtVerify } from 'jose';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  context: z
    .enum(['dashboard', 'calendar', 'content', 'analytics', 'social', 'settings'])
    .optional()
    .default('dashboard'),
});

// ---------------------------------------------------------------------------
// System prompts by context
// ---------------------------------------------------------------------------

const SYSTEM_PROMPTS: Record<string, string> = {
  dashboard:
    'You are a helpful AI assistant for the ozskr.ai platform dashboard. ' +
    'Help users understand their agent activity, navigate the platform, and get the most out of their AI influencer agents. ' +
    'Be concise, friendly, and practical.',

  content:
    'You are a creative AI content assistant for the ozskr.ai platform. ' +
    'Help users craft compelling social media content, brainstorm ideas, refine captions, and develop content strategies for their AI influencer agents. ' +
    'Be creative, engaging, and platform-aware.',

  social:
    'You are a social media strategy assistant for the ozskr.ai platform. ' +
    'Help users build and grow their AI influencer agents\' social presence, optimize engagement, and develop audience growth strategies. ' +
    'Be data-informed, strategic, and actionable.',

  calendar:
    'You are a scheduling and planning assistant for the ozskr.ai platform. ' +
    'Help users plan content calendars, schedule posts for optimal timing, and manage their AI influencer agent publishing workflows. ' +
    'Be organized, time-aware, and efficient.',

  analytics:
    'You are a data analysis assistant for the ozskr.ai platform. ' +
    'Help users interpret agent performance metrics, understand engagement trends, and derive actionable insights from their analytics data. ' +
    'Be precise, analytical, and insight-focused.',

  settings:
    'You are a configuration assistant for the ozskr.ai platform. ' +
    'Help users set up and adjust their AI influencer agent settings, understand configuration options, and troubleshoot setup issues. ' +
    'Be clear, accurate, and step-by-step.',
};

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function sseChunk(content: string): string {
  const payload = JSON.stringify({ type: 'chunk', content });
  return `data: ${payload}\n\n`;
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

/**
 * Extract and verify the JWT from the Authorization header.
 * Returns the wallet address on success, or null if auth fails.
 */
async function verifyAuth(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

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
    if (typeof walletAddress !== 'string' || !walletAddress) {
      return null;
    }

    return walletAddress;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Optional Langfuse tracing
// ---------------------------------------------------------------------------

/**
 * Attempt to create a Langfuse trace for the chat request.
 * Returns null if Langfuse is not configured — never throws.
 */
async function tryCreateTrace(
  walletAddress: string,
  context: string
): Promise<{ end: (outputLength: number) => void } | null> {
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }

  try {
    const { getLangfuse } = await import('@/lib/ai/telemetry');
    const langfuse = getLangfuse();
    const startTime = Date.now();
    const trace = langfuse.trace({
      name: 'agent-chat',
      userId: walletAddress,
      metadata: { context, model: 'claude-haiku-4-5-20251001' },
    });

    return {
      end: (outputLength: number) => {
        trace.update({
          metadata: {
            latencyMs: Date.now() - startTime,
            outputChars: outputLength,
          },
        });
        // Fire-and-forget flush
        void langfuse.flushAsync().catch(() => {});
      },
    };
  } catch {
    // Langfuse is optional — never let telemetry failures surface to users
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<Response> {
  // 1. Auth
  const walletAddress = await verifyAuth(req);
  if (!walletAddress) {
    return new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Parse and validate request body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
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

  const { message, context } = parsed.data;
  const systemPrompt = SYSTEM_PROMPTS[context] ?? SYSTEM_PROMPTS.dashboard;

  logger.info('[agent-chat] request received', {
    walletAddress,
    context,
    messageLength: message.length,
  });

  // 3. Start optional Langfuse trace
  const trace = await tryCreateTrace(walletAddress, context);

  // 4. Build the streaming SSE response
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let outputLength = 0;

      try {
        const result = streamText({
          model: anthropic('claude-haiku-4-5-20251001'),
          system: systemPrompt,
          messages: [{ role: 'user', content: message }],
          // Apply prompt caching to the system prompt for character context
          providerOptions: {
            anthropic: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        });

        for await (const delta of result.textStream) {
          controller.enqueue(encoder.encode(sseChunk(delta)));
          outputLength += delta.length;
        }

        controller.enqueue(encoder.encode(sseDone()));
        trace?.end(outputLength);

        logger.info('[agent-chat] stream complete', {
          walletAddress,
          context,
          outputLength,
        });
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : 'Stream error';
        logger.error('[agent-chat] stream error', { walletAddress, context, error: errMessage });
        controller.enqueue(encoder.encode(sseError('An error occurred. Please try again.')));
        trace?.end(outputLength);
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
