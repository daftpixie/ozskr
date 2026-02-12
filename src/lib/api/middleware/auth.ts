/**
 * JWT Authentication Middleware for Hono
 * Verifies JWT tokens and attaches wallet address to context
 */

import { createMiddleware } from 'hono/factory';
import { jwtVerify } from 'jose';
import type { Context } from 'hono';

/**
 * JWT authentication middleware
 * Extracts and verifies Bearer token from Authorization header
 * Attaches wallet_address to Hono context
 */
export const authMiddleware = createMiddleware(async (c: Context, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      {
        error: 'Missing or invalid Authorization header',
        code: 'UNAUTHORIZED',
      },
      401
    );
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return c.json(
      {
        error: 'JWT configuration error',
        code: 'INTERNAL_ERROR',
      },
      500
    );
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);

    const walletAddress = payload.wallet_address as string;

    if (!walletAddress) {
      return c.json(
        {
          error: 'Invalid token payload: missing wallet_address',
          code: 'UNAUTHORIZED',
        },
        401
      );
    }

    // Attach wallet address to context
    c.set('walletAddress', walletAddress);
    c.set('jwtToken', token);

    await next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        return c.json(
          {
            error: 'Token has expired',
            code: 'TOKEN_EXPIRED',
          },
          401
        );
      }
    }

    return c.json(
      {
        error: 'Invalid or malformed token',
        code: 'UNAUTHORIZED',
      },
      401
    );
  }
});

/**
 * Optional auth middleware
 * Attaches wallet address if token is present, but doesn't fail if missing
 */
export const optionalAuthMiddleware = createMiddleware(async (c: Context, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await next();
    return;
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    await next();
    return;
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);

    const walletAddress = payload.wallet_address as string;
    if (walletAddress) {
      c.set('walletAddress', walletAddress);
      c.set('jwtToken', token);
    }
  } catch {
    // Silently fail for optional auth
  }

  await next();
});
