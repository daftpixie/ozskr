/**
 * Jupiter Ultra API Client Tests
 * Comprehensive edge case testing for Jupiter integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getQuote, JupiterError, JupiterErrorCode } from './jupiter';
import type { JupiterQuoteParams } from './jupiter';

// Mock @solana/kit
vi.mock('@solana/kit', () => ({
  address: vi.fn((addr: string) => {
    // Validate address format
    if (addr.length < 32 || addr.length > 44) {
      throw new Error('Invalid address length');
    }
    return addr;
  }),
}));

// Mock global fetch
global.fetch = vi.fn();

describe('Jupiter Ultra API Client', () => {
  const validParams: JupiterQuoteParams = {
    inputMint: 'So11111111111111111111111111111111111111112', // SOL
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    amount: '1000000000', // 1 SOL
    slippageBps: 50,
    taker: '7fUAJdStEuGbc3sM84cKRL6yYaaSstyLSU4ve5oovLS7', // Random wallet
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Validation', () => {
    it('should validate addresses before API call', async () => {
      const invalidParams = {
        ...validParams,
        inputMint: 'invalid',
      };

      await expect(getQuote(invalidParams)).rejects.toThrow(JupiterError);
      await expect(getQuote(invalidParams)).rejects.toMatchObject({
        code: JupiterErrorCode.VALIDATION_ERROR,
      });

      // Verify fetch was NOT called
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should reject non-numeric amount string', async () => {
      const invalidParams = {
        ...validParams,
        amount: '1.5',
      };

      await expect(getQuote(invalidParams)).rejects.toThrow(JupiterError);
      await expect(getQuote(invalidParams)).rejects.toMatchObject({
        code: JupiterErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('stringified bigint'),
      });
    });

    it('should reject slippage > 300 bps', async () => {
      const invalidParams = {
        ...validParams,
        slippageBps: 500,
      };

      await expect(getQuote(invalidParams)).rejects.toThrow(JupiterError);
      await expect(getQuote(invalidParams)).rejects.toMatchObject({
        code: JupiterErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('between 1 and 300 bps'),
      });
    });

    it('should reject slippage < 1 bps', async () => {
      const invalidParams = {
        ...validParams,
        slippageBps: 0,
      };

      await expect(getQuote(invalidParams)).rejects.toThrow(JupiterError);
      await expect(getQuote(invalidParams)).rejects.toMatchObject({
        code: JupiterErrorCode.VALIDATION_ERROR,
      });
    });

    it('should reject invalid mint addresses', async () => {
      const invalidParams = {
        ...validParams,
        outputMint: 'too-short',
      };

      await expect(getQuote(invalidParams)).rejects.toThrow(JupiterError);
      await expect(getQuote(invalidParams)).rejects.toMatchObject({
        code: JupiterErrorCode.VALIDATION_ERROR,
      });
    });

    it('should reject invalid taker address', async () => {
      const invalidParams = {
        ...validParams,
        taker: 'invalid-wallet-address',
      };

      await expect(getQuote(invalidParams)).rejects.toThrow(JupiterError);
      await expect(getQuote(invalidParams)).rejects.toMatchObject({
        code: JupiterErrorCode.VALIDATION_ERROR,
      });
    });

    it('should use default slippage if not provided', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          inputMint: validParams.inputMint,
          outputMint: validParams.outputMint,
          inputAmount: validParams.amount,
          outputAmount: '50000000',
          priceImpact: '0.1',
          orderData: {},
          transaction: 'base64encodedtx',
        }),
      } as Response);

      const paramsWithoutSlippage = {
        inputMint: validParams.inputMint,
        outputMint: validParams.outputMint,
        amount: validParams.amount,
        taker: validParams.taker,
      };

      await getQuote(paramsWithoutSlippage);

      // Verify fetch was called with default slippage (50 bps)
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"slippageBps":50'),
        })
      );
    });
  });

  describe('Success Cases', () => {
    it('should return parsed JupiterQuoteResult on success', async () => {
      const mockResponse = {
        inputMint: validParams.inputMint,
        outputMint: validParams.outputMint,
        inputAmount: validParams.amount,
        outputAmount: '50000000',
        priceImpact: '0.1',
        orderData: { route: ['SOL', 'USDC'] },
        transaction: 'base64encodedtransaction',
      };

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await getQuote(validParams);

      expect(result).toMatchObject({
        inputMint: validParams.inputMint,
        outputMint: validParams.outputMint,
        inputAmount: validParams.amount,
        outputAmount: '50000000',
        priceImpact: '0.1',
        orderData: expect.any(Object),
        transaction: 'base64encodedtransaction',
      });

      // Verify expiresAt is set (either from API or default)
      expect(result.expiresAt).toBeDefined();
      expect(typeof result.expiresAt).toBe('string');
    });

    it('should accept valid quote with all fields', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          inputMint: validParams.inputMint,
          outputMint: validParams.outputMint,
          inputAmount: validParams.amount,
          outputAmount: '50000000',
          priceImpact: '0.5',
          orderData: { data: 'opaque' },
          transaction: 'YmFzZTY0ZW5jb2RlZHR4',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      } as Response);

      const result = await getQuote(validParams);

      expect(result.inputMint).toBe(validParams.inputMint);
      expect(result.outputMint).toBe(validParams.outputMint);
      expect(result.transaction).toBe('YmFzZTY0ZW5jb2RlZHR4');
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP 429 with retry-after header', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          'Retry-After': '30', // 30 seconds
        }),
        json: async () => ({ error: 'Rate limited' }),
      } as Response);

      await expect(getQuote(validParams)).rejects.toMatchObject({
        code: JupiterErrorCode.RATE_LIMITED,
        message: expect.stringContaining('30000ms'),
        retryAfterMs: 30_000,
      });
    });

    it('should handle HTTP 429 without retry-after header', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers(),
        json: async () => ({ error: 'Rate limited' }),
      } as Response);

      await expect(getQuote(validParams)).rejects.toMatchObject({
        code: JupiterErrorCode.RATE_LIMITED,
        retryAfterMs: 60_000, // Default 60s
      });
    });

    it('should handle network error', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      await expect(getQuote(validParams)).rejects.toMatchObject({
        code: JupiterErrorCode.NETWORK_ERROR,
        message: expect.stringContaining('Network connection failed'),
      });
    });

    it('should handle "no route" error', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'No route found for this token pair',
          code: 'NO_ROUTE',
        }),
      } as Response);

      await expect(getQuote(validParams)).rejects.toMatchObject({
        code: JupiterErrorCode.NO_ROUTE,
        message: expect.stringContaining('No swap route available'),
      });
    });

    it('should handle invalid pair error', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Invalid token pair or unsupported',
          code: 'INVALID_PAIR',
        }),
      } as Response);

      await expect(getQuote(validParams)).rejects.toMatchObject({
        code: JupiterErrorCode.INVALID_PAIR,
        message: expect.stringContaining('Invalid token pair'),
      });
    });

    it('should handle generic API error', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal server error',
        }),
      } as Response);

      await expect(getQuote(validParams)).rejects.toMatchObject({
        code: JupiterErrorCode.UNKNOWN,
        message: 'Internal server error',
      });
    });

    it('should handle malformed JSON response', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as Response);

      await expect(getQuote(validParams)).rejects.toMatchObject({
        code: JupiterErrorCode.UNKNOWN,
        message: expect.stringContaining('Failed to parse response'),
      });
    });
  });

  describe('Zod Validation', () => {
    it('should reject malformed quote response (missing required fields)', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          inputMint: validParams.inputMint,
          // Missing outputMint, inputAmount, outputAmount, transaction
        }),
      } as Response);

      await expect(getQuote(validParams)).rejects.toMatchObject({
        code: JupiterErrorCode.VALIDATION_ERROR,
        message: expect.stringContaining('Invalid response from Jupiter API'),
      });
    });

    it('should reject response with wrong field types', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          inputMint: 123, // Should be string
          outputMint: validParams.outputMint,
          inputAmount: validParams.amount,
          outputAmount: '50000000',
          priceImpact: '0.1',
          orderData: {},
          transaction: 'base64encodedtx',
        }),
      } as Response);

      await expect(getQuote(validParams)).rejects.toMatchObject({
        code: JupiterErrorCode.VALIDATION_ERROR,
      });
    });

    it('should accept quote without optional expiresAt', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          inputMint: validParams.inputMint,
          outputMint: validParams.outputMint,
          inputAmount: validParams.amount,
          outputAmount: '50000000',
          priceImpact: '0.1',
          orderData: {},
          transaction: 'base64encodedtx',
          // expiresAt is optional
        }),
      } as Response);

      const result = await getQuote(validParams);

      // Should have default expiresAt (60 seconds from now)
      expect(result.expiresAt).toBeDefined();
      const expiresAtDate = new Date(result.expiresAt);
      const now = Date.now();
      const diff = expiresAtDate.getTime() - now;

      // Should be approximately 60 seconds (allow 5 second margin)
      expect(diff).toBeGreaterThan(55_000);
      expect(diff).toBeLessThan(65_000);
    });
  });
});
