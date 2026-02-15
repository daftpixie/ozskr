import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { x402Facilitator } from '@x402/core/facilitator';
import { VerifyError } from '@x402/core/types';
import { ZodError } from 'zod';
import { VerifyRequestSchema } from '../schemas.js';

interface VerifyContext {
  facilitator: x402Facilitator;
}

export function verifyRoutes(ctx: VerifyContext): Hono {
  const app = new Hono();

  app.post('/verify', async (c) => {
    const raw = await c.req.json();

    let body;
    try {
      body = VerifyRequestSchema.parse(raw);
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
      const result = await ctx.facilitator.verify(body.paymentPayload as never, body.paymentRequirements as never);
      if (result.isValid) {
        return c.json(result, 200);
      }
      return c.json(result, 400);
    } catch (error) {
      if (error instanceof VerifyError) {
        return c.json(
          { isValid: false, invalidReason: error.invalidReason, invalidMessage: error.invalidMessage },
          error.statusCode as ContentfulStatusCode,
        );
      }
      throw error;
    }
  });

  return app;
}
