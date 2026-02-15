import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { x402Facilitator } from '@x402/core/facilitator';
import { VerifyError } from '@x402/core/types';

interface VerifyContext {
  facilitator: x402Facilitator;
}

export function verifyRoutes(ctx: VerifyContext): Hono {
  const app = new Hono();

  app.post('/verify', async (c) => {
    const body = await c.req.json();
    const { paymentPayload, paymentRequirements } = body;

    if (!paymentPayload || !paymentRequirements) {
      return c.json(
        { error: 'INVALID_REQUEST', message: 'Missing paymentPayload or paymentRequirements' },
        400,
      );
    }

    try {
      const result = await ctx.facilitator.verify(paymentPayload, paymentRequirements);
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
