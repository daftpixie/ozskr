/**
 * SPL Token Utilities Tests
 * Tests for token balance queries and amount formatting
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatTokenAmount,
  parseTokenAmount,
  getSolBalance,
  getTokenBalance,
  TokenError,
} from './tokens';

// Mock @solana/kit
const mockGetBalance = vi.fn();
const mockGetTokenAccountsByOwner = vi.fn();
const mockGetAccountInfo = vi.fn();

vi.mock('@solana/kit', () => ({
  createSolanaRpc: vi.fn(() => ({
    getBalance: vi.fn((_addr: string) => ({
      send: mockGetBalance,
    })),
    getTokenAccountsByOwner: vi.fn((_owner: string, _filter: unknown) => ({
      send: mockGetTokenAccountsByOwner,
    })),
    getAccountInfo: vi.fn((_addr: string) => ({
      send: mockGetAccountInfo,
    })),
  })),
  address: vi.fn((addr: string) => {
    if (addr.length < 32 || addr.length > 44) {
      throw new Error('Invalid address');
    }
    return addr;
  }),
}));

describe('Token Amount Formatting', () => {
  describe('formatTokenAmount', () => {
    it('should format 0 as "0"', () => {
      expect(formatTokenAmount(0n, 6)).toBe('0');
      expect(formatTokenAmount(0n, 9)).toBe('0');
    });

    it('should format 1_000_000 with 6 decimals as "1"', () => {
      expect(formatTokenAmount(1_000_000n, 6)).toBe('1');
    });

    it('should format 1_500_000 with 6 decimals as "1.5"', () => {
      expect(formatTokenAmount(1_500_000n, 6)).toBe('1.5');
    });

    it('should format 500_000 with 6 decimals as "0.5"', () => {
      expect(formatTokenAmount(500_000n, 6)).toBe('0.5');
    });

    it('should handle 9 decimals (SOL)', () => {
      expect(formatTokenAmount(1_000_000_000n, 9)).toBe('1');
      expect(formatTokenAmount(1_500_000_000n, 9)).toBe('1.5');
      expect(formatTokenAmount(500_000_000n, 9)).toBe('0.5');
      expect(formatTokenAmount(1n, 9)).toBe('0.000000001');
    });

    it('should remove trailing zeros', () => {
      expect(formatTokenAmount(1_000_000n, 6)).toBe('1');
      expect(formatTokenAmount(1_100_000n, 6)).toBe('1.1');
      expect(formatTokenAmount(1_000_001n, 6)).toBe('1.000001');
    });

    it('should handle negative amounts', () => {
      expect(formatTokenAmount(-1_000_000n, 6)).toBe('-1');
      expect(formatTokenAmount(-1_500_000n, 6)).toBe('-1.5');
      expect(formatTokenAmount(-500_000n, 6)).toBe('-0.5');
    });

    it('should handle very large amounts (no overflow)', () => {
      const largeAmount = 1_000_000_000_000_000n; // 1 billion tokens (6 decimals)
      expect(formatTokenAmount(largeAmount, 6)).toBe('1000000000');
    });

    it('should handle amounts less than 1 token', () => {
      expect(formatTokenAmount(1n, 6)).toBe('0.000001');
      expect(formatTokenAmount(100n, 6)).toBe('0.0001');
      expect(formatTokenAmount(10_000n, 6)).toBe('0.01');
    });

    it('should handle different decimal places', () => {
      expect(formatTokenAmount(1000n, 3)).toBe('1');
      expect(formatTokenAmount(100_000_000n, 8)).toBe('1');
      expect(formatTokenAmount(1_000_000_000_000_000_000n, 18)).toBe('1');
    });
  });

  describe('parseTokenAmount', () => {
    it('should parse "1" with 6 decimals as 1_000_000n', () => {
      expect(parseTokenAmount('1', 6)).toBe(1_000_000n);
    });

    it('should parse "1.5" with 6 decimals as 1_500_000n', () => {
      expect(parseTokenAmount('1.5', 6)).toBe(1_500_000n);
    });

    it('should parse "0.000001" with 6 decimals as 1n', () => {
      expect(parseTokenAmount('0.000001', 6)).toBe(1n);
    });

    it('should parse "0" as 0n', () => {
      expect(parseTokenAmount('0', 6)).toBe(0n);
      expect(parseTokenAmount('', 6)).toBe(0n);
    });

    it('should reject too many decimal places', () => {
      expect(() => parseTokenAmount('1.0000001', 6)).toThrow(TokenError);
      expect(() => parseTokenAmount('1.0000001', 6)).toThrow(
        'too many decimal places'
      );
    });

    it('should reject non-numeric input', () => {
      expect(() => parseTokenAmount('abc', 6)).toThrow(TokenError);
      expect(() => parseTokenAmount('1.2.3', 6)).toThrow(TokenError);
      expect(() => parseTokenAmount('1e6', 6)).toThrow(TokenError);
    });

    it('should handle negative amounts', () => {
      expect(parseTokenAmount('-1', 6)).toBe(-1_000_000n);
      expect(parseTokenAmount('-1.5', 6)).toBe(-1_500_000n);
    });

    it('should handle amounts without decimal point', () => {
      expect(parseTokenAmount('100', 6)).toBe(100_000_000n);
    });

    it('should handle amounts with trailing zeros', () => {
      expect(parseTokenAmount('1.500000', 6)).toBe(1_500_000n);
      expect(parseTokenAmount('1.100', 6)).toBe(1_100_000n);
    });

    it('should pad decimal part correctly', () => {
      expect(parseTokenAmount('1.1', 6)).toBe(1_100_000n);
      expect(parseTokenAmount('1.01', 6)).toBe(1_010_000n);
      expect(parseTokenAmount('1.001', 6)).toBe(1_001_000n);
    });
  });

  describe('roundtrip format ↔ parse', () => {
    it('should satisfy format(parse(x)) === x', () => {
      const testCases = ['1', '1.5', '0.5', '0.000001', '100.123456'];

      for (const testCase of testCases) {
        const parsed = parseTokenAmount(testCase, 6);
        const formatted = formatTokenAmount(parsed, 6);
        expect(formatted).toBe(testCase);
      }
    });

    it('should roundtrip for SOL (9 decimals)', () => {
      const testCases = ['1', '0.5', '0.000000001', '10.5'];

      for (const testCase of testCases) {
        const parsed = parseTokenAmount(testCase, 9);
        const formatted = formatTokenAmount(parsed, 9);
        expect(formatted).toBe(testCase);
      }
    });
  });
});

describe('Balance Queries', () => {
  const rpcEndpoint = 'https://devnet.helius-rpc.com';
  const walletAddress = '7fUAJdStEuGbc3sM84cKRL6yYaaSstyLSU4ve5oovLS7';
  const mintAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSolBalance', () => {
    it('should return bigint balance', async () => {
      mockGetBalance.mockResolvedValueOnce({
        value: 1_000_000_000n, // 1 SOL
      });

      const balance = await getSolBalance(rpcEndpoint, walletAddress);

      expect(balance).toBe(1_000_000_000n);
    });

    it('should throw TokenError for invalid address', async () => {
      await expect(
        getSolBalance(rpcEndpoint, 'invalid')
      ).rejects.toThrow(TokenError);

      await expect(
        getSolBalance(rpcEndpoint, 'invalid')
      ).rejects.toThrow('Invalid wallet address');
    });

    it('should throw TokenError on RPC failure', async () => {
      mockGetBalance.mockRejectedValueOnce(new Error('RPC timeout'));

      await expect(
        getSolBalance(rpcEndpoint, walletAddress)
      ).rejects.toThrow(TokenError);

      await expect(
        getSolBalance(rpcEndpoint, walletAddress)
      ).rejects.toThrow('Failed to get SOL balance');
    });

    it('should return 0 for empty wallet', async () => {
      mockGetBalance.mockResolvedValueOnce({
        value: 0n,
      });

      const balance = await getSolBalance(rpcEndpoint, walletAddress);

      expect(balance).toBe(0n);
    });
  });

  describe('getTokenBalance', () => {
    it('should return TokenBalance with correct decimals', async () => {
      // Mock token account response
      const tokenAccountData = Buffer.alloc(165);
      // Write amount at offset 64 (u64 little-endian)
      const amount = 1_000_000n;
      for (let i = 0; i < 8; i++) {
        tokenAccountData[64 + i] = Number((amount >> BigInt(i * 8)) & 0xFFn);
      }

      mockGetTokenAccountsByOwner.mockResolvedValueOnce({
        value: [
          {
            pubkey: 'TokenAccountAddress',
            account: {
              data: tokenAccountData.toString('base64'),
            },
          },
        ],
      });

      // Mock mint account response
      const mintAccountData = Buffer.alloc(82);
      mintAccountData[44] = 6; // decimals at offset 44

      mockGetAccountInfo.mockResolvedValueOnce({
        value: {
          data: mintAccountData.toString('base64'),
        },
      });

      const balance = await getTokenBalance(
        rpcEndpoint,
        walletAddress,
        mintAddress
      );

      expect(balance).toEqual({
        mint: mintAddress,
        balance: 1_000_000n,
        decimals: 6,
      });
    });

    it('should return 0 balance when no token account exists', async () => {
      mockGetTokenAccountsByOwner.mockResolvedValueOnce({
        value: [], // No token accounts
      });

      mockGetAccountInfo.mockResolvedValueOnce({
        value: {
          data: Buffer.alloc(82).toString('base64'),
        },
      });

      const balance = await getTokenBalance(
        rpcEndpoint,
        walletAddress,
        mintAddress
      );

      expect(balance.balance).toBe(0n);
      expect(balance.decimals).toBe(6); // Default
    });

    it('should throw TokenError for invalid address', async () => {
      await expect(
        getTokenBalance(rpcEndpoint, 'invalid', mintAddress)
      ).rejects.toThrow(TokenError);

      await expect(
        getTokenBalance(rpcEndpoint, 'invalid', mintAddress)
      ).rejects.toThrow('Invalid address');
    });

    it('should throw TokenError when mint not found', async () => {
      mockGetTokenAccountsByOwner.mockResolvedValue({
        value: [],
      });

      mockGetAccountInfo.mockResolvedValue({
        value: null, // Mint account doesn't exist
      });

      await expect(
        getTokenBalance(rpcEndpoint, walletAddress, mintAddress)
      ).rejects.toThrow(TokenError);
      await expect(
        getTokenBalance(rpcEndpoint, walletAddress, mintAddress)
      ).rejects.toThrow('Token mint not found');
    });

    it('should handle RPC data as [base64, encoding] tuple', async () => {
      const tokenAccountData = Buffer.alloc(165);
      const amount = 5_000_000n;
      for (let i = 0; i < 8; i++) {
        tokenAccountData[64 + i] = Number((amount >> BigInt(i * 8)) & 0xFFn);
      }

      mockGetTokenAccountsByOwner.mockResolvedValueOnce({
        value: [
          {
            pubkey: 'TokenAccountAddress',
            account: {
              data: [tokenAccountData.toString('base64'), 'base64'],
            },
          },
        ],
      });

      const mintAccountData = Buffer.alloc(82);
      mintAccountData[44] = 6;

      mockGetAccountInfo.mockResolvedValueOnce({
        value: {
          data: [mintAccountData.toString('base64'), 'base64'],
        },
      });

      const balance = await getTokenBalance(
        rpcEndpoint,
        walletAddress,
        mintAddress
      );

      expect(balance.balance).toBe(5_000_000n);
    });

    it('should handle RPC failure gracefully', async () => {
      mockGetTokenAccountsByOwner.mockRejectedValue(
        new Error('Network timeout')
      );

      // Also need to reset other mocks to ensure they fail too
      mockGetAccountInfo.mockRejectedValue(new Error('Network timeout'));

      await expect(
        getTokenBalance(rpcEndpoint, walletAddress, mintAddress)
      ).rejects.toThrow(TokenError);
      await expect(
        getTokenBalance(rpcEndpoint, walletAddress, mintAddress)
      ).rejects.toThrow('Failed to get token balance');
    });
  });
});
