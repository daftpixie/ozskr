/**
 * Hono API Application
 * Main app composition with all service route groups
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { health } from './routes/health';
import { auth } from './routes/auth';
import { ai } from './routes/ai';
import { characters } from './routes/characters';
import { agents } from './routes/agents';
import { content } from './routes/content';
import { trading } from './routes/trading';
import { analytics } from './routes/analytics';
import { schedules } from './routes/schedules';
import { social } from './routes/social';
import { gamification } from './routes/gamification';

// Create main Hono app with /api base path (Next.js catch-all is at /api/[[...route]])
const app = new Hono().basePath('/api');

// Global middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Mount route groups
app.route('/health', health);
app.route('/auth', auth);
app.route('/ai', ai);
app.route('/ai/schedules', schedules);
app.route('/characters', characters); // Deprecated - redirects to /ai/characters
app.route('/agents', agents);
app.route('/content', content);
app.route('/trading', trading);
app.route('/analytics', analytics);
app.route('/social', social);
app.route('/gamification', gamification);

// Global error handler — returns generic message to clients
app.onError((_err, c) => {
  return c.json(
    {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
    500
  );
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'Route not found',
      code: 'NOT_FOUND',
      path: c.req.path,
    },
    404
  );
});

export { app };
