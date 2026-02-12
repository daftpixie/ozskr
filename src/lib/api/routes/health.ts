/**
 * Health Check Routes
 * Simple status endpoint for monitoring
 */

import { Hono } from 'hono';
import type { Context } from 'hono';

const health = new Hono();

/**
 * GET /api/health
 * Health check endpoint
 */
health.get('/', (c: Context) => {
  return c.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'ozskr.ai API',
      version: '0.1.0',
    },
    200
  );
});

export { health };
