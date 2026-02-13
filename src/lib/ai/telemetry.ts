/**
 * Langfuse Telemetry & Tracing
 * AI operation observability for all generations
 */

import { Langfuse } from 'langfuse';

/**
 * Lazy-initialized Langfuse client.
 * Deferred to avoid build-time failures when env vars aren't set.
 */
let langfuseInstance: Langfuse | null = null;

export const getLangfuse = (): Langfuse => {
  if (!langfuseInstance) {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const host = process.env.LANGFUSE_BASEURL;

    if (!publicKey || !secretKey) {
      throw new Error(
        'Missing Langfuse environment variables: LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are required'
      );
    }

    langfuseInstance = new Langfuse({
      publicKey,
      secretKey,
      baseUrl: host,
    });
  }
  return langfuseInstance;
};

/**
 * Token usage tracking
 */
export interface TokenUsage {
  input: number;
  output: number;
  cached?: number;
}

/**
 * Create a new trace for an AI operation
 *
 * @param name - Trace name (e.g., 'content-generation', 'prompt-enhancement')
 * @param metadata - Optional metadata to attach to trace
 * @returns Langfuse trace object
 */
export const createTrace = (name: string, metadata?: Record<string, unknown>) => {
  return getLangfuse().trace({
    name,
    metadata,
  });
};

/**
 * Create a span within a trace
 *
 * @param trace - Parent trace
 * @param name - Span name (e.g., 'claude-api-call', 'mem0-recall')
 * @returns Langfuse span object
 */
export const createSpan = (trace: ReturnType<typeof createTrace>, name: string) => {
  return trace.span({
    name,
  });
};

/**
 * Log a generation event to Langfuse
 *
 * Records all critical metrics for AI generations:
 * - Input/output text
 * - Token usage
 * - Cost
 * - Latency
 * - Cache hit/miss
 */
export const traceGeneration = async (params: {
  trace: ReturnType<typeof createTrace>;
  name: string;
  model: string;
  input: string;
  output: string;
  tokenUsage: TokenUsage;
  latencyMs: number;
  cacheHit?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> => {
  const { trace, name, model, input, output, tokenUsage, latencyMs, cacheHit, metadata } = params;

  trace.generation({
    name,
    model,
    input,
    output,
    usage: {
      input: tokenUsage.input,
      output: tokenUsage.output,
      total: tokenUsage.input + tokenUsage.output,
    },
    metadata: {
      ...metadata,
      latencyMs,
      cacheHit: cacheHit ?? false,
      cachedTokens: tokenUsage.cached ?? 0,
    },
  });

  await getLangfuse().flushAsync();
};

/**
 * Helper to wrap Claude API calls with Langfuse tracing
 *
 * Usage:
 * ```typescript
 * const trace = createTrace('content-generation', { characterId });
 * const result = await traceClaudeCall(trace, 'prompt-enhancement', async () => {
 *   return streamText({ model, prompt });
 * });
 * ```
 */
export const traceClaudeCall = async <T>(
  trace: ReturnType<typeof createTrace>,
  spanName: string,
  fn: () => Promise<T>
): Promise<T> => {
  const span = createSpan(trace, spanName);
  const startTime = Date.now();

  try {
    const result = await fn();
    const latencyMs = Date.now() - startTime;

    span.update({
      metadata: {
        latencyMs,
        status: 'success',
      },
    });

    return result;
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Unknown error';

    span.update({
      metadata: {
        latencyMs,
        status: 'error',
        error: message,
      },
    });

    throw error;
  } finally {
    await getLangfuse().flushAsync();
  }
};
