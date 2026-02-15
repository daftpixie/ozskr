import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { x402Facilitator } from '@x402/core/facilitator';
import { SettleError } from '@x402/core/types';

interface SettleContext {
  facilitator: x402Facilitator;
}

export function settleRoutes(ctx: SettleContext): Hono {
  const app = new Hono();

  app.post('/settle', async (c) => {
    const body = await c.req.json();
    const { paymentPayload, paymentRequirements } = body;

    if (!paymentPayload || !paymentRequirements) {
      return c.json(
        { error: 'INVALID_REQUEST', message: 'Missing paymentPayload or paymentRequirements' },
        400,
      );
    }

    try {
      const result = await ctx.facilitator.settle(paymentPayload, paymentRequirements);
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
