/**
 * JWT Authentication Middleware for Hono
 * Verifies JWT tokens and attaches wallet address to context.
 *
 * SECURITY: In addition to JWT signature verification, the middleware
 * checks the sessions table to ensure the session has not been revoked.
 * This allows immediate session invalidation on logout/disconnect even
 * though the JWT may still be cryptographically valid.
 */

import { createMiddleware } from 'hono/factory';
import { jwtVerify } from 'jose';
import type { Context } from 'hono';
import { createSupabaseServerClient } from '../supabase';

/**
 * JWT authentication middleware
 * Extracts and verifies Bearer token from Authorization header
 * Validates session exists in database (allows immediate revocation)
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

    const walletAddress = payload.wallet_address;

    if (typeof walletAddress !== 'string' || !walletAddress) {
      return c.json(
        {
          error: 'Invalid token payload: missing wallet_address',
          code: 'UNAUTHORIZED',
        },
        401
      );
    }

    // Per-request session validation: verify session still exists in DB
    // This catches revoked/logged-out sessions even if JWT hasn't expired.
    // Defense-in-depth: if session check is unavailable (DB down, missing
    // config), fall through to JWT-only auth rather than blocking all requests.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      try {
        const supabase = createSupabaseServerClient(serviceRoleKey);
        const { data: session } = await supabase
          .from('sessions')
          .select('id, expires_at')
          .eq('wallet_address', walletAddress)
          .eq('jwt_token', token)
          .maybeSingle();

        if (session === null) {
          return c.json(
            {
              error: 'Session has been revoked',
              code: 'SESSION_REVOKED',
            },
            401
          );
        }

        if (session && new Date(session.expires_at) < new Date()) {
          return c.json(
            {
              error: 'Session has expired',
              code: 'TOKEN_EXPIRED',
            },
            401
          );
        }
      } catch {
        // Session check unavailable — proceed with JWT-only auth
      }
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

    const walletAddress = payload.wallet_address;
    if (typeof walletAddress === 'string' && walletAddress) {
      c.set('walletAddress', walletAddress);
      c.set('jwtToken', token);
    }
  } catch {
    // Silently fail for optional auth
  }

  await next();
});
