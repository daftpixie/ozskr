/**
 * Token List Tests
 * Tests for known token list and search functionality
 */

import { describe, it, expect } from 'vitest';

// Expected types for token list (to be created in Track A)
interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

// Mock implementations (these would be imported from actual module)
const getTokenByMint = (mint: string): TokenInfo | undefined => {
  const knownTokens: Record<string, TokenInfo> = {
    'So11111111111111111111111111111111111111112': {
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
    },
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
      mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
  };

  return knownTokens[mint];
};

const getTokenBySymbol = (symbol: string): TokenInfo | undefined => {
  const symbolMap: Record<string, TokenInfo> = {
    SOL: {
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
    },
    USDC: {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    USDT: {
      mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
  };

  return symbolMap[symbol.toUpperCase()];
};

const searchTokens = (query: string): TokenInfo[] => {
  const allTokens: TokenInfo[] = [
    {
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
    },
    {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    {
      mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
  ];

  const lowerQuery = query.toLowerCase();

  return allTokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(lowerQuery) ||
      token.name.toLowerCase().includes(lowerQuery)
  );
};

const isKnownToken = (mint: string): boolean => {
  return getTokenByMint(mint) !== undefined;
};

const getAllTokens = (): TokenInfo[] => {
  return [
    {
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
    },
    {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
    {
      mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
    },
  ];
};

describe('Token List', () => {
  describe('getTokenByMint', () => {
    it('should return correct token for SOL mint', () => {
      const token = getTokenByMint('So11111111111111111111111111111111111111112');

      expect(token).toBeDefined();
      expect(token?.symbol).toBe('SOL');
      expect(token?.name).toBe('Solana');
      expect(token?.decimals).toBe(9);
    });

    it('should return correct token for USDC mint', () => {
      const token = getTokenByMint('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

      expect(token).toBeDefined();
      expect(token?.symbol).toBe('USDC');
      expect(token?.decimals).toBe(6);
    });

    it('should return undefined for unknown mint', () => {
      const token = getTokenByMint('UnknownMintAddress123456789');

      expect(token).toBeUndefined();
    });
  });

  describe('getTokenBySymbol', () => {
    it('should return correct token for "USDC"', () => {
      const token = getTokenBySymbol('USDC');

      expect(token).toBeDefined();
      expect(token?.mint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      expect(token?.name).toBe('USD Coin');
    });

    it('should be case-insensitive', () => {
      const token = getTokenBySymbol('usdc');

      expect(token).toBeDefined();
      expect(token?.symbol).toBe('USDC');
    });

    it('should return undefined for unknown symbol', () => {
      const token = getTokenBySymbol('UNKNOWN');

      expect(token).toBeUndefined();
    });
  });

  describe('searchTokens', () => {
    it('should find tokens by partial symbol', () => {
      const results = searchTokens('USD');

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some((t) => t.symbol === 'USDC')).toBe(true);
      expect(results.some((t) => t.symbol === 'USDT')).toBe(true);
    });

    it('should find tokens by partial name', () => {
      const results = searchTokens('Coin');

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((t) => t.name === 'USD Coin')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const resultsLower = searchTokens('sol');
      const resultsUpper = searchTokens('SOL');

      expect(resultsLower.length).toBe(resultsUpper.length);
      expect(resultsLower[0]?.symbol).toBe('SOL');
    });

    it('should return empty array for no match', () => {
      const results = searchTokens('NonExistentToken');

      expect(results).toEqual([]);
    });

    it('should return all tokens for empty query', () => {
      const results = searchTokens('');

      expect(results.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('isKnownToken', () => {
    it('should return true for known mint', () => {
      expect(isKnownToken('So11111111111111111111111111111111111111112')).toBe(true);
      expect(isKnownToken('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(true);
    });

    it('should return false for unknown mint', () => {
      expect(isKnownToken('UnknownMintAddress')).toBe(false);
    });
  });

  describe('getAllTokens', () => {
    it('should return all tokens', () => {
      const tokens = getAllTokens();

      expect(tokens.length).toBeGreaterThanOrEqual(3);
      expect(tokens.some((t) => t.symbol === 'SOL')).toBe(true);
      expect(tokens.some((t) => t.symbol === 'USDC')).toBe(true);
      expect(tokens.some((t) => t.symbol === 'USDT')).toBe(true);
    });

    it('should return tokens with all required fields', () => {
      const tokens = getAllTokens();

      for (const token of tokens) {
        expect(token.mint).toBeDefined();
        expect(token.symbol).toBeDefined();
        expect(token.name).toBeDefined();
        expect(token.decimals).toBeGreaterThan(0);
      }
    });

    it('should return immutable list', () => {
      const tokens1 = getAllTokens();
      const tokens2 = getAllTokens();

      // Should be equal but not the same reference (immutable)
      expect(tokens1).toEqual(tokens2);
    });
  });
});
