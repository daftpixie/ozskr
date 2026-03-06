/**
 * x402-Gated AI Service Routes
 *
 * These endpoints wrap external AI providers (fal.ai, Anthropic) behind x402
 * USDC payment gates.  Each POST request must include a valid X-Payment header
 * (or proceed without one when ENABLE_X402_BILLING=false).
 *
 * All routes require JWT authentication (via authMiddleware) AND x402 payment
 * verification (via buildX402Middleware).  The payment gate runs first.
 *
 * Usage logged to agent_service_usage table for billing reconciliation.
 *
 * SECURITY:
 *   - FAL_KEY is server-side only — never returned to client
 *   - ANTHROPIC_API_KEY is server-side only — never returned to client
 *   - Payment recipient is PLATFORM_TREASURY_ADDRESS (env var, not client input)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import * as fal from '@fal-ai/serverless-client';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { authMiddleware } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rate-limit';
import { createAuthenticatedClient } from '../supabase';
import { getServicePrice } from '@/lib/x402/service-pricing';
import { buildX402Middleware } from '@/lib/x402/server-middleware';
import { logger } from '@/lib/utils/logger';
import { getQuote } from '@/lib/pricing/pricing-calculator';
import type { ContentCategory } from '@/lib/pricing/model-registry';

// ---------------------------------------------------------------------------
// Hono env type
// ---------------------------------------------------------------------------

type ServicesEnv = {
  Variables: {
    walletAddress: string;
    jwtToken: string;
  };
};

// ---------------------------------------------------------------------------
// Rate limiters (belt-and-suspenders alongside x402 economic gate)
// ---------------------------------------------------------------------------

/** 20 image generation requests per hour per wallet */
const imageGenLimiter = createRateLimiter(20, 3600, 'ozskr:services:image');

/** 60 text generation requests per hour per wallet */
const textGenLimiter = createRateLimiter(60, 3600, 'ozskr:services:text');

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const ImageGenerateBodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  aspectRatio: z.string().optional().default('square_hd'),
  characterId: z.string().uuid(),
});

const ImageEditBodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  imageUrl: z.string().url(),
  characterId: z.string().uuid(),
});

const TextGenerateBodySchema = z.object({
  prompt: z.string().min(1).max(4000),
  systemPrompt: z.string().max(2000).optional(),
  characterId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Type narrowing helper
// ---------------------------------------------------------------------------

function getAuthContext(c: { get: (key: string) => unknown }) {
  const walletAddress = c.get('walletAddress');
  const jwtToken = c.get('jwtToken');
  if (typeof walletAddress !== 'string' || typeof jwtToken !== 'string') return null;
  return { walletAddress, jwtToken };
}

// ---------------------------------------------------------------------------
// fal.ai client setup
// ---------------------------------------------------------------------------

function configureFalClient(): void {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    throw new Error('FAL_KEY environment variable is required');
  }
  fal.config({ credentials: falKey });
}

// ---------------------------------------------------------------------------
// fal.ai response type helpers
// ---------------------------------------------------------------------------

interface FalImageOutput {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
}

interface FalImageResponse {
  images?: FalImageOutput[];
}

// ---------------------------------------------------------------------------
// Usage logging helper
// ---------------------------------------------------------------------------

async function logServiceUsage(params: {
  walletAddress: string;
  characterId: string;
  serviceId: string;
  priceUsdc: number;
  providerCostUsdc: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
  jwtToken: string;
}): Promise<void> {
  try {
    const supabase = createAuthenticatedClient(params.jwtToken);

    // TODO: agent_service_usage table not yet in Supabase types — using raw insert.
    // Add migration and regenerate types when the table is created.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('agent_service_usage') as any).insert({
      wallet_address: params.walletAddress,
      character_id: params.characterId,
      service_id: params.serviceId,
      price_usdc: params.priceUsdc,
      provider_cost_usdc: params.providerCostUsdc,
      latency_ms: params.latencyMs,
      success: params.success,
      error_message: params.errorMessage ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Non-fatal — billing logs should not block response delivery
    logger.error('Failed to write agent_service_usage log', {
      serviceId: params.serviceId,
      walletAddress: params.walletAddress,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Route pricing lookups (resolve once per module load)
// ---------------------------------------------------------------------------

const imageGeneratePrice = getServicePrice('image-generate');
const imageGenerateProPrice = getServicePrice('image-generate-pro');
const imageEditPrice = getServicePrice('image-edit');
const textGeneratePrice = getServicePrice('text-generate');

// ---------------------------------------------------------------------------
// Hono app
// ---------------------------------------------------------------------------

const services = new Hono<ServicesEnv>();

// ---------------------------------------------------------------------------
// GET /services/pricing
// Public — no auth required.  Returns a live PriceQuote for the requested
// content category and model configuration.
// Cache-Control: max-age=300 (5 minutes) — fal.ai prices are cached upstream
// for the same TTL.
// ---------------------------------------------------------------------------

const PricingQuerySchema = z.object({
  category: z.enum(['text', 'image', 'image-text', 'video', 'video-text']),
  imageModel: z.string().optional(),
  videoModel: z.string().optional(),
  textModel: z.string().optional(),
  videoDuration: z.string().optional(),
  videoResolution: z.enum(['720p', '1080p', '4K']).optional(),
  videoAudio: z.enum(['true', 'false']).optional(),
});

services.get('/pricing', zValidator('query', PricingQuerySchema), async (c) => {
  const query = c.req.valid('query');

  const durationSec = query.videoDuration
    ? parseInt(query.videoDuration, 10)
    : undefined;

  if (durationSec !== undefined && (isNaN(durationSec) || durationSec <= 0)) {
    return c.json(
      { error: 'videoDuration must be a positive integer', code: 'VALIDATION_ERROR' },
      400
    );
  }

  try {
    const quote = await getQuote({
      category: query.category as ContentCategory,
      imageModel: query.imageModel,
      videoModel: query.videoModel,
      textModel: query.textModel,
      videoDurationSec: durationSec,
      videoResolution: query.videoResolution,
      videoAudio: query.videoAudio === 'false' ? false : undefined,
    });

    // Serialize BigInt as string — JSON.stringify cannot handle BigInt natively
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({
      ...quote,
      platformCostLamports: quote.platformCostLamports.toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('GET /services/pricing failed', { error: message });
    return c.json(
      { error: 'Failed to compute price quote', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

// All remaining service routes require JWT authentication
services.use('/*', authMiddleware);

// ---------------------------------------------------------------------------
// POST /services/image-generate
// ---------------------------------------------------------------------------

if (imageGeneratePrice) {
  services.post(
    '/image-generate',
    buildX402Middleware(imageGeneratePrice, 'POST', '/api/services/image-generate'),
    imageGenLimiter,
    zValidator('json', ImageGenerateBodySchema),
    async (c) => {
      const auth = getAuthContext(c);
      if (!auth) {
        return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
      }

      const body = c.req.valid('json');
      const start = Date.now();

      try {
        configureFalClient();

        const result = await fal.subscribe('fal-ai/flux/schnell', {
          input: {
            prompt: body.prompt,
            image_size: body.aspectRatio,
            num_images: 1,
          },
          logs: false,
        }) as FalImageResponse;

        const latencyMs = Date.now() - start;
        const images = result.images ?? [];

        await logServiceUsage({
          walletAddress: auth.walletAddress,
          characterId: body.characterId,
          serviceId: 'image-generate',
          priceUsdc: imageGeneratePrice.priceUsdc,
          providerCostUsdc: imageGeneratePrice.platformCostUsdc,
          latencyMs,
          success: true,
          jwtToken: auth.jwtToken,
        });

        return c.json({
          images,
          cost: imageGeneratePrice.priceUsdc,
          serviceId: 'image-generate',
          latencyMs,
        });
      } catch (err) {
        const latencyMs = Date.now() - start;
        const message = err instanceof Error ? err.message : 'Unknown error';

        logger.error('image-generate service failed', {
          walletAddress: auth.walletAddress,
          characterId: body.characterId,
          error: message,
        });

        await logServiceUsage({
          walletAddress: auth.walletAddress,
          characterId: body.characterId,
          serviceId: 'image-generate',
          priceUsdc: imageGeneratePrice.priceUsdc,
          providerCostUsdc: imageGeneratePrice.platformCostUsdc,
          latencyMs,
          success: false,
          errorMessage: message,
          jwtToken: auth.jwtToken,
        });

        return c.json(
          { error: 'Image generation failed', code: 'UPSTREAM_ERROR', details: message },
          502
        );
      }
    }
  );
}

// ---------------------------------------------------------------------------
// POST /services/image-generate-pro
// ---------------------------------------------------------------------------

if (imageGenerateProPrice) {
  services.post(
    '/image-generate-pro',
    buildX402Middleware(imageGenerateProPrice, 'POST', '/api/services/image-generate-pro'),
    imageGenLimiter,
    zValidator('json', ImageGenerateBodySchema),
    async (c) => {
      const auth = getAuthContext(c);
      if (!auth) {
        return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
      }

      const body = c.req.valid('json');
      const start = Date.now();

      try {
        configureFalClient();

        const result = await fal.subscribe('fal-ai/flux/dev', {
          input: {
            prompt: body.prompt,
            image_size: body.aspectRatio,
            num_images: 1,
          },
          logs: false,
        }) as FalImageResponse;

        const latencyMs = Date.now() - start;
        const images = result.images ?? [];

        await logServiceUsage({
          walletAddress: auth.walletAddress,
          characterId: body.characterId,
          serviceId: 'image-generate-pro',
          priceUsdc: imageGenerateProPrice.priceUsdc,
          providerCostUsdc: imageGenerateProPrice.platformCostUsdc,
          latencyMs,
          success: true,
          jwtToken: auth.jwtToken,
        });

        return c.json({
          images,
          cost: imageGenerateProPrice.priceUsdc,
          serviceId: 'image-generate-pro',
          latencyMs,
        });
      } catch (err) {
        const latencyMs = Date.now() - start;
        const message = err instanceof Error ? err.message : 'Unknown error';

        logger.error('image-generate-pro service failed', {
          walletAddress: auth.walletAddress,
          characterId: body.characterId,
          error: message,
        });

        await logServiceUsage({
          walletAddress: auth.walletAddress,
          characterId: body.characterId,
          serviceId: 'image-generate-pro',
          priceUsdc: imageGenerateProPrice.priceUsdc,
          providerCostUsdc: imageGenerateProPrice.platformCostUsdc,
          latencyMs,
          success: false,
          errorMessage: message,
          jwtToken: auth.jwtToken,
        });

        return c.json(
          { error: 'Image generation (pro) failed', code: 'UPSTREAM_ERROR', details: message },
          502
        );
      }
    }
  );
}

// ---------------------------------------------------------------------------
// POST /services/image-edit
// ---------------------------------------------------------------------------

if (imageEditPrice) {
  services.post(
    '/image-edit',
    buildX402Middleware(imageEditPrice, 'POST', '/api/services/image-edit'),
    imageGenLimiter,
    zValidator('json', ImageEditBodySchema),
    async (c) => {
      const auth = getAuthContext(c);
      if (!auth) {
        return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
      }

      const body = c.req.valid('json');
      const start = Date.now();

      try {
        configureFalClient();

        const result = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
          input: {
            prompt: body.prompt,
            image_url: body.imageUrl,
            num_images: 1,
          },
          logs: false,
        }) as FalImageResponse;

        const latencyMs = Date.now() - start;
        const images = result.images ?? [];

        await logServiceUsage({
          walletAddress: auth.walletAddress,
          characterId: body.characterId,
          serviceId: 'image-edit',
          priceUsdc: imageEditPrice.priceUsdc,
          providerCostUsdc: imageEditPrice.platformCostUsdc,
          latencyMs,
          success: true,
          jwtToken: auth.jwtToken,
        });

        return c.json({
          images,
          cost: imageEditPrice.priceUsdc,
          serviceId: 'image-edit',
          latencyMs,
        });
      } catch (err) {
        const latencyMs = Date.now() - start;
        const message = err instanceof Error ? err.message : 'Unknown error';

        logger.error('image-edit service failed', {
          walletAddress: auth.walletAddress,
          characterId: body.characterId,
          error: message,
        });

        await logServiceUsage({
          walletAddress: auth.walletAddress,
          characterId: body.characterId,
          serviceId: 'image-edit',
          priceUsdc: imageEditPrice.priceUsdc,
          providerCostUsdc: imageEditPrice.platformCostUsdc,
          latencyMs,
          success: false,
          errorMessage: message,
          jwtToken: auth.jwtToken,
        });

        return c.json(
          { error: 'Image edit failed', code: 'UPSTREAM_ERROR', details: message },
          502
        );
      }
    }
  );
}

// ---------------------------------------------------------------------------
// POST /services/text-generate
// ---------------------------------------------------------------------------

if (textGeneratePrice) {
  services.post(
    '/text-generate',
    buildX402Middleware(textGeneratePrice, 'POST', '/api/services/text-generate'),
    textGenLimiter,
    zValidator('json', TextGenerateBodySchema),
    async (c) => {
      const auth = getAuthContext(c);
      if (!auth) {
        return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
      }

      const body = c.req.valid('json');
      const start = Date.now();

      // ANTHROPIC_API_KEY is read by @ai-sdk/anthropic automatically from env.
      // We validate it's present here to return a clear 500 rather than a
      // cryptic upstream error from the SDK.
      if (!process.env.ANTHROPIC_API_KEY) {
        logger.error('ANTHROPIC_API_KEY not configured', {
          walletAddress: auth.walletAddress,
        });
        return c.json(
          { error: 'Service not configured', code: 'INTERNAL_ERROR' },
          500
        );
      }

      try {
        const model = anthropic('claude-sonnet-4-6');

        const result = await generateText({
          model,
          system: body.systemPrompt ?? 'You are a helpful AI assistant.',
          prompt: body.prompt,
          maxTokens: 1024,
        } as never);

        const latencyMs = Date.now() - start;

        // AI SDK usage shape
        const usage = result.usage as { promptTokens?: number; completionTokens?: number };

        await logServiceUsage({
          walletAddress: auth.walletAddress,
          characterId: body.characterId,
          serviceId: 'text-generate',
          priceUsdc: textGeneratePrice.priceUsdc,
          providerCostUsdc: textGeneratePrice.platformCostUsdc,
          latencyMs,
          success: true,
          jwtToken: auth.jwtToken,
        });

        return c.json({
          text: result.text,
          cost: textGeneratePrice.priceUsdc,
          serviceId: 'text-generate',
          latencyMs,
          usage: {
            inputTokens: usage.promptTokens ?? 0,
            outputTokens: usage.completionTokens ?? 0,
          },
        });
      } catch (err) {
        const latencyMs = Date.now() - start;
        const message = err instanceof Error ? err.message : 'Unknown error';

        logger.error('text-generate service failed', {
          walletAddress: auth.walletAddress,
          characterId: body.characterId,
          error: message,
        });

        await logServiceUsage({
          walletAddress: auth.walletAddress,
          characterId: body.characterId,
          serviceId: 'text-generate',
          priceUsdc: textGeneratePrice.priceUsdc,
          providerCostUsdc: textGeneratePrice.platformCostUsdc,
          latencyMs,
          success: false,
          errorMessage: message,
          jwtToken: auth.jwtToken,
        });

        return c.json(
          { error: 'Text generation failed', code: 'UPSTREAM_ERROR', details: message },
          502
        );
      }
    }
  );
}

export { services };
