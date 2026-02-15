import { Hono } from 'hono';
import type { x402Facilitator } from '@x402/core/facilitator';

interface SupportedContext {
  facilitator: x402Facilitator;
}

export function supportedRoutes(ctx: SupportedContext): Hono {
  const app = new Hono();

  app.get('/supported', (c) => {
    const supported = ctx.facilitator.getSupported();
    return c.json(supported);
  });

  return app;
}
