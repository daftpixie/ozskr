/**
 * Waitlist Routes
 * Public endpoints for pre-launch email/wallet signups
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createSupabaseClient } from '../supabase';
import { logger } from '@/lib/utils/logger';

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
 * POST / — Add to waitlist
 */
waitlist.post('/', zValidator('json', WaitlistSignupSchema), async (c) => {
  const { email, walletAddress } = c.req.valid('json');

  try {
    const supabase = createSupabaseClient();

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
 * GET /count — Return current waitlist size
 */
waitlist.get('/count', async (c) => {
  try {
    const supabase = createSupabaseClient();

    const { data, error } = await supabase.rpc('get_waitlist_count');

    if (error) {
      logger.error('Waitlist count error', { error: error.message });
      return c.json({ count: 0 }, 200);
    }

    return c.json({ count: data ?? 0 }, 200);
  } catch (err) {
    logger.error('Waitlist count error', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return c.json({ count: 0 }, 200);
  }
});

export { waitlist };
