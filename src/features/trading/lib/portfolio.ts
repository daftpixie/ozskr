/**
 * Portfolio Aggregator
 * Fetches wallet balances and USD values for all known tokens
 * Uses Jupiter Price API v2 for USD pricing
 */

import { z } from 'zod';
import { address } from '@solana/kit';
import { getSolBalance, getTokenBalance } from '@/lib/solana/tokens';
import { getAllTokens } from '@/lib/solana/token-list';
import type { TokenInfo } from '@/lib/solana/token-list';

// =============================================================================
// TYPES
// =============================================================================

export interface PortfolioToken {
  token: TokenInfo;
  balance: bigint;
  formattedBalance: string;
  usdValue: number | null;
}

export interface Portfolio {
  tokens: PortfolioToken[];
  totalUsdValue: number | null;
  lastUpdated: string;
  isStale: boolean;
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

/**
 * Jupiter Price API v2 response schema
 */
const JupiterPriceResponseSchema = z.object({
  data: z.record(
    z.string(),
    z.object({
      id: z.string(),
      type: z.string().optional(),
      price: z.string(), // decimal string
    })
  ).optional(),
});

// =============================================================================
// CONSTANTS
// =============================================================================

const JUPITER_PRICE_API_URL = 'https://api.jup.ag/price/v2';

// =============================================================================
// ERROR HANDLING
// =============================================================================

export class PortfolioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortfolioError';
  }
}

// =============================================================================
// PORTFOLIO FETCHER
// =============================================================================

/**
 * Fetch portfolio balances and USD values for a wallet
 * @param walletAddress Wallet address to query
 * @param rpcEndpoint Solana RPC endpoint URL
 * @returns Portfolio with balances and USD values
 * @throws {PortfolioError} If portfolio fetch fails
 */
export async function fetchPortfolio(
  walletAddress: string,
  rpcEndpoint: string
): Promise<Portfolio> {
  // Validate wallet address
  try {
    address(walletAddress);
  } catch (err) {
    throw new PortfolioError(
      `Invalid wallet address: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }

  // Get all known tokens
  const allTokens = getAllTokens();

  // Fetch balances for all tokens
  const balancePromises = allTokens.map(async (token) => {
    try {
      if (token.symbol === 'SOL') {
        // Fetch SOL balance
        const balance = await getSolBalance(rpcEndpoint, walletAddress);
        return {
          token,
          balance,
        };
      } else {
        // Fetch SPL token balance
        const tokenBalance = await getTokenBalance(rpcEndpoint, walletAddress, token.mint);
        return {
          token,
          balance: tokenBalance.balance,
        };
      }
    } catch {
      // If balance fetch fails for a token, return 0 balance
      return {
        token,
        balance: 0n,
      };
    }
  });

  const balances = await Promise.all(balancePromises);

  // Filter out zero balances
  const nonZeroBalances = balances.filter((b) => b.balance > 0n);

  // Get USD prices for non-zero balances
  const prices = await fetchPrices(nonZeroBalances.map((b) => b.token.mint));

  // Build portfolio tokens
  const portfolioTokens: PortfolioToken[] = nonZeroBalances.map((b) => {
    const price = prices.get(b.token.mint);
    const formattedBalance = formatTokenAmount(b.balance, b.token.decimals);

    let usdValue: number | null = null;
    if (price !== null && price !== undefined) {
      // Safe: USD values are display-only approximations, never used in transactions.
      // Float math is acceptable here — precision loss on USD display is negligible.
      const balanceDecimal = Number(formattedBalance);
      usdValue = balanceDecimal * price;
    }

    return {
      token: b.token,
      balance: b.balance,
      formattedBalance,
      usdValue,
    };
  });

  // Sort by USD value descending (null values at end)
  portfolioTokens.sort((a, b) => {
    if (a.usdValue === null && b.usdValue === null) return 0;
    if (a.usdValue === null) return 1;
    if (b.usdValue === null) return -1;
    return b.usdValue - a.usdValue;
  });

  // Calculate total USD value
  let totalUsdValue: number | null = null;
  const hasAllPrices = portfolioTokens.every((t) => t.usdValue !== null);
  if (hasAllPrices && portfolioTokens.length > 0) {
    totalUsdValue = portfolioTokens.reduce((sum, t) => sum + (t.usdValue || 0), 0);
  }

  return {
    tokens: portfolioTokens,
    totalUsdValue,
    lastUpdated: new Date().toISOString(),
    isStale: false,
  };
}

/**
 * Cache portfolio to token_balances_cache via API
 * TODO: Implement when trading API endpoints are ready
 */
export async function cachePortfolio(
  _walletAddress: string,
  _portfolio: Portfolio,
  _jwtToken: string
): Promise<void> {
  // No-op stub — will be implemented when API is ready
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Fetch USD prices from Jupiter Price API v2
 * @param mints Array of token mint addresses
 * @returns Map of mint -> USD price
 */
async function fetchPrices(mints: string[]): Promise<Map<string, number>> {
  if (mints.length === 0) {
    return new Map();
  }

  try {
    // Build query string with all mint addresses
    const ids = mints.join(',');
    const url = `${JUPITER_PRICE_API_URL}?ids=${ids}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // If price fetch fails, return empty map
      return new Map();
    }

    const responseBody = await response.json();
    const parseResult = JupiterPriceResponseSchema.safeParse(responseBody);

    if (!parseResult.success) {
      // Invalid response format
      return new Map();
    }

    const data = parseResult.data.data;
    if (!data) {
      return new Map();
    }

    // Build price map
    const priceMap = new Map<string, number>();
    for (const [mint, priceData] of Object.entries(data)) {
      // Safe: USD prices are display-only, never used in on-chain calculations
      const price = parseFloat(priceData.price);
      if (!isNaN(price)) {
        priceMap.set(mint, price);
      }
    }

    return priceMap;
  } catch {
    // Network error or other failure
    return new Map();
  }
}

/**
 * Format token amount to human-readable string
 * NO floating point math for the conversion — uses string manipulation
 * @param amount Token amount as bigint (raw units)
 * @param decimals Number of decimals for the token
 * @returns Formatted amount (e.g., "1.5")
 */
function formatTokenAmount(amount: bigint, decimals: number): string {
  if (amount === 0n) {
    return '0';
  }

  const isNegative = amount < 0n;
  const absAmount = isNegative ? -amount : amount;

  // Convert to string and pad with zeros
  const amountStr = absAmount.toString();

  if (amountStr.length <= decimals) {
    // Amount is less than 1 token
    const paddedStr = amountStr.padStart(decimals, '0');
    const result = `0.${paddedStr}`;
    // Remove trailing zeros
    const trimmed = result.replace(/\.?0+$/, '');
    return isNegative ? `-${trimmed}` : trimmed || '0';
  }

  // Amount is 1 token or more
  const integerPart = amountStr.slice(0, -decimals);
  const decimalPart = amountStr.slice(-decimals);

  // Remove trailing zeros from decimal part
  const trimmedDecimalPart = decimalPart.replace(/0+$/, '');

  if (trimmedDecimalPart === '') {
    return isNegative ? `-${integerPart}` : integerPart;
  }

  const result = `${integerPart}.${trimmedDecimalPart}`;
  return isNegative ? `-${result}` : result;
}
