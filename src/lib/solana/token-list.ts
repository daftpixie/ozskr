/**
 * Token List Utility
 * Curated list of common Solana tokens with metadata
 * Uses mainnet mint addresses
 */

import { address } from '@solana/kit';

// =============================================================================
// TYPES
// =============================================================================

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
}

// =============================================================================
// CURATED TOKEN LIST
// =============================================================================

/**
 * Curated list of popular Solana tokens
 * All mainnet mint addresses
 */
const TOKEN_LIST: TokenInfo[] = [
  {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
  {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
  },
  {
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'BONK',
    name: 'Bonk',
    decimals: 5,
    logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
  },
  {
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    symbol: 'JUP',
    name: 'Jupiter',
    decimals: 6,
    logoURI: 'https://static.jup.ag/jup/icon.png',
  },
  {
    mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    symbol: 'RAY',
    name: 'Raydium',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
  },
  {
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    symbol: 'WIF',
    name: 'dogwifhat',
    decimals: 6,
    logoURI: 'https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betidfwy3ajsav2vjzyum.ipfs.nftstorage.link',
  },
  {
    mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
    symbol: 'PYTH',
    name: 'Pyth Network',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3/logo.png',
  },
  {
    mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
    symbol: 'JTO',
    name: 'Jito',
    decimals: 9,
    logoURI: 'https://metadata.jito.network/token/jto/image',
  },
  {
    mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
    symbol: 'ORCA',
    name: 'Orca',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png',
  },
];

// =============================================================================
// INDEXES
// =============================================================================

const TOKEN_BY_MINT = new Map<string, TokenInfo>();
const TOKEN_BY_SYMBOL = new Map<string, TokenInfo>();

// Build indexes on module load
for (const token of TOKEN_LIST) {
  TOKEN_BY_MINT.set(token.mint, token);
  TOKEN_BY_SYMBOL.set(token.symbol.toUpperCase(), token);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get token info by mint address
 * @param mint Token mint address
 * @returns Token info or undefined if not found
 */
export function getTokenByMint(mint: string): TokenInfo | undefined {
  // Validate address first
  try {
    address(mint);
  } catch {
    return undefined;
  }
  return TOKEN_BY_MINT.get(mint);
}

/**
 * Get token info by symbol (case-insensitive)
 * @param symbol Token symbol (e.g., "SOL", "USDC")
 * @returns Token info or undefined if not found
 */
export function getTokenBySymbol(symbol: string): TokenInfo | undefined {
  return TOKEN_BY_SYMBOL.get(symbol.toUpperCase());
}

/**
 * Search tokens by query string (fuzzy match on symbol or name)
 * @param query Search query
 * @returns Array of matching tokens
 */
export function searchTokens(query: string): TokenInfo[] {
  if (!query || query.trim() === '') {
    return TOKEN_LIST;
  }

  const normalizedQuery = query.toLowerCase().trim();

  return TOKEN_LIST.filter((token) => {
    const symbolMatch = token.symbol.toLowerCase().includes(normalizedQuery);
    const nameMatch = token.name.toLowerCase().includes(normalizedQuery);
    return symbolMatch || nameMatch;
  });
}

/**
 * Check if a mint address is in the known token list
 * @param mint Token mint address
 * @returns True if token is in the curated list
 */
export function isKnownToken(mint: string): boolean {
  try {
    address(mint);
  } catch {
    return false;
  }
  return TOKEN_BY_MINT.has(mint);
}

/**
 * Get all tokens in the curated list
 * @returns Array of all tokens
 */
export function getAllTokens(): TokenInfo[] {
  return [...TOKEN_LIST];
}
