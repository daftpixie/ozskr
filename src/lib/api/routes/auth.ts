/**
 * Authentication Routes
 * Handles SIWS (Sign-In With Solana) verification, session management
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { SignJWT } from 'jose';
import { SiwsVerifyRequestSchema, SessionResponseSchema, ApiSuccessSchema } from '@/types/schemas';
import { createSupabaseServerClient } from '../supabase';
import { authMiddleware } from '../middleware/auth';
import { address } from '@solana/kit';
import { verifySiwsSignature } from '@/lib/solana/siws';
import type { Context } from 'hono';

/**
 * Create a Supabase client with service role for auth operations.
 * Auth verify must bypass RLS since users don't have a JWT yet.
 */
function getServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  return createSupabaseServerClient(serviceRoleKey);
}

const auth = new Hono();

/**
 * POST /api/auth/verify
 * Verify SIWS signature and create session
 */
auth.post('/verify', zValidator('json', SiwsVerifyRequestSchema), async (c) => {
  const { message, signature, publicKey } = c.req.valid('json');

  try {
    // STEP 1: Validate wallet address format
    const walletAddress = address(publicKey);

    // STEP 2: Verify SIWS signature
    // Uses nacl to verify ed25519 signature and validates timestamp
    const isValid = await verifySiwsSignature({
      message,
      signature,
      publicKey,
    });

    if (!isValid) {
      return c.json(
        {
          error: 'Invalid SIWS message or signature',
          code: 'INVALID_SIGNATURE',
        },
        400
      );
    }

    // TODO: In production, verify nonce hasn't been used before
    // - Extract nonce from message
    // - Check against sessions table or dedicated nonces table
    // - Store nonce with expiration timestamp
    // This prevents replay attacks

    // STEP 3: Upsert user in Supabase (service role bypasses RLS for first-time signup)
    const supabase = getServiceClient();
    const { data: user, error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          wallet_address: walletAddress,
        },
        {
          onConflict: 'wallet_address',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (upsertError || !user) {
      return c.json(
        {
          error: 'Failed to create or update user',
          code: 'DATABASE_ERROR',
        },
        500
      );
    }

    // STEP 4: Generate JWT token
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

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day session

    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({ wallet_address: walletAddress })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret);

    // STEP 5: Store session in database
    const { error: sessionError } = await supabase.from('sessions').insert({
      wallet_address: walletAddress,
      jwt_token: token,
      expires_at: expiresAt.toISOString(),
    });

    if (sessionError) {
      return c.json(
        {
          error: 'Failed to create session',
          code: 'DATABASE_ERROR',
        },
        500
      );
    }

    // STEP 6: Return session response
    const response = SessionResponseSchema.parse({
      token,
      expiresAt: expiresAt.toISOString(),
      user: {
        walletAddress: user.wallet_address,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
      },
    });

    return c.json(response, 200);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Authentication failed',
        code: 'INTERNAL_ERROR',
      },
      500
    );
  }
});

/**
 * POST /api/auth/logout
 * Invalidate current session
 */
auth.post('/logout', authMiddleware, async (c: Context) => {
  const walletAddress = c.get('walletAddress') as string;
  const jwtToken = c.get('jwtToken') as string;

  try {
    const supabase = getServiceClient();

    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('wallet_address', walletAddress)
      .eq('jwt_token', jwtToken);

    if (error) {
      return c.json(
        {
          error: 'Failed to delete session',
          code: 'DATABASE_ERROR',
        },
        500
      );
    }

    const response = ApiSuccessSchema.parse({
      success: true,
      message: 'Successfully logged out',
    });

    return c.json(response, 200);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Logout failed',
        code: 'INTERNAL_ERROR',
      },
      500
    );
  }
});

/**
 * GET /api/auth/session
 * Validate current session and return user data
 */
auth.get('/session', authMiddleware, async (c: Context) => {
  const walletAddress = c.get('walletAddress') as string;
  const jwtToken = c.get('jwtToken') as string;

  try {
    const supabase = getServiceClient();

    // Verify session exists and hasn't expired
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('jwt_token', jwtToken)
      .single();

    if (sessionError || !session) {
      return c.json(
        {
          error: 'Session not found',
          code: 'UNAUTHORIZED',
        },
        401
      );
    }

    // Check if session has expired
    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    if (now > expiresAt) {
      // Clean up expired session
      await supabase.from('sessions').delete().eq('id', session.id);

      return c.json(
        {
          error: 'Session has expired',
          code: 'TOKEN_EXPIRED',
        },
        401
      );
    }

    // Fetch user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();

    if (userError || !user) {
      return c.json(
        {
          error: 'User not found',
          code: 'NOT_FOUND',
        },
        404
      );
    }

    const response = SessionResponseSchema.parse({
      token: jwtToken,
      expiresAt: session.expires_at,
      user: {
        walletAddress: user.wallet_address,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
      },
    });

    return c.json(response, 200);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Session validation failed',
        code: 'INTERNAL_ERROR',
      },
      500
    );
  }
});

export { auth };
