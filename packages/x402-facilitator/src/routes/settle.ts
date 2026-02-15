import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { x402Facilitator } from '@x402/core/facilitator';
import { SettleError } from '@x402/core/types';
import { ZodError } from 'zod';
import { SettleRequestSchema } from '../schemas.js';

interface SettleContext {
  facilitator: x402Facilitator;
}

export function settleRoutes(ctx: SettleContext): Hono {
  const app = new Hono();

  app.post('/settle', async (c) => {
    const raw = await c.req.json();

    let body;
    try {
      body = SettleRequestSchema.parse(raw);
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          issues: error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        }, 400);
      }
      throw error;
    }

    try {
      const result = await ctx.facilitator.settle(body.paymentPayload as never, body.paymentRequirements as never);
      if (result.success) {
        return c.json(result, 200);
      }
      return c.json(result, 400);
    } catch (error) {
      if (error instanceof SettleError) {
        return c.json(
          { success: false, errorReason: error.errorReason, errorMessage: error.errorMessage },
          error.statusCode as ContentfulStatusCode,
        );
      }
      throw error;
    }
  });

  return app;
}
