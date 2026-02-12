/**
 * Agent Routes
 * Agent run management and execution
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AgentRunCreateSchema } from '@/types/schemas';
import { authMiddleware } from '../middleware/auth';
import type { Context } from 'hono';

const agents = new Hono();

// All agent routes require authentication
agents.use('/*', authMiddleware);

/**
 * GET /api/agents/runs
 * List all agent runs for authenticated user
 */
agents.get('/runs', async (c: Context) => {
  return c.json(
    {
      message: 'Not implemented',
      status: 501,
      endpoint: 'GET /api/agents/runs',
    },
    501
  );
});

/**
 * POST /api/agents/runs
 * Create and trigger a new agent run
 */
agents.post('/runs', zValidator('json', AgentRunCreateSchema), async (c: Context) => {
  return c.json(
    {
      message: 'Not implemented',
      status: 501,
      endpoint: 'POST /api/agents/runs',
    },
    501
  );
});

/**
 * GET /api/agents/runs/:id
 * Get agent run details by ID
 */
agents.get('/runs/:id', async (c: Context) => {
  return c.json(
    {
      message: 'Not implemented',
      status: 501,
      endpoint: 'GET /api/agents/runs/:id',
    },
    501
  );
});

/**
 * GET /api/agents/characters/:characterId/runs
 * List all runs for a specific character
 */
agents.get('/characters/:characterId/runs', async (c: Context) => {
  return c.json(
    {
      message: 'Not implemented',
      status: 501,
      endpoint: 'GET /api/agents/characters/:characterId/runs',
    },
    501
  );
});

export { agents };
