import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encodePaymentRequiredHeader } from '@x402/core/http';
import {
  makeX402Request,
  retryWithPayment,
  validateRequirement,
  type ParsedPaymentRequirement,
} from '../src/lib/x402-client.js';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(response: {
  status: number;
  headers?: Record<string, string>;
  body?: string;
}) {
  globalThis.fetch = vi.fn(async () => ({
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    headers: new Headers(response.headers ?? {}),
    text: async () => response.body ?? '',
    json: async () => JSON.parse(response.body ?? '{}'),
  })) as unknown as typeof fetch;
}

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const V2_PAYMENT_REQUIRED = {
  x402Version: 2,
  error: 'Payment Required',
  resource: { url: 'https://api.example.com/data' },
  accepts: [{
    scheme: 'exact',
    network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    amount: '1000000',
    asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    payTo: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    maxTimeoutSeconds: 30,
  }],
};

// ---------------------------------------------------------------------------
// makeX402Request
// ---------------------------------------------------------------------------

describe('makeX402Request', () => {
  it('should return response directly for non-402 status', async () => {
    mockFetch({ status: 200, body: 'Hello World' });

    const result = await makeX402Request('https://example.com/free');

    expect(result.paymentRequired).toBe(false);
    if (!result.paymentRequired) {
      expect(result.response.status).toBe(200);
      expect(await result.response.text()).toBe('Hello World');
    }
  });

  it('should parse V2 payment requirements from X-Payment-Required header', async () => {
    const encodedHeader = encodePaymentRequiredHeader(
      V2_PAYMENT_REQUIRED as Parameters<typeof encodePaymentRequiredHeader>[0],
    );

    mockFetch({
      status: 402,
      headers: { 'X-Payment-Required': encodedHeader },
    });

    const result = await makeX402Request('https://api.example.com/data');

    expect(result.paymentRequired).toBe(true);
    if (result.paymentRequired) {
      expect(result.requirements.length).toBeGreaterThan(0);
      expect(result.requirements[0].version).toBe(2);
      expect(result.requirements[0].scheme).toBe('exact');
      expect(result.requirements[0].network).toBe('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1');
      expect(result.requirements[0].amount).toBe('1000000');
      expect(result.requirements[0].payTo).toBe('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
    }
  });

  it('should parse V1 payment requirements from individual headers', async () => {
    mockFetch({
      status: 402,
      headers: {
        'X-Payment-Amount': '500000',
        'X-Payment-Recipient': 'RecipientAddress1234567890123456789',
        'X-Payment-Token': 'TokenMintAddress12345678901234567',
        'X-Payment-Network': 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      },
    });

    const result = await makeX402Request('https://api.example.com/v1-endpoint');

    expect(result.paymentRequired).toBe(true);
    if (result.paymentRequired) {
      expect(result.requirements.length).toBe(1);
      expect(result.requirements[0].version).toBe(1);
      expect(result.requirements[0].amount).toBe('500000');
      expect(result.requirements[0].payTo).toBe('RecipientAddress1234567890123456789');
    }
  });

  it('should return empty requirements for 402 with no parseable headers', async () => {
    mockFetch({
      status: 402,
      headers: {},
    });

    const result = await makeX402Request('https://api.example.com/bare-402');

    expect(result.paymentRequired).toBe(true);
    if (result.paymentRequired) {
      expect(result.requirements).toHaveLength(0);
    }
  });

  it('should handle 404 as non-payment response', async () => {
    mockFetch({ status: 404, body: 'Not Found' });

    const result = await makeX402Request('https://example.com/missing');

    expect(result.paymentRequired).toBe(false);
  });

  it('should handle 500 as non-payment response', async () => {
    mockFetch({ status: 500, body: 'Server Error' });

    const result = await makeX402Request('https://example.com/error');

    expect(result.paymentRequired).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// retryWithPayment
// ---------------------------------------------------------------------------

describe('retryWithPayment', () => {
  it('should include X-Payment-Signature header in retry request', async () => {
    const fetchSpy = vi.fn(async () => ({
      status: 200,
      ok: true,
      headers: new Headers(),
      text: async () => 'Paid content',
    }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const paymentPayload = { x402Version: 2, payload: { transaction: 'base64tx' } };
    const result = await retryWithPayment('https://api.example.com/data', paymentPayload);

    expect(result.response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const callArgs = fetchSpy.mock.calls[0];
    const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
    expect(headers['X-Payment-Signature']).toBeTruthy();
  });

  it('should report settled=true for successful response', async () => {
    mockFetch({ status: 200, body: 'Content' });

    const result = await retryWithPayment('https://api.example.com/data', {});

    expect(result.settled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateRequirement
// ---------------------------------------------------------------------------

describe('validateRequirement', () => {
  const baseReq: ParsedPaymentRequirement = {
    version: 2,
    scheme: 'exact',
    network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    amount: '1000000',
    asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    payTo: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    maxTimeoutSeconds: 30,
    raw: {},
  };

  it('should return null for valid requirement', () => {
    const error = validateRequirement(baseReq, 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1');
    expect(error).toBeNull();
  });

  it('should reject zero amount', () => {
    const error = validateRequirement({ ...baseReq, amount: '0' }, '');
    expect(error).toContain('zero');
  });

  it('should reject missing payTo', () => {
    const error = validateRequirement({ ...baseReq, payTo: '' }, '');
    expect(error).toContain('missing');
  });

  it('should reject invalid SVM address', () => {
    const error = validateRequirement({ ...baseReq, payTo: 'not-a-valid-address!@#' }, '');
    expect(error).toContain('Invalid recipient');
  });

  it('should reject non-Solana network', () => {
    const error = validateRequirement({ ...baseReq, network: 'ethereum:1' }, '');
    expect(error).toContain('Unsupported network');
  });

  it('should reject network mismatch', () => {
    const error = validateRequirement(
      { ...baseReq, network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' },
      'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    );
    expect(error).toContain('mismatch');
  });
});
