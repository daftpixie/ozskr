/**
 * Token List Utility
 * Network-aware curated list of Solana tokens with metadata
 */

import { address } from '@solana/kit';
import { getNetworkConfig } from '@/lib/solana/network-config';

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
// CURATED TOKEN LISTS
// =============================================================================

/**
 * Mainnet tokens (HOPE is prepended dynamically with env-driven mint)
 */
const MAINNET_TOKEN_LIST: TokenInfo[] = [
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

/**
 * Devnet tokens (limited set for development)
 */
const DEVNET_TOKEN_LIST: TokenInfo[] = [
  {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
  {
    mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    symbol: 'USDC',
    name: 'USD Coin (Devnet)',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
];

// =============================================================================
// LAZY INDEXES
// =============================================================================

let _cachedNetwork: string | null = null;
let _activeList: TokenInfo[] | null = null;
let _mintIndex: Map<string, TokenInfo> | null = null;
let _symbolIndex: Map<string, TokenInfo> | null = null;

function ensureIndexes(): void {
  const config = getNetworkConfig();
  if (_cachedNetwork === config.network && _activeList) return;

  _cachedNetwork = config.network;

  const hopeToken: TokenInfo = {
    mint: config.hopeMint,
    symbol: 'HOPE',
    name: 'Hope Token',
    decimals: 6,
    logoURI: '',
  };

  const base = config.network === 'mainnet-beta' ? MAINNET_TOKEN_LIST : DEVNET_TOKEN_LIST;
  _activeList = [hopeToken, ...base];

  _mintIndex = new Map();
  _symbolIndex = new Map();
  for (const token of _activeList) {
    _mintIndex.set(token.mint, token);
    _symbolIndex.set(token.symbol.toUpperCase(), token);
  }
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
  try {
    address(mint);
  } catch {
    return undefined;
  }
  ensureIndexes();
  return _mintIndex!.get(mint);
}

/**
 * Get token info by symbol (case-insensitive)
 * @param symbol Token symbol (e.g., "SOL", "USDC")
 * @returns Token info or undefined if not found
 */
export function getTokenBySymbol(symbol: string): TokenInfo | undefined {
  ensureIndexes();
  return _symbolIndex!.get(symbol.toUpperCase());
}

/**
 * Search tokens by query string (fuzzy match on symbol or name)
 * @param query Search query
 * @returns Array of matching tokens
 */
export function searchTokens(query: string): TokenInfo[] {
  ensureIndexes();

  if (!query || query.trim() === '') {
    return [..._activeList!];
  }

  const normalizedQuery = query.toLowerCase().trim();

  return _activeList!.filter((token) => {
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
  ensureIndexes();
  return _mintIndex!.has(mint);
}

/**
 * Get all tokens in the curated list
 * @returns Array of all tokens
 */
export function getAllTokens(): TokenInfo[] {
  ensureIndexes();
  return [..._activeList!];
}
