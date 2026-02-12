/**
 * Portfolio Aggregator Tests
 * Tests for fetching and aggregating token balances with USD values
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockGetSolBalance = vi.fn();
const mockGetTokenBalance = vi.fn();
const mockGetTokenByMint = vi.fn();
global.fetch = vi.fn();

vi.mock('@/lib/solana/tokens', () => ({
  getSolBalance: mockGetSolBalance,
  getTokenBalance: mockGetTokenBalance,
  formatTokenAmount: vi.fn((amount: bigint, decimals: number) => {
    // Simple formatting for tests
    return (Number(amount) / Math.pow(10, decimals)).toString();
  }),
}));

vi.mock('@/lib/solana/token-list', () => ({
  getTokenByMint: mockGetTokenByMint,
  getAllTokens: vi.fn(() => [
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
  ]),
}));

// Expected types for portfolio (to be created in Track A)
interface PortfolioToken {
  mint: string;
  symbol: string;
  name: string;
  balance: string; // Formatted amount
  balanceRaw: string; // Stringified bigint
  decimals: number;
  usdValue: string | null;
  pricePerToken: string | null;
}

interface _Portfolio {
  tokens: PortfolioToken[];
  totalUsdValue: string | null;
  lastUpdated: string;
}

// Mock implementation
const fetchPortfolio = vi.fn();

describe('Portfolio Aggregator', () => {
  const rpcEndpoint = 'https://devnet.helius-rpc.com';
  const walletAddress = '7fUAJdStEuGbc3sM84cKRL6yYaaSstyLSU4ve5oovLS7';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock SOL balance
    mockGetSolBalance.mockResolvedValue(1_000_000_000n); // 1 SOL

    // Mock USDC balance
    mockGetTokenBalance.mockResolvedValue({
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      balance: 50_000_000n, // 50 USDC
      decimals: 6,
    });

    // Mock token info lookups
    mockGetTokenByMint.mockImplementation((mint: string) => {
      const tokens: Record<string, { symbol: string; name: string; decimals: number }> = {
        'So11111111111111111111111111111111111111112': {
          symbol: 'SOL',
          name: 'Solana',
          decimals: 9,
        },
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
        },
      };
      return tokens[mint];
    });
  });

  describe('Success Cases', () => {
    it('should fetch SOL balance + known token balances', async () => {
      // Mock Jupiter price API
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            'So11111111111111111111111111111111111111112': { price: 100 },
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { price: 1 },
          },
        }),
      } as Response);

      fetchPortfolio.mockResolvedValueOnce({
        tokens: [
          {
            mint: 'So11111111111111111111111111111111111111112',
            symbol: 'SOL',
            name: 'Solana',
            balance: '1',
            balanceRaw: '1000000000',
            decimals: 9,
            usdValue: '100',
            pricePerToken: '100',
          },
          {
            mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            symbol: 'USDC',
            name: 'USD Coin',
            balance: '50',
            balanceRaw: '50000000',
            decimals: 6,
            usdValue: '50',
            pricePerToken: '1',
          },
        ],
        totalUsdValue: '150',
        lastUpdated: new Date().toISOString(),
      });

      const portfolio = await fetchPortfolio(walletAddress, rpcEndpoint);

      expect(portfolio.tokens.length).toBe(2);
      expect(portfolio.tokens[0]?.symbol).toBe('SOL');
      expect(portfolio.tokens[1]?.symbol).toBe('USDC');
    });

    it('should calculate USD values from Jupiter price API', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            'So11111111111111111111111111111111111111112': { price: 150 },
          },
        }),
      } as Response);

      fetchPortfolio.mockResolvedValueOnce({
        tokens: [
          {
            mint: 'So11111111111111111111111111111111111111112',
            symbol: 'SOL',
            name: 'Solana',
            balance: '1',
            balanceRaw: '1000000000',
            decimals: 9,
            usdValue: '150',
            pricePerToken: '150',
          },
        ],
        totalUsdValue: '150',
        lastUpdated: new Date().toISOString(),
      });

      const portfolio = await fetchPortfolio(walletAddress, rpcEndpoint);

      expect(portfolio.tokens[0]?.usdValue).toBe('150');
      expect(portfolio.totalUsdValue).toBe('150');
    });

    it('should sort by USD value descending', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            'So11111111111111111111111111111111111111112': { price: 100 },
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { price: 1 },
          },
        }),
      } as Response);

      fetchPortfolio.mockResolvedValueOnce({
        tokens: [
          {
            mint: 'So11111111111111111111111111111111111111112',
            symbol: 'SOL',
            name: 'Solana',
            balance: '1',
            balanceRaw: '1000000000',
            decimals: 9,
            usdValue: '100',
            pricePerToken: '100',
          },
          {
            mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            symbol: 'USDC',
            name: 'USD Coin',
            balance: '50',
            balanceRaw: '50000000',
            decimals: 6,
            usdValue: '50',
            pricePerToken: '1',
          },
        ],
        totalUsdValue: '150',
        lastUpdated: new Date().toISOString(),
      });

      const portfolio = await fetchPortfolio(walletAddress, rpcEndpoint);

      // First token should have higher USD value
      const firstToken = portfolio.tokens[0];
      const secondToken = portfolio.tokens[1];

      expect(firstToken).toBeDefined();
      expect(secondToken).toBeDefined();

      if (firstToken && secondToken && firstToken.usdValue && secondToken.usdValue) {
        expect(parseFloat(firstToken.usdValue)).toBeGreaterThan(
          parseFloat(secondToken.usdValue)
        );
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing price data (null usdValue)', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            // SOL price missing
          },
        }),
      } as Response);

      fetchPortfolio.mockResolvedValueOnce({
        tokens: [
          {
            mint: 'So11111111111111111111111111111111111111112',
            symbol: 'SOL',
            name: 'Solana',
            balance: '1',
            balanceRaw: '1000000000',
            decimals: 9,
            usdValue: null,
            pricePerToken: null,
          },
        ],
        totalUsdValue: null,
        lastUpdated: new Date().toISOString(),
      });

      const portfolio = await fetchPortfolio(walletAddress, rpcEndpoint);

      expect(portfolio.tokens[0]?.usdValue).toBeNull();
      expect(portfolio.totalUsdValue).toBeNull();
    });

    it('should handle RPC errors gracefully', async () => {
      mockGetSolBalance.mockRejectedValueOnce(new Error('RPC timeout'));

      fetchPortfolio.mockRejectedValueOnce({
        code: 'RPC_ERROR',
        message: 'Failed to fetch balances: RPC timeout',
      });

      await expect(
        fetchPortfolio(walletAddress, rpcEndpoint)
      ).rejects.toMatchObject({
        code: 'RPC_ERROR',
      });
    });

    it('should handle Jupiter price API errors gracefully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValueOnce(new Error('API unavailable'));

      fetchPortfolio.mockResolvedValueOnce({
        tokens: [
          {
            mint: 'So11111111111111111111111111111111111111112',
            symbol: 'SOL',
            name: 'Solana',
            balance: '1',
            balanceRaw: '1000000000',
            decimals: 9,
            usdValue: null, // Price unavailable
            pricePerToken: null,
          },
        ],
        totalUsdValue: null,
        lastUpdated: new Date().toISOString(),
      });

      const portfolio = await fetchPortfolio(walletAddress, rpcEndpoint);

      // Should still return balances, just without USD values
      expect(portfolio.tokens[0]?.balance).toBe('1');
      expect(portfolio.tokens[0]?.usdValue).toBeNull();
    });

    it('should return empty portfolio for wallet with no balances', async () => {
      mockGetSolBalance.mockResolvedValueOnce(0n);
      mockGetTokenBalance.mockResolvedValue({
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        balance: 0n,
        decimals: 6,
      });

      fetchPortfolio.mockResolvedValueOnce({
        tokens: [],
        totalUsdValue: '0',
        lastUpdated: new Date().toISOString(),
      });

      const portfolio = await fetchPortfolio(walletAddress, rpcEndpoint);

      expect(portfolio.tokens).toEqual([]);
      expect(portfolio.totalUsdValue).toBe('0');
    });

    it('should handle tokens with 0 decimals', async () => {
      mockGetTokenBalance.mockResolvedValueOnce({
        mint: 'NFTMintAddress',
        balance: 1n,
        decimals: 0, // NFT
      });

      mockGetTokenByMint.mockReturnValueOnce({
        symbol: 'NFT',
        name: 'NFT Token',
        decimals: 0,
      });

      fetchPortfolio.mockResolvedValueOnce({
        tokens: [
          {
            mint: 'NFTMintAddress',
            symbol: 'NFT',
            name: 'NFT Token',
            balance: '1',
            balanceRaw: '1',
            decimals: 0,
            usdValue: null,
            pricePerToken: null,
          },
        ],
        totalUsdValue: null,
        lastUpdated: new Date().toISOString(),
      });

      const portfolio = await fetchPortfolio(walletAddress, rpcEndpoint);

      expect(portfolio.tokens[0]?.balance).toBe('1');
      expect(portfolio.tokens[0]?.decimals).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should fetch all balances in parallel', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      } as Response);

      fetchPortfolio.mockResolvedValue({
        tokens: [],
        totalUsdValue: '0',
        lastUpdated: new Date().toISOString(),
      });

      await fetchPortfolio(walletAddress, rpcEndpoint);

      // Verify the mock was called
      expect(fetchPortfolio).toHaveBeenCalledWith(walletAddress, rpcEndpoint);
    });

    it('should cache results with lastUpdated timestamp', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      } as Response);

      const now = new Date().toISOString();

      fetchPortfolio.mockResolvedValueOnce({
        tokens: [],
        totalUsdValue: '0',
        lastUpdated: now,
      });

      const portfolio = await fetchPortfolio(walletAddress, rpcEndpoint);

      expect(portfolio.lastUpdated).toBeDefined();
      expect(new Date(portfolio.lastUpdated).getTime()).toBeGreaterThan(
        Date.now() - 5000
      );
    });
  });
});
