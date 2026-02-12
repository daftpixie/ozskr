/**
 * Transaction Builder Tests
 * Comprehensive testing for swap transaction building and simulation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildSwapTransaction,
  simulateTransaction,
  prepareSwap,
  SwapError,
} from './transactions';
import { JupiterErrorCode } from './jupiter';
import { getQuote } from './jupiter';
import { getPriorityFeeEstimate } from './priority-fees';
import type { JupiterQuoteResult } from './jupiter';
import type { TransactionCostEstimate } from './priority-fees';

// Mock dependencies
vi.mock('@solana/kit', () => ({
  address: vi.fn((addr: string) => {
    if (addr.length < 32 || addr.length > 44) {
      throw new Error('Invalid address');
    }
    return addr;
  }),
}));

vi.mock('./jupiter', () => ({
  getQuote: vi.fn(),
  JupiterError: class JupiterError extends Error {
    constructor(
      public code: string,
      message: string
    ) {
      super(message);
      this.name = 'JupiterError';
    }
  },
  JupiterErrorCode: {
    NO_ROUTE: 'NO_ROUTE',
    RATE_LIMITED: 'RATE_LIMITED',
    INVALID_PAIR: 'INVALID_PAIR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNKNOWN: 'UNKNOWN',
  },
}));

vi.mock('./priority-fees', () => ({
  getPriorityFeeEstimate: vi.fn(),
}));

// Mock global fetch
global.fetch = vi.fn();

describe('Transaction Builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildSwapTransaction', () => {
    it('should decode base64 to Uint8Array correctly', () => {
      const mockQuote: JupiterQuoteResult = {
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        inputAmount: '1000000000',
        outputAmount: '50000000',
        priceImpact: '0.1',
        orderData: {},
        transaction: Buffer.from('test transaction data').toString('base64'),
        expiresAt: new Date().toISOString(),
      };

      const result = buildSwapTransaction(mockQuote);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(Buffer.from(result).toString()).toBe('test transaction data');
    });

    it('should handle invalid base64 gracefully', () => {
      // Note: Buffer.from() is lenient with invalid base64 — it silently ignores invalid chars
      // This test verifies that even malformed input doesn't crash, it just decodes what it can
      const mockQuote: JupiterQuoteResult = {
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        inputAmount: '1000000000',
        outputAmount: '50000000',
        priceImpact: '0.1',
        orderData: {},
        transaction: 'not-valid-base64!!!',
        expiresAt: new Date().toISOString(),
      };

      // Should not throw — Buffer.from is lenient
      const result = buildSwapTransaction(mockQuote);
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('should handle empty transaction', () => {
      const mockQuote: JupiterQuoteResult = {
        inputMint: 'So11111111111111111111111111111111111111112',
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        inputAmount: '1000000000',
        outputAmount: '50000000',
        priceImpact: '0.1',
        orderData: {},
        transaction: '',
        expiresAt: new Date().toISOString(),
      };

      const result = buildSwapTransaction(mockQuote);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(0);
    });
  });

  describe('simulateTransaction', () => {
    const mockTransaction = new Uint8Array([1, 2, 3, 4, 5]);
    const rpcEndpoint = 'https://devnet.helius-rpc.com';

    it('should return success with logs and compute units', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: {
            value: {
              err: null,
              logs: ['Program log: Success', 'Program log: Complete'],
              unitsConsumed: 50000,
            },
          },
        }),
      } as Response);

      const result = await simulateTransaction(mockTransaction, rpcEndpoint);

      expect(result.success).toBe(true);
      expect(result.unitsConsumed).toBe(50000);
      expect(result.logs).toEqual([
        'Program log: Success',
        'Program log: Complete',
      ]);
      expect(result.error).toBeUndefined();
    });

    it('should return failure with parsed error message', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: {
            value: {
              err: { InstructionError: [2, 'Custom'] },
              logs: [
                'Program log: insufficient funds',
                'Program failed',
              ],
              unitsConsumed: 10000,
            },
          },
        }),
      } as Response);

      const result = await simulateTransaction(mockTransaction, rpcEndpoint);

      expect(result.success).toBe(false);
      expect(result.unitsConsumed).toBe(10000);
      expect(result.error).toContain('Insufficient funds');
    });

    it('should parse slippage error from logs', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: {
            value: {
              err: { InstructionError: [1, 'Custom'] },
              logs: ['Program log: slippage tolerance exceeded'],
              unitsConsumed: 5000,
            },
          },
        }),
      } as Response);

      const result = await simulateTransaction(mockTransaction, rpcEndpoint);

      expect(result.success).toBe(false);
      expect(result.error).toContain('slippage tolerance');
      expect(result.error).toContain('refreshing quote');
    });

    it('should handle RPC error response', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          error: {
            code: -32602,
            message: 'Invalid params',
          },
        }),
      } as Response);

      await expect(
        simulateTransaction(mockTransaction, rpcEndpoint)
      ).rejects.toThrow(SwapError);
      await expect(
        simulateTransaction(mockTransaction, rpcEndpoint)
      ).rejects.toMatchObject({
        code: 'SIMULATION_RPC_ERROR',
        message: expect.stringContaining('Invalid params'),
      });
    });

    it('should reject malformed simulation response', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          // Missing jsonrpc and id
          result: {
            value: {
              err: null,
            },
          },
        }),
      } as Response);

      await expect(
        simulateTransaction(mockTransaction, rpcEndpoint)
      ).rejects.toThrow(SwapError);
      await expect(
        simulateTransaction(mockTransaction, rpcEndpoint)
      ).rejects.toMatchObject({
        code: 'SIMULATION_PARSE_ERROR',
      });
    });

    it('should handle HTTP error from RPC', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      await expect(
        simulateTransaction(mockTransaction, rpcEndpoint)
      ).rejects.toThrow(SwapError);
      await expect(
        simulateTransaction(mockTransaction, rpcEndpoint)
      ).rejects.toMatchObject({
        code: 'SIMULATION_RPC_ERROR',
        message: expect.stringContaining('HTTP 500'),
      });
    });

    it('should handle network error', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValue(new Error('Network timeout'));

      await expect(
        simulateTransaction(mockTransaction, rpcEndpoint)
      ).rejects.toThrow(SwapError);
      await expect(
        simulateTransaction(mockTransaction, rpcEndpoint)
      ).rejects.toMatchObject({
        code: 'SIMULATION_ERROR',
        message: expect.stringContaining('Network timeout'),
      });
    });
  });

  describe('prepareSwap', () => {
    const validParams = {
      inputMint: 'So11111111111111111111111111111111111111112',
      outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      amount: '1000000000',
      slippageBps: 50,
      taker: '7fUAJdStEuGbc3sM84cKRL6yYaaSstyLSU4ve5oovLS7',
      rpcEndpoint: 'https://devnet.helius-rpc.com',
    };

    const mockQuoteResult: JupiterQuoteResult = {
      inputMint: validParams.inputMint,
      outputMint: validParams.outputMint,
      inputAmount: validParams.amount,
      outputAmount: '50000000',
      priceImpact: '0.1',
      orderData: {},
      transaction: Buffer.from('mock transaction').toString('base64'),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };

    const mockCostEstimate: TransactionCostEstimate = {
      baseFee: 5_000n,
      priorityFee: 50_000n,
      totalEstimate: 55_000n,
      displayAmount: '0.000055',
    };

    beforeEach(() => {
      vi.mocked(getQuote).mockResolvedValue(mockQuoteResult);
      vi.mocked(getPriorityFeeEstimate).mockResolvedValue(mockCostEstimate);
    });

    it('should validate all addresses before proceeding', async () => {
      const invalidParams = {
        ...validParams,
        inputMint: 'invalid',
      };

      await expect(prepareSwap(invalidParams)).rejects.toThrow(SwapError);
      await expect(prepareSwap(invalidParams)).rejects.toMatchObject({
        code: 'INVALID_ADDRESS',
      });
    });

    it('should throw if RPC endpoint is missing', async () => {
      delete process.env.NEXT_PUBLIC_HELIUS_RPC_URL;

      const paramsWithoutRpc = {
        inputMint: validParams.inputMint,
        outputMint: validParams.outputMint,
        amount: validParams.amount,
        taker: validParams.taker,
      };

      await expect(prepareSwap(paramsWithoutRpc)).rejects.toThrow(SwapError);
      await expect(prepareSwap(paramsWithoutRpc)).rejects.toMatchObject({
        code: 'MISSING_RPC_ENDPOINT',
      });
    });

    it('should call simulate before returning (simulation is mandatory)', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: {
            value: {
              err: null,
              logs: ['Success'],
              unitsConsumed: 50000,
            },
          },
        }),
      } as Response);

      await prepareSwap(validParams);

      // Verify fetch was called for simulation
      expect(fetch).toHaveBeenCalledWith(
        validParams.rpcEndpoint,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('simulateTransaction'),
        })
      );
    });

    it('should abort if simulation fails', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: {
            value: {
              err: { InstructionError: [0, 'Custom'] },
              logs: ['Program log: insufficient funds'],
              unitsConsumed: 10000,
            },
          },
        }),
      } as Response);

      await expect(prepareSwap(validParams)).rejects.toThrow(SwapError);
      await expect(prepareSwap(validParams)).rejects.toMatchObject({
        code: 'SIMULATION_FAILED',
        message: expect.stringContaining('Insufficient funds'),
      });
    });

    it('should pass correct params to getQuote', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: {
            value: {
              err: null,
              logs: [],
              unitsConsumed: 50000,
            },
          },
        }),
      } as Response);

      await prepareSwap(validParams);

      expect(getQuote).toHaveBeenCalledWith({
        inputMint: validParams.inputMint,
        outputMint: validParams.outputMint,
        amount: validParams.amount,
        slippageBps: validParams.slippageBps,
        taker: validParams.taker,
      });
    });

    it('should return prepared transaction with all fields', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: {
            value: {
              err: null,
              logs: ['Success'],
              unitsConsumed: 50000,
            },
          },
        }),
      } as Response);

      const result = await prepareSwap(validParams);

      expect(result.transaction).toBeInstanceOf(Uint8Array);
      expect(result.simulationResult.success).toBe(true);
      expect(result.costEstimate).toEqual(mockCostEstimate);
      expect(result.expiresAt).toBe(mockQuoteResult.expiresAt);
    });

    it('should re-throw JupiterError with additional context', async () => {
      const { JupiterError } = await import('./jupiter');
      const jupiterError = new JupiterError(
        JupiterErrorCode.NO_ROUTE,
        'No route available'
      );

      vi.mocked(getQuote).mockRejectedValue(jupiterError);

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: {
            value: {
              err: null,
              logs: [],
              unitsConsumed: 50000,
            },
          },
        }),
      } as Response);

      await expect(prepareSwap(validParams)).rejects.toThrow(SwapError);
      await expect(prepareSwap(validParams)).rejects.toMatchObject({
        code: 'QUOTE_ERROR',
        message: expect.stringContaining('Failed to get swap quote'),
      });
    });

    it('should handle priority fee estimation failure', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: {
            value: {
              err: null,
              logs: [],
              unitsConsumed: 50000,
            },
          },
        }),
      } as Response);

      vi.mocked(getPriorityFeeEstimate).mockRejectedValue(
        new Error('Helius API error')
      );

      await expect(prepareSwap(validParams)).rejects.toThrow(SwapError);
      await expect(prepareSwap(validParams)).rejects.toMatchObject({
        code: 'FEE_ESTIMATION_ERROR',
        message: expect.stringContaining('Helius API error'),
      });
    });
  });
});
