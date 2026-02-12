/**
 * Trading Routes
 * Jupiter Ultra swap integration, watchlist management, and token balance tracking
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  SwapQuoteRequestSchema,
  SwapQuoteResponseSchema,
  SwapExecuteRequestSchema,
  SwapHistoryResponseSchema,
  SwapHistoryQuerySchema,
  WatchlistItemSchema,
  TokenBalancesResponseSchema,
} from '@/types/trading';
import { UuidSchema, paginatedResponse } from '@/types/schemas';
import { authMiddleware } from '../middleware/auth';
import { swapLimiter, readLimiter, quoteLimiter } from '../middleware/rate-limit';
import { createAuthenticatedClient } from '../supabase';
import type { SwapHistory, Watchlist, TokenBalanceCache } from '@/types/database';
import { SwapStatus } from '@/types/database';

/** Hono env with auth middleware variables */
type TradingEnv = {
  Variables: {
    walletAddress: string;
    jwtToken: string;
  };
};

const trading = new Hono<TradingEnv>();

// All trading routes require authentication
trading.use('/*', authMiddleware);

/**
 * Helper to extract auth context from Hono context with type narrowing
 */
function getAuthContext(c: { get: (key: string) => unknown }) {
  const walletAddress = c.get('walletAddress');
  const jwtToken = c.get('jwtToken');
  if (typeof walletAddress !== 'string' || typeof jwtToken !== 'string') {
    return null;
  }
  return { walletAddress, jwtToken };
}

/**
 * Helper to map database SwapHistory to API response
 */
function mapSwapHistoryToResponse(swap: SwapHistory) {
  return {
    id: swap.id,
    walletAddress: swap.wallet_address,
    inputMint: swap.input_mint,
    outputMint: swap.output_mint,
    inputAmount: swap.input_amount,
    outputAmount: swap.output_amount,
    slippageBps: swap.slippage_bps,
    priorityFeeLamports: swap.priority_fee_lamports,
    jupiterOrderId: swap.jupiter_order_id,
    transactionSignature: swap.transaction_signature,
    status: swap.status,
    errorMessage: swap.error_message,
    simulationResult: swap.simulation_result,
    createdAt: swap.created_at,
    confirmedAt: swap.confirmed_at,
  };
}

/**
 * Helper to map database Watchlist to API response
 */
function mapWatchlistToResponse(item: Watchlist) {
  return {
    id: item.id,
    walletAddress: item.wallet_address,
    tokenMint: item.token_mint,
    tokenSymbol: item.token_symbol,
    tokenName: item.token_name,
    addedAt: item.added_at,
  };
}

/**
 * Helper to map database TokenBalanceCache to API response
 */
function mapTokenBalanceToResponse(balance: TokenBalanceCache) {
  return {
    tokenMint: balance.token_mint,
    balance: balance.balance,
    decimals: balance.decimals,
    usdValue: balance.usd_value,
  };
}

// =============================================================================
// TOKEN BALANCE ROUTES
// =============================================================================

/**
 * GET /api/trading/balances
 * Get cached token balances for the authenticated wallet
 */
trading.get('/balances', readLimiter, async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Fetch all cached balances for this wallet
    const { data: balances, error: balancesError } = await supabase
      .from('token_balances_cache')
      .select('*')
      .eq('wallet_address', auth.walletAddress)
      .order('last_updated_at', { ascending: false });

    if (balancesError) {
      return c.json(
        { error: 'Failed to fetch token balances', code: 'DATABASE_ERROR' },
        500
      );
    }

    // Check if cache is stale (>30 seconds old)
    const now = Date.now();
    const staleThresholdMs = 30 * 1000;
    let isStale = false;
    let cacheAge = 0;

    if (balances && balances.length > 0) {
      const oldestUpdate = new Date(balances[0].last_updated_at).getTime();
      cacheAge = Math.floor((now - oldestUpdate) / 1000);
      isStale = now - oldestUpdate > staleThresholdMs;
    }

    // If stale, set a header to indicate client should refresh
    if (isStale) {
      c.header('X-Cache-Status', 'stale');
    }

    const response = TokenBalancesResponseSchema.parse({
      balances: balances?.map(mapTokenBalanceToResponse) || [],
      cacheAge,
      isStale,
    });

    return c.json(response, 200);
  } catch {
    return c.json(
      { error: 'Failed to fetch token balances', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

// =============================================================================
// SWAP QUOTE ROUTES
// =============================================================================

/**
 * GET /api/trading/quote
 * Get a swap quote from Jupiter Ultra API
 */
trading.get(
  '/quote',
  quoteLimiter,
  zValidator('query', SwapQuoteRequestSchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const { inputMint, outputMint, amount, slippageBps } = c.req.valid('query');

    try {
      // Call Jupiter Ultra API
      const jupiterUrl = 'https://lite.jup.ag/ultra/v1/order';
      const response = await fetch(jupiterUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputMint,
          outputMint,
          amount,
          slippageBps,
          taker: auth.walletAddress,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return c.json(
          {
            error: 'Failed to fetch quote from Jupiter',
            code: 'UPSTREAM_ERROR',
            details: errorText,
          },
          500
        );
      }

      const jupiterData = await response.json();

      // Validate and map Jupiter response to our schema
      const quote = SwapQuoteResponseSchema.parse({
        inputMint,
        outputMint,
        inputAmount: amount,
        outputAmount: jupiterData.outputAmount || jupiterData.outAmount || '0',
        priceImpact: jupiterData.priceImpact || jupiterData.priceImpactPct,
        route: jupiterData.route || jupiterData.routePlan?.map((r: { label: string }) => r.label),
        expiresAt: jupiterData.expiresAt || new Date(Date.now() + 30000).toISOString(),
      });

      return c.json(quote, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json(
        {
          error: 'Failed to fetch swap quote',
          code: 'INTERNAL_ERROR',
          details: message,
        },
        500
      );
    }
  }
);

// =============================================================================
// SWAP EXECUTION ROUTES
// =============================================================================

/**
 * POST /api/trading/swap
 * Create a pending swap record (actual execution happens client-side)
 */
trading.post(
  '/swap',
  swapLimiter,
  zValidator('json', SwapExecuteRequestSchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const input = c.req.valid('json');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Create swap_history record with status='pending'
      const { data: swap, error: swapError } = await supabase
        .from('swap_history')
        .insert({
          wallet_address: auth.walletAddress,
          input_mint: input.inputMint,
          output_mint: input.outputMint,
          input_amount: input.inputAmount,
          slippage_bps: input.slippageBps,
          priority_fee_lamports: input.priorityFeeLamports,
          status: SwapStatus.PENDING,
        })
        .select()
        .single();

      if (swapError || !swap) {
        return c.json(
          { error: 'Failed to create swap record', code: 'DATABASE_ERROR' },
          500
        );
      }

      return c.json(
        {
          swapId: swap.id,
          status: 'pending' as const,
          message: 'Swap record created. Execute transaction client-side.',
        },
        202
      );
    } catch {
      return c.json(
        { error: 'Failed to create swap record', code: 'INTERNAL_ERROR' },
        500
      );
    }
  }
);

// =============================================================================
// SWAP HISTORY ROUTES
// =============================================================================

/**
 * GET /api/trading/history
 * Get paginated swap history for authenticated wallet
 */
trading.get(
  '/history',
  readLimiter,
  zValidator('query', SwapHistoryQuerySchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const { page, limit } = c.req.valid('query');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);
      const offset = (page - 1) * limit;

      // Get total count
      const { count, error: countError } = await supabase
        .from('swap_history')
        .select('*', { count: 'exact', head: true })
        .eq('wallet_address', auth.walletAddress);

      if (countError) {
        return c.json(
          { error: 'Failed to count swap history', code: 'DATABASE_ERROR' },
          500
        );
      }

      // Get paginated results
      const { data: swaps, error: selectError } = await supabase
        .from('swap_history')
        .select('*')
        .eq('wallet_address', auth.walletAddress)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (selectError) {
        return c.json(
          { error: 'Failed to fetch swap history', code: 'DATABASE_ERROR' },
          500
        );
      }

      const totalPages = Math.ceil((count || 0) / limit);

      const response = paginatedResponse(SwapHistoryResponseSchema).parse({
        data: swaps?.map(mapSwapHistoryToResponse) || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
        },
      });

      return c.json(response, 200);
    } catch {
      return c.json(
        { error: 'Failed to fetch swap history', code: 'INTERNAL_ERROR' },
        500
      );
    }
  }
);

// =============================================================================
// WATCHLIST ROUTES
// =============================================================================

/**
 * GET /api/trading/watchlist
 * Get user's watchlist
 */
trading.get('/watchlist', readLimiter, async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    const { data: watchlist, error: watchlistError } = await supabase
      .from('watchlist')
      .select('*')
      .eq('wallet_address', auth.walletAddress)
      .order('added_at', { ascending: false });

    if (watchlistError) {
      return c.json(
        { error: 'Failed to fetch watchlist', code: 'DATABASE_ERROR' },
        500
      );
    }

    return c.json(watchlist?.map(mapWatchlistToResponse) || [], 200);
  } catch {
    return c.json(
      { error: 'Failed to fetch watchlist', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

/**
 * POST /api/trading/watchlist
 * Add a token to the watchlist
 */
trading.post(
  '/watchlist',
  readLimiter,
  zValidator('json', WatchlistItemSchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const input = c.req.valid('json');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      const { data: item, error: insertError } = await supabase
        .from('watchlist')
        .insert({
          wallet_address: auth.walletAddress,
          token_mint: input.tokenMint,
          token_symbol: input.tokenSymbol,
          token_name: input.tokenName,
        })
        .select()
        .single();

      if (insertError) {
        // Check for unique constraint violation (duplicate)
        if (insertError.code === '23505') {
          return c.json(
            {
              error: 'Token already in watchlist',
              code: 'CONFLICT',
            },
            409
          );
        }

        return c.json(
          { error: 'Failed to add to watchlist', code: 'DATABASE_ERROR' },
          500
        );
      }

      if (!item) {
        return c.json(
          { error: 'Failed to add to watchlist', code: 'DATABASE_ERROR' },
          500
        );
      }

      return c.json(mapWatchlistToResponse(item), 201);
    } catch {
      return c.json(
        { error: 'Failed to add to watchlist', code: 'INTERNAL_ERROR' },
        500
      );
    }
  }
);

/**
 * DELETE /api/trading/watchlist/:id
 * Remove a token from the watchlist
 */
trading.delete('/watchlist/:id', readLimiter, async (c) => {
  const auth = getAuthContext(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }

  const itemId = c.req.param('id');

  // Validate UUID format
  const validationResult = UuidSchema.safeParse(itemId);
  if (!validationResult.success) {
    return c.json(
      { error: 'Invalid watchlist item ID format', code: 'VALIDATION_ERROR' },
      400
    );
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Verify ownership before deleting
    const { data: item, error: verifyError } = await supabase
      .from('watchlist')
      .select('id')
      .eq('id', itemId)
      .eq('wallet_address', auth.walletAddress)
      .single();

    if (verifyError || !item) {
      return c.json(
        { error: 'Watchlist item not found', code: 'NOT_FOUND' },
        404
      );
    }

    // Delete the item
    const { error: deleteError } = await supabase
      .from('watchlist')
      .delete()
      .eq('id', itemId);

    if (deleteError) {
      return c.json(
        { error: 'Failed to delete watchlist item', code: 'DATABASE_ERROR' },
        500
      );
    }

    return c.body(null, 204);
  } catch {
    return c.json(
      { error: 'Failed to delete watchlist item', code: 'INTERNAL_ERROR' },
      500
    );
  }
});

export { trading };
