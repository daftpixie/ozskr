import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  submitToFacilitator,
  FacilitatorError,
} from '../src/lib/facilitator.js';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// submitToFacilitator
// ---------------------------------------------------------------------------

describe('submitToFacilitator', () => {
  it('should succeed on first attempt with CDP', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        transaction: 'sig123abc',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        payer: 'PayerAddress',
      }),
    })) as unknown as typeof fetch;

    const result = await submitToFacilitator(
      { payload: { transaction: 'tx' } },
      { scheme: 'exact' },
    );

    expect(result.success).toBe(true);
    expect(result.transactionSignature).toBe('sig123abc');
    expect(result.facilitator).toBe('cdp');
  });

  it('should fallback to PayAI when CDP fails', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async (url: string) => {
      callCount++;
      // CDP calls fail (first 3 = 1 initial + 2 retries)
      if ((url as string).includes('x402.org')) {
        throw new Error('Connection refused');
      }
      // PayAI succeeds
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          transaction: 'payai-sig-456',
          network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
        }),
      };
    }) as unknown as typeof fetch;

    const result = await submitToFacilitator(
      { payload: {} },
      { scheme: 'exact' },
    );

    expect(result.success).toBe(true);
    expect(result.transactionSignature).toBe('payai-sig-456');
    expect(result.facilitator).toBe('payai');
  });

  it('should throw FacilitatorError when both facilitators fail', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network unreachable');
    }) as unknown as typeof fetch;

    let caughtError: unknown;
    try {
      await submitToFacilitator({ payload: {} }, { scheme: 'exact' });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(FacilitatorError);
    expect((caughtError as Error).message).toContain('All facilitators failed');
  });

  it('should not retry on 4xx client errors', async () => {
    let fetchCount = 0;
    globalThis.fetch = vi.fn(async () => {
      fetchCount++;
      return {
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          errorMessage: 'Invalid payment payload',
        }),
      };
    }) as unknown as typeof fetch;

    await expect(
      submitToFacilitator({ payload: {} }, { scheme: 'exact' }),
    ).rejects.toThrow('Invalid payment payload');

    // CDP: 1 call (no retries for 4xx) + PayAI: 1 call (no retries for 4xx)
    expect(fetchCount).toBe(2);
  });

  it('should use custom facilitator URL when provided', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        transaction: 'custom-sig',
        network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      }),
    }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await submitToFacilitator(
      { payload: {} },
      { scheme: 'exact' },
      'https://custom-facilitator.example.com',
    );

    expect(result.success).toBe(true);
    expect(result.facilitator).toBe('custom');

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('custom-facilitator.example.com');
  });

  it('should handle facilitator returning success=false', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: false,
        errorReason: 'insufficient_funds',
        errorMessage: 'Payer has insufficient funds',
      }),
    })) as unknown as typeof fetch;

    await expect(
      submitToFacilitator({ payload: {} }, { scheme: 'exact' }),
    ).rejects.toThrow('insufficient funds');
  });
});

// ---------------------------------------------------------------------------
// FacilitatorError
// ---------------------------------------------------------------------------

describe('FacilitatorError', () => {
  it('should include status code', () => {
    const error = new FacilitatorError('Bad request', 400);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Bad request');
    expect(error.name).toBe('FacilitatorError');
  });
});
