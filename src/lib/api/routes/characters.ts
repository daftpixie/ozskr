/**
 * Character Routes (DEPRECATED - redirects to /api/ai/characters)
 * Use /api/ai/characters for all character operations
 *
 * This file is kept for backward compatibility but will be removed in a future version.
 */

import { Hono } from 'hono';

const characters = new Hono();

/**
 * All character routes redirect to /api/ai/characters
 */
characters.all('*', async (c) => {
  return c.json(
    {
      error: 'Endpoint moved',
      code: 'MOVED_PERMANENTLY',
      message: 'Character endpoints have moved to /api/ai/characters',
      newEndpoint: c.req.path.replace('/api/characters', '/api/ai/characters'),
    },
    301
  );
});

export { characters };
