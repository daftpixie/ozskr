/**
 * $HOPE Balance Checker with Caching
 * Queries token balance via Helius DAS API with Redis-backed 5-minute cache.
 * Falls back to Supabase whitelist if Helius is unreachable.
 *
 * Used by the access tier system for token-gated platform access.
 */

import { address, assertIsAddress } from '@solana/kit';
import { getNetworkConfig } from './network-config';
import { logger } from '@/lib/utils/logger';

/** Cache TTL: 5 minutes */
const BALANCE_CACHE_TTL_SECONDS = 300;

/** Cache key prefix */
const CACHE_KEY_PREFIX = 'hope-balance:';

/**
 * Get Redis client for balance caching.
 * Returns null if Redis is not configured (graceful degradation).
 */
async function getRedis(): Promise<{
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, opts: { ex: number }) => Promise<unknown>;
} | null> {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;

    const { Redis } = await import('@upstash/redis');
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

/**
 * Fetch $HOPE token balance for a wallet via Helius DAS API.
 *
 * Uses `getTokenAccounts` to find the associated token account for the
 * $HOPE mint, then reads the balance. Caches the result in Redis for 5 minutes.
 *
 * @param walletAddress - Solana wallet address (base58)
 * @returns $HOPE balance as a human-readable number (e.g., 10000 = 10,000 $HOPE)
 */
export async function getCachedHopeBalance(walletAddress: string): Promise<number> {
  // Validate address
  try {
    assertIsAddress(walletAddress);
  } catch {
    throw new Error(`Invalid wallet address: ${walletAddress}`);
  }

  // Check cache first
  const cacheKey = `${CACHE_KEY_PREFIX}${walletAddress}`;
  const redis = await getRedis();

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached !== null) {
        logger.info('$HOPE balance cache hit', { walletAddress: walletAddress.slice(0, 8) });
        return Number(cached);
      }
    } catch {
      // Cache miss or error — continue to fetch
    }
  }

  // Fetch from Helius DAS API
  const balance = await fetchHopeBalanceFromHelius(walletAddress);

  // Cache the result
  if (redis) {
    try {
      await redis.set(cacheKey, String(balance), { ex: BALANCE_CACHE_TTL_SECONDS });
    } catch {
      // Cache write failure is non-fatal
    }
  }

  return balance;
}

/**
 * Fetch $HOPE balance from Helius DAS API.
 * Returns 0 if the wallet has no $HOPE token account.
 */
async function fetchHopeBalanceFromHelius(walletAddress: string): Promise<number> {
  const heliusApiKey = process.env.HELIUS_API_KEY;
  if (!heliusApiKey) {
    logger.warn('HELIUS_API_KEY not configured, returning 0 balance');
    return 0;
  }

  const networkConfig = getNetworkConfig();
  const hopeMint = networkConfig.hopeMint;

  // Use Helius enhanced RPC
  const cluster = networkConfig.network === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';
  const url = `https://${cluster}.helius-rpc.com/?api-key=${heliusApiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'hope-balance',
        method: 'getTokenAccountsByOwner',
        params: [
          walletAddress,
          { mint: hopeMint },
          { encoding: 'jsonParsed' },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Helius API returned ${response.status}`);
    }

    const data = await response.json() as {
      result?: {
        value?: Array<{
          account?: {
            data?: {
              parsed?: {
                info?: {
                  tokenAmount?: {
                    uiAmount?: number;
                  };
                };
              };
            };
          };
        }>;
      };
      error?: { message: string };
    };

    if (data.error) {
      throw new Error(`Helius RPC error: ${data.error.message}`);
    }

    const accounts = data.result?.value ?? [];
    if (accounts.length === 0) {
      return 0; // No token account = 0 balance
    }

    const uiAmount = accounts[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
    return uiAmount;
  } catch (error) {
    logger.error('Failed to fetch $HOPE balance from Helius', {
      walletAddress: walletAddress.slice(0, 8),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Check whitelist as fallback when Helius is unreachable.
 * Returns the whitelisted tier's equivalent balance, or 0 if not whitelisted.
 */
export async function checkWhitelistFallback(
  walletAddress: string,
  supabaseServiceClient: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: { access_tier: string } | null; error: unknown }>;
        };
      };
    };
  }
): Promise<number | null> {
  try {
    const { data, error } = await supabaseServiceClient
      .from('alpha_whitelist')
      .select('access_tier')
      .eq('wallet_address', walletAddress)
      .maybeSingle();

    if (error || !data) return null;

    // Return a balance that maps to the whitelisted tier
    switch (data.access_tier) {
      case 'ALPHA': return 10_000;
      case 'BETA': return 5_000;
      case 'EARLY_ACCESS': return 1_000;
      default: return null;
    }
  } catch {
    return null;
  }
}
