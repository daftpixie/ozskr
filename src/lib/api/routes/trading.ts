/**
 * Trading Routes
 * SOL/$HOPE payments, transaction history
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import type { Context } from 'hono';

const trading = new Hono();

// All trading routes require authentication
trading.use('/*', authMiddleware);

/**
 * GET /api/trading/transactions
 * List all transactions for authenticated user
 */
trading.get('/transactions', async (c: Context) => {
  return c.json(
    {
      message: 'Not implemented',
      status: 501,
      endpoint: 'GET /api/trading/transactions',
    },
    501
  );
});

/**
 * GET /api/trading/balance
 * Get SOL and $HOPE balance for wallet
 */
trading.get('/balance', async (c: Context) => {
  return c.json(
    {
      message: 'Not implemented',
      status: 501,
      endpoint: 'GET /api/trading/balance',
    },
    501
  );
});

/**
 * POST /api/trading/swap/quote
 * Get swap quote from Jupiter
 */
trading.post('/swap/quote', async (c: Context) => {
  return c.json(
    {
      message: 'Not implemented',
      status: 501,
      endpoint: 'POST /api/trading/swap/quote',
    },
    501
  );
});

export { trading };
