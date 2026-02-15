/**
 * Hono API Application
 * Main app composition with all service route groups
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from '@/lib/utils/logger';
import { AppError } from '@/lib/utils/errors';
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
import { twitterOAuth } from './routes/twitter-oauth';
import { gamification } from './routes/gamification';
import { waitlist } from './routes/waitlist';
import { feedback } from './routes/feedback';
import { adminMetrics } from './routes/admin-metrics';
import { adminWhitelist } from './routes/admin-whitelist';
import { adminIssues } from './routes/admin-issues';
import { adminReport } from './routes/admin-report';
import { delegation } from './routes/delegation';

// App context variables type
type AppVariables = {
  requestId: string;
  walletAddress?: string;
  jwtToken?: string;
};

// Create main Hono app with /api base path (Next.js catch-all is at /api/[[...route]])
const app = new Hono<{ Variables: AppVariables }>().basePath('/api');

// Security headers middleware
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-API-Version', '1.0.0');
  // HSTS only in production
  if (process.env.NODE_ENV === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

// Request logging middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);

  await next();

  const duration = Date.now() - start;
  logger.info('Request completed', {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: duration,
    requestId,
  });
});

// CORS middleware
// SECURITY: Restricted to a single origin matching the platform URL.
// In production, NEXT_PUBLIC_APP_URL must be set to the exact deployed domain
// (e.g., "https://ozskr.vercel.app"). The localhost fallback is for local
// development only. Wildcard origins are never used.
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
app.route('/social/twitter', twitterOAuth);
app.route('/gamification', gamification);
app.route('/waitlist', waitlist);
app.route('/feedback', feedback);
app.route('/admin', adminMetrics);
app.route('/admin-whitelist', adminWhitelist);
app.route('/admin-issues', adminIssues);
app.route('/admin-report', adminReport);
app.route('/delegation', delegation);

// Global error handler with AppError support
app.onError((err, c) => {
  if (err instanceof AppError) {
    logger.warn('Application error', {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      requestId: c.get('requestId'),
    });
    return c.json(
      {
        error: err.message,
        code: err.code,
        ...(err.details && { details: err.details }),
      },
      err.statusCode as 400 | 401 | 403 | 404 | 429 | 500 | 502
    );
  }

  // Log full error for unexpected errors (never expose to client)
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId: c.get('requestId'),
  });

  // Return safe generic response — no stack traces!
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
