import { Hono } from 'hono';
import type { ReplayGuard } from '../replay.js';
import type { Config } from '../config.js';

interface HealthContext {
  config: Config;
  replayGuard: ReplayGuard;
  startTime: number;
}

export function healthRoutes(ctx: HealthContext): Hono {
  const app = new Hono();

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      version: '0.1.0-beta',
      network: ctx.config.solanaNetwork,
      uptime: Math.floor((Date.now() - ctx.startTime) / 1000),
      replayGuardSize: ctx.replayGuard.size(),
    });
  });

  return app;
}
