import { Hono } from 'hono';
import type { ReplayGuard } from '../replay.js';
import type { GasManager } from '../settlement/gas-manager.js';
import type { Config } from '../config.js';

interface HealthContext {
  config: Config;
  replayGuard: ReplayGuard;
  startTime: number;
  gasManager?: GasManager;
  activeModules?: string[];
}

export function healthRoutes(ctx: HealthContext): Hono {
  const app = new Hono();

  app.get('/health', async (c) => {
    const response: Record<string, unknown> = {
      status: 'ok',
      version: '0.1.0-beta',
      network: ctx.config.solanaNetwork,
      uptime: Math.floor((Date.now() - ctx.startTime) / 1000),
      replayGuardSize: ctx.replayGuard.size(),
    };

    if (ctx.activeModules && ctx.activeModules.length > 0) {
      response.governance = ctx.activeModules;
    }

    if (ctx.gasManager) {
      try {
        const gasStatus = await ctx.gasManager.checkBalance();
        response.gasStatus = {
          isHealthy: gasStatus.isHealthy,
          balanceSol: gasStatus.balanceSol,
          estimatedSettlementsRemaining: gasStatus.estimatedSettlementsRemaining,
        };
      } catch {
        response.gasStatus = { isHealthy: true, error: 'RPC unavailable' };
      }
    }

    return c.json(response);
  });

  return app;
}
