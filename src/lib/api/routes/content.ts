/**
 * Content Routes
 * Content CRUD, moderation status, and R2 URL management
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ContentCreateSchema } from '@/types/schemas';
import { authMiddleware } from '../middleware/auth';
import type { Context } from 'hono';

const content = new Hono();

// All content routes require authentication
content.use('/*', authMiddleware);

/**
 * GET /api/content
 * List all content for authenticated user
 */
content.get('/', async (c: Context) => {
  return c.json(
    {
      message: 'Not implemented',
      status: 501,
      endpoint: 'GET /api/content',
    },
    501
  );
});

/**
 * POST /api/content
 * Create new content entry
 */
content.post('/', zValidator('json', ContentCreateSchema), async (c: Context) => {
  return c.json(
    {
      message: 'Not implemented',
      status: 501,
      endpoint: 'POST /api/content',
    },
    501
  );
});

/**
 * GET /api/content/:id
 * Get content by ID
 */
content.get('/:id', async (c: Context) => {
  return c.json(
    {
      message: 'Not implemented',
      status: 501,
      endpoint: 'GET /api/content/:id',
    },
    501
  );
});

/**
 * GET /api/content/characters/:characterId
 * List all content for a specific character
 */
content.get('/characters/:characterId', async (c: Context) => {
  return c.json(
    {
      message: 'Not implemented',
      status: 501,
      endpoint: 'GET /api/content/characters/:characterId',
    },
    501
  );
});

export { content };
