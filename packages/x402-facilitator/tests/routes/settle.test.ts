import { describe, it, expect, vi, afterEach } from 'vitest';

const { mockSettle, mockX402Facilitator } = vi.hoisted(() => {
  const mockSettle = vi.fn();
  const mockX402Facilitator = vi.fn(function (this: Record<string, unknown>) {
    this.register = vi.fn().mockReturnThis();
    this.onBeforeVerify = vi.fn().mockReturnThis();
    this.onAfterVerify = vi.fn().mockReturnThis();
    this.onVerifyFailure = vi.fn().mockReturnThis();
    this.onBeforeSettle = vi.fn().mockReturnThis();
    this.onAfterSettle = vi.fn().mockReturnThis();
    this.onSettleFailure = vi.fn().mockReturnThis();
    this.getSupported = vi.fn().mockReturnValue({ kinds: [], extensions: [], signers: {} });
    this.verify = vi.fn();
    this.settle = mockSettle;
    return this;
  });
  return { mockSettle, mockX402Facilitator };
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

describe('POST /settle', () => {
  let app: ReturnType<typeof createFacilitatorApp>;

  afterEach(() => {
    app?.destroy();
    mockSettle.mockReset();
  });

  it('returns 200 for successful settlement', async () => {
    mockSettle.mockResolvedValueOnce({
      success: true,
      payer: 'payer-addr',
      transaction: 'tx_sig_123',
      network: 'solana:devnet',
    });
    app = createFacilitatorApp(testConfig, mockSigner);

    const res = await app.app.request('/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.transaction).toBe('tx_sig_123');
  });

  it('returns 400 for failed settlement', async () => {
    mockSettle.mockResolvedValueOnce({
      success: false,
      errorReason: 'INSUFFICIENT_FUNDS',
      errorMessage: 'Not enough tokens',
      transaction: '',
      network: 'solana:devnet',
    });
    app = createFacilitatorApp(testConfig, mockSigner);

    const res = await app.app.request('/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 400 when payload is missing', async () => {
    app = createFacilitatorApp(testConfig, mockSigner);

    const res = await app.app.request('/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_REQUEST');
  });

  it('handles SettleError from facilitator', async () => {
    const { SettleError } = await import('@x402/core/types');
    mockSettle.mockRejectedValueOnce(
      new SettleError(500, {
        success: false,
        errorReason: 'TX_FAILED',
        errorMessage: 'Transaction simulation failed',
        transaction: '',
        network: 'solana:devnet' as `${string}:${string}`,
      }),
    );
    app = createFacilitatorApp(testConfig, mockSigner);

    const res = await app.app.request('/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.errorReason).toBe('TX_FAILED');
  });

  it('returns 400 for governance denial via settle result', async () => {
    mockSettle.mockResolvedValueOnce({
      success: false,
      errorReason: 'GOVERNANCE_DENIED',
      errorMessage: 'Rate limit exceeded',
      transaction: '',
      network: 'solana:devnet',
    });
    app = createFacilitatorApp(testConfig, mockSigner);

    const res = await app.app.request('/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    expect(res.status).toBe(400);
  });

  it('handles multiple settlements correctly', async () => {
    mockSettle
      .mockResolvedValueOnce({
        success: true, payer: 'p1', transaction: 'tx_1', network: 'solana:devnet',
      })
      .mockResolvedValueOnce({
        success: true, payer: 'p2', transaction: 'tx_2', network: 'solana:devnet',
      });

    app = createFacilitatorApp(testConfig, mockSigner);

    const res1 = await app.app.request('/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });
    const res2 = await app.app.request('/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});
