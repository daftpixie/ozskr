import { describe, it, expect, vi, afterEach } from 'vitest';
import type { FacilitatorApp } from '../../src/server.js';

const { mockVerify, mockX402Facilitator } = vi.hoisted(() => {
  const mockVerify = vi.fn();
  const mockX402Facilitator = vi.fn(function (this: Record<string, unknown>) {
    this.register = vi.fn().mockReturnThis();
    this.onBeforeVerify = vi.fn().mockReturnThis();
    this.onAfterVerify = vi.fn().mockReturnThis();
    this.onVerifyFailure = vi.fn().mockReturnThis();
    this.onBeforeSettle = vi.fn().mockReturnThis();
    this.onAfterSettle = vi.fn().mockReturnThis();
    this.onSettleFailure = vi.fn().mockReturnThis();
    this.getSupported = vi.fn().mockReturnValue({ kinds: [], extensions: [], signers: {} });
    this.verify = mockVerify;
    this.settle = vi.fn();
    return this;
  });
  return { mockVerify, mockX402Facilitator };
});

vi.mock('@x402/core/facilitator', () => ({
  x402Facilitator: mockX402Facilitator,
}));

vi.mock('@x402/svm', () => ({
  toFacilitatorSvmSigner: vi.fn().mockReturnValue({}),
  SOLANA_DEVNET_CAIP2: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  SOLANA_MAINNET_CAIP2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  SOLANA_TESTNET_CAIP2: 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z',
}));

vi.mock('@x402/svm/exact/facilitator', () => ({
  registerExactSvmScheme: vi.fn(),
}));

vi.mock('@solana/kit', () => ({
  createSolanaRpc: vi.fn().mockReturnValue({
    getAccountInfo: vi.fn().mockReturnValue({ send: vi.fn().mockResolvedValue({ value: null }) }),
    getBalance: vi.fn().mockReturnValue({ send: vi.fn().mockResolvedValue({ value: 1000000000n }) }),
  }),
}));

import { createFacilitatorApp } from '../../src/server.js';
import type { Config } from '../../src/config.js';

const testConfig: Config = {
  solanaRpcUrl: 'https://api.devnet.solana.com',
  facilitatorKeypairPath: '/tmp/test.json',
  facilitatorPassphrase: 'test-passphrase-long-enough',
  solanaNetwork: 'devnet',
  scryptMode: 'fast',
  host: '0.0.0.0',
  port: 4020,
  logLevel: 'info',
  governance: { rateLimitPerMinute: 60 },
};

const mockSigner = {
  address: 'FakeAddress1111111111111111111111111111111111' as const,
} as unknown as Parameters<typeof createFacilitatorApp>[1];

const validPayload = {
  paymentPayload: {
    x402Version: 2,
    resource: { url: 'https://example.com', description: 'test', mimeType: 'text/html' },
    accepted: { scheme: 'exact', network: 'solana:devnet', asset: 'USDC', amount: '1000', payTo: 'addr', maxTimeoutSeconds: 60, extra: {} },
    payload: { transaction: 'base64tx' },
  },
  paymentRequirements: {
    scheme: 'exact',
    network: 'solana:devnet',
    asset: 'USDC',
    amount: '1000',
    payTo: 'addr',
    maxTimeoutSeconds: 60,
    extra: {},
  },
};

describe('POST /verify', () => {
  let appResult: FacilitatorApp | undefined;

  afterEach(() => {
    appResult?.destroy();
    appResult = undefined;
    mockVerify.mockReset();
  });

  it('returns 200 for valid verification', async () => {
    mockVerify.mockResolvedValueOnce({ isValid: true, payer: 'some-payer' });
    appResult = await createFacilitatorApp(testConfig, mockSigner);

    const res = await appResult.app.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isValid).toBe(true);
  });

  it('returns 400 for invalid verification', async () => {
    mockVerify.mockResolvedValueOnce({
      isValid: false,
      invalidReason: 'EXPIRED',
      invalidMessage: 'Payment has expired',
    });
    appResult = await createFacilitatorApp(testConfig, mockSigner);

    const res = await appResult.app.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.isValid).toBe(false);
  });

  it('returns 400 when payload is missing', async () => {
    appResult = await createFacilitatorApp(testConfig, mockSigner);

    const res = await appResult.app.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.issues).toBeDefined();
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it('returns 400 for governance denial via verify result', async () => {
    mockVerify.mockResolvedValueOnce({
      isValid: false,
      invalidReason: 'GOVERNANCE_DENIED',
      invalidMessage: 'Token not allowed',
    });
    appResult = await createFacilitatorApp(testConfig, mockSigner);

    const res = await appResult.app.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    expect(res.status).toBe(400);
  });

  it('handles VerifyError from facilitator', async () => {
    const { VerifyError } = await import('@x402/core/types');
    mockVerify.mockRejectedValueOnce(
      new VerifyError(422, { isValid: false, invalidReason: 'MALFORMED', invalidMessage: 'Bad tx' }),
    );
    appResult = await createFacilitatorApp(testConfig, mockSigner);

    const res = await appResult.app.request('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.isValid).toBe(false);
    expect(body.invalidReason).toBe('MALFORMED');
  });
});
