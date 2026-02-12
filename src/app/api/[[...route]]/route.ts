/**
 * Next.js API Route Handler
 * Catch-all route that forwards to Hono app
 */

import { app } from '@/lib/api/app';
import { handle } from 'hono/vercel';

// Export HTTP method handlers for Next.js
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);
