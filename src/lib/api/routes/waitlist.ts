/**
 * Waitlist Routes
 * Public endpoints for pre-launch email/wallet signups with 500-spot cap
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createSupabaseClient } from '../supabase';
import { optionalAuthMiddleware } from '../middleware/auth';
import { logger } from '@/lib/utils/logger';

const WAITLIST_CAP = 500;

const WaitlistSignupSchema = z
  .object({
    email: z.string().email().optional(),
    walletAddress: z.string().min(32).max(44).optional(),
  })
  .refine((data) => data.email || data.walletAddress, {
    message: 'Either email or walletAddress is required',
  });

const waitlist = new Hono();

/**
 * POST / — Add to waitlist (enforces 500-spot cap)
 */
waitlist.post('/', zValidator('json', WaitlistSignupSchema), async (c) => {
  const { email, walletAddress } = c.req.valid('json');

  try {
    const supabase = createSupabaseClient();

    // Check remaining spots before inserting
    const { data: remaining, error: countError } = await supabase.rpc('get_waitlist_remaining');

    if (countError) {
      logger.error('Waitlist remaining check error', { error: countError.message });
      return c.json({ error: 'Failed to check waitlist availability' }, 500);
    }

    if (remaining !== null && remaining <= 0) {
      return c.json({ message: 'Waitlist is full', remaining: 0 }, 200);
    }

    const { error } = await supabase.from('waitlist').insert({
      email: email || null,
      wallet_address: walletAddress || null,
    });

    if (error) {
      // Unique constraint violation — already on list
      if (error.code === '23505') {
        return c.json({ message: 'Already on the waitlist' }, 200);
      }
      logger.error('Waitlist insert error', { error: error.message });
      return c.json({ error: 'Failed to join waitlist' }, 500);
    }

    return c.json({ message: 'Added to waitlist' }, 201);
  } catch (err) {
    logger.error('Waitlist error', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /count — Return current waitlist size and remaining spots
 */
waitlist.get('/count', async (c) => {
  try {
    const supabase = createSupabaseClient();

    const [countResult, remainingResult] = await Promise.all([
      supabase.rpc('get_waitlist_count'),
      supabase.rpc('get_waitlist_remaining'),
    ]);

    const total = countResult.data ?? 0;
    const remaining = remainingResult.error ? WAITLIST_CAP : (remainingResult.data ?? WAITLIST_CAP);

    return c.json({ count: total, total: WAITLIST_CAP, remaining }, 200);
  } catch (err) {
    logger.error('Waitlist count error', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return c.json({ count: 0, total: WAITLIST_CAP, remaining: WAITLIST_CAP }, 200);
  }
});

/**
 * GET /status — Check if current wallet is on the waitlist and their position
 */
waitlist.get('/status', optionalAuthMiddleware, async (c: Context) => {
  const walletAddress = c.get('walletAddress') as string | undefined;

  if (!walletAddress) {
    return c.json({ onWaitlist: false, message: 'Wallet not connected' }, 200);
  }

  try {
    const supabase = createSupabaseClient();

    const { data, error } = await supabase
      .from('waitlist')
      .select('id, wallet_address, status, created_at')
      .eq('wallet_address', walletAddress)
      .maybeSingle();

    if (error) {
      logger.error('Waitlist status error', { error: error.message });
      return c.json({ onWaitlist: false }, 200);
    }

    if (!data) {
      return c.json({ onWaitlist: false }, 200);
    }

    return c.json({
      onWaitlist: true,
      status: data.status,
      joinedAt: data.created_at,
    }, 200);
  } catch (err) {
    logger.error('Waitlist status error', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return c.json({ onWaitlist: false }, 200);
  }
});

export { waitlist };
