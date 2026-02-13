/**
 * Admin Whitelist Routes
 * Manage alpha whitelist entries for manual tier overrides.
 * All routes require admin authentication.
 * Non-admin wallets receive 404 (hides route existence).
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseServerClient } from '../supabase';
import { AccessTierSchema } from '@/lib/auth/access-tier';
import { logger } from '@/lib/utils/logger';

function getAdminWallets(): string[] {
  return (process.env.ADMIN_WALLETS ?? '').split(',').filter(Boolean);
}

/** Admin gate — returns 404 for non-admin wallets to hide route existence */
async function requireAdmin(c: Context, next: () => Promise<void>): Promise<Response | void> {
  const walletAddress = (c as unknown as { get: (key: string) => unknown }).get('walletAddress') as string;
  if (!walletAddress || !getAdminWallets().includes(walletAddress)) {
    return c.json({ error: 'Route not found', code: 'NOT_FOUND' }, 404);
  }
  await next();
}

function getServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Service role key not configured');
  }
  return createSupabaseServerClient(serviceRoleKey);
}

const AddWhitelistSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  accessTier: AccessTierSchema.exclude(['WAITLIST']),
  notes: z.string().max(500).optional(),
});

const adminWhitelist = new Hono();

// All whitelist routes require auth + admin check
adminWhitelist.use('*', authMiddleware);
adminWhitelist.use('*', requireAdmin);

/**
 * GET /whitelist — List all whitelisted wallets
 */
adminWhitelist.get('/', async (c: Context) => {
  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('alpha_whitelist')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Whitelist list error', { error: error.message });
      return c.json({ error: 'Failed to fetch whitelist', code: 'DATABASE_ERROR' }, 500);
    }

    return c.json({ entries: data ?? [], total: (data ?? []).length });
  } catch (err) {
    logger.error('Whitelist list error', { error: err instanceof Error ? err.message : 'Unknown' });
    return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
  }
});

/**
 * GET /whitelist/:wallet — Check if a specific wallet is whitelisted
 */
adminWhitelist.get('/:wallet', async (c: Context) => {
  try {
    const wallet = c.req.param('wallet');
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('alpha_whitelist')
      .select('*')
      .eq('wallet_address', wallet)
      .maybeSingle();

    if (error) {
      logger.error('Whitelist lookup error', { error: error.message });
      return c.json({ error: 'Failed to check whitelist', code: 'DATABASE_ERROR' }, 500);
    }

    if (!data) {
      return c.json({ whitelisted: false, wallet });
    }

    return c.json({
      whitelisted: true,
      wallet: data.wallet_address,
      accessTier: data.access_tier,
      notes: data.notes,
      addedBy: data.added_by,
      createdAt: data.created_at,
    });
  } catch (err) {
    logger.error('Whitelist lookup error', { error: err instanceof Error ? err.message : 'Unknown' });
    return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
  }
});

/**
 * POST /whitelist — Add a wallet to the whitelist
 */
adminWhitelist.post('/', zValidator('json', AddWhitelistSchema), async (c) => {
  const adminWallet = (c as unknown as { get: (key: string) => unknown }).get('walletAddress') as string;
  const { walletAddress, accessTier, notes } = c.req.valid('json');

  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('alpha_whitelist')
      .upsert(
        {
          wallet_address: walletAddress,
          access_tier: accessTier,
          notes: notes || null,
          added_by: adminWallet,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'wallet_address' }
      )
      .select()
      .single();

    if (error) {
      logger.error('Whitelist add error', { error: error.message });
      return c.json({ error: 'Failed to add to whitelist', code: 'DATABASE_ERROR' }, 500);
    }

    logger.info('Wallet added to whitelist', {
      wallet: walletAddress.slice(0, 8),
      tier: accessTier,
      addedBy: adminWallet.slice(0, 8),
    });

    return c.json({
      message: 'Wallet added to whitelist',
      entry: {
        wallet: data.wallet_address,
        accessTier: data.access_tier,
        notes: data.notes,
        addedBy: data.added_by,
      },
    }, 201);
  } catch (err) {
    logger.error('Whitelist add error', { error: err instanceof Error ? err.message : 'Unknown' });
    return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
  }
});

/**
 * DELETE /whitelist/:wallet — Remove a wallet from the whitelist
 */
adminWhitelist.delete('/:wallet', async (c: Context) => {
  try {
    const wallet = c.req.param('wallet');
    const supabase = getServiceClient();

    const { error } = await supabase
      .from('alpha_whitelist')
      .delete()
      .eq('wallet_address', wallet);

    if (error) {
      logger.error('Whitelist delete error', { error: error.message });
      return c.json({ error: 'Failed to remove from whitelist', code: 'DATABASE_ERROR' }, 500);
    }

    logger.info('Wallet removed from whitelist', { wallet: wallet.slice(0, 8) });

    return c.json({ message: 'Wallet removed from whitelist', wallet });
  } catch (err) {
    logger.error('Whitelist delete error', { error: err instanceof Error ? err.message : 'Unknown' });
    return c.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
  }
});

export { adminWhitelist };
