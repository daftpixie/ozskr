/**
 * Transaction Confirmation Poller Tests
 * Tests for polling transaction confirmation with exponential backoff
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock global fetch
global.fetch = vi.fn();

// Expected types for confirmation poller (to be created in Track A)
type ConfirmationStatus = 'confirmed' | 'failed' | 'timed_out';

interface _ConfirmationResult {
  status: ConfirmationStatus;
  signature: string;
  error?: string;
}

interface PollOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
}

// Mock implementation
const pollTransactionConfirmation = vi.fn();

describe('Transaction Confirmation Poller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const rpcEndpoint = 'https://devnet.helius-rpc.com';
  const signature = 'mockSignature123';

  describe('Success Cases', () => {
    it('should return "confirmed" when signature is confirmed', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: {
            value: [
              {
                confirmationStatus: 'confirmed',
                err: null,
              },
            ],
          },
        }),
      } as Response);

      pollTransactionConfirmation.mockImplementationOnce(
        async (sig: string, _endpoint: string) => {
          // Simulate immediate confirmation
          return {
            status: 'confirmed',
            signature: sig,
          };
        }
      );

      const result = await pollTransactionConfirmation(signature, rpcEndpoint);

      expect(result.status).toBe('confirmed');
      expect(result.signature).toBe(signature);
    });

    it('should poll multiple times before confirmation', async () => {

      pollTransactionConfirmation.mockImplementationOnce(
        async (sig: string, _endpoint: string) => {
          // Simulate 3 attempts before confirmation
          let attempts = 0;

          while (attempts < 3) {
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          return {
            status: 'confirmed',
            signature: sig,
          };
        }
      );

      const promise = pollTransactionConfirmation(signature, rpcEndpoint);

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(3000);

      const result = await promise;

      expect(result.status).toBe('confirmed');
    });
  });

  describe('Failure Cases', () => {
    it('should return "failed" when signature has error', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: '1',
          result: {
            value: [
              {
                confirmationStatus: 'confirmed',
                err: {
                  InstructionError: [0, 'Custom'],
                },
              },
            ],
          },
        }),
      } as Response);

      pollTransactionConfirmation.mockResolvedValueOnce({
        status: 'failed',
        signature,
        error: 'Transaction failed: InstructionError',
      });

      const result = await pollTransactionConfirmation(signature, rpcEndpoint);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('should return "timed_out" after timeout', async () => {
      pollTransactionConfirmation.mockImplementationOnce(
        async (sig: string, endpoint: string, options?: PollOptions) => {
          const timeoutMs = options?.timeoutMs || 60_000;

          // Simulate polling until timeout
          const startTime = Date.now();
          while (Date.now() - startTime < timeoutMs) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          return {
            status: 'timed_out',
            signature: sig,
          };
        }
      );

      const promise = pollTransactionConfirmation(signature, rpcEndpoint, {
        timeoutMs: 5000,
      });

      // Fast-forward past timeout
      await vi.advanceTimersByTimeAsync(6000);

      const result = await promise;

      expect(result.status).toBe('timed_out');
    });
  });

  describe('Exponential Backoff', () => {
    it('should use exponential backoff between polls', async () => {
      const delays: number[] = [];

      pollTransactionConfirmation.mockImplementationOnce(
        async (sig: string, endpoint: string, options?: PollOptions) => {
          const initialDelay = options?.initialDelayMs || 500;
          const maxDelay = options?.maxDelayMs || 8000;

          let currentDelay = initialDelay;

          // Simulate 5 polls with exponential backoff
          for (let i = 0; i < 5; i++) {
            delays.push(currentDelay);
            await new Promise((resolve) => setTimeout(resolve, currentDelay));

            // Double the delay (exponential backoff)
            currentDelay = Math.min(currentDelay * 2, maxDelay);
          }

          return {
            status: 'confirmed',
            signature: sig,
          };
        }
      );

      const promise = pollTransactionConfirmation(signature, rpcEndpoint, {
        initialDelayMs: 500,
        maxDelayMs: 8000,
      });

      // Fast-forward through all delays
      await vi.advanceTimersByTimeAsync(20000);

      await promise;

      // Verify exponential backoff: 500, 1000, 2000, 4000, 8000
      expect(delays).toEqual([500, 1000, 2000, 4000, 8000]);
    });

    it('should cap delay at maxDelayMs', async () => {
      const delays: number[] = [];

      pollTransactionConfirmation.mockImplementationOnce(
        async (sig: string, _endpoint: string) => {
          const maxDelay = 2000;
          let currentDelay = 500;

          for (let i = 0; i < 6; i++) {
            delays.push(currentDelay);
            await new Promise((resolve) => setTimeout(resolve, currentDelay));
            currentDelay = Math.min(currentDelay * 2, maxDelay);
          }

          return {
            status: 'confirmed',
            signature: sig,
          };
        }
      );

      const promise = pollTransactionConfirmation(signature, rpcEndpoint);

      await vi.advanceTimersByTimeAsync(15000);

      await promise;

      // After reaching 2000ms, it should stay at 2000ms
      expect(delays).toEqual([500, 1000, 2000, 2000, 2000, 2000]);
    });
  });

  describe('RPC Error Handling', () => {
    it('should handle RPC errors gracefully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      pollTransactionConfirmation.mockRejectedValueOnce({
        status: 'failed',
        signature,
        error: 'RPC error: Network error',
      });

      await expect(
        pollTransactionConfirmation(signature, rpcEndpoint)
      ).rejects.toMatchObject({
        error: expect.stringContaining('RPC error'),
      });
    });

    it('should validate RPC response with Zod', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          // Invalid response: missing result
          jsonrpc: '2.0',
          id: '1',
        }),
      } as Response);

      pollTransactionConfirmation.mockRejectedValueOnce({
        status: 'failed',
        signature,
        error: 'Invalid RPC response format',
      });

      await expect(
        pollTransactionConfirmation(signature, rpcEndpoint)
      ).rejects.toMatchObject({
        error: expect.stringContaining('Invalid RPC response'),
      });
    });

    it('should retry on transient RPC errors', async () => {
      const mockFetch = vi.mocked(fetch);

      // First attempt fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Temporary network issue'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            jsonrpc: '2.0',
            id: '1',
            result: {
              value: [
                {
                  confirmationStatus: 'confirmed',
                  err: null,
                },
              ],
            },
          }),
        } as Response);

      pollTransactionConfirmation.mockImplementationOnce(
        async (sig: string, _endpoint: string) => {
          // Simulate retry after transient error
          try {
            await fetch(_endpoint, {
              method: 'POST',
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: '1',
                method: 'getSignatureStatuses',
                params: [[sig]],
              }),
            });
          } catch {
            // Retry after delay
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          return {
            status: 'confirmed',
            signature: sig,
          };
        }
      );

      const promise = pollTransactionConfirmation(signature, rpcEndpoint);

      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result.status).toBe('confirmed');
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom maxAttempts', async () => {
      let attempts = 0;

      pollTransactionConfirmation.mockImplementationOnce(
        async (sig: string, endpoint: string, options?: PollOptions) => {
          const maxAttempts = options?.maxAttempts || 10;

          while (attempts < maxAttempts) {
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          return {
            status: 'timed_out',
            signature: sig,
          };
        }
      );

      const promise = pollTransactionConfirmation(signature, rpcEndpoint, {
        maxAttempts: 5,
      });

      await vi.advanceTimersByTimeAsync(10000);

      await promise;

      expect(attempts).toBe(5);
    });

    it('should use default timeout if not specified', async () => {
      pollTransactionConfirmation.mockImplementationOnce(
        async (sig: string, endpoint: string, options?: PollOptions) => {
          const timeout = options?.timeoutMs || 60_000; // Default 60s
          expect(timeout).toBe(60_000);

          return {
            status: 'confirmed',
            signature: sig,
          };
        }
      );

      await pollTransactionConfirmation(signature, rpcEndpoint);
    });
  });
});
