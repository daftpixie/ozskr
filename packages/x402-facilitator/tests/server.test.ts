import { describe, it, expect, vi, afterEach } from 'vitest';
import type { FacilitatorApp } from '../src/server.js';

const {
  mockRegisterExactSvmScheme,
  mockToFacilitatorSvmSigner,
  mockX402Facilitator,
  mockCreateSolanaRpc,
} = vi.hoisted(() => {
  const mockRegisterExactSvmScheme = vi.fn().mockReturnValue(undefined);
  const mockToFacilitatorSvmSigner = vi.fn().mockReturnValue({
    getAddresses: () => [],
    signTransaction: vi.fn(),
    simulateTransaction: vi.fn(),
    sendTransaction: vi.fn(),
    confirmTransaction: vi.fn(),
  });

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
    this.settle = vi.fn();
    return this;
  });

  const mockCreateSolanaRpc = vi.fn().mockReturnValue({
    getAccountInfo: vi.fn().mockReturnValue({
      send: vi.fn().mockResolvedValue({ value: null }),
    }),
    getBalance: vi.fn().mockReturnValue({
      send: vi.fn().mockResolvedValue({ value: 1000000000n }),
    }),
  });

  return { mockRegisterExactSvmScheme, mockToFacilitatorSvmSigner, mockX402Facilitator, mockCreateSolanaRpc };
});

vi.mock('@x402/core/facilitator', () => ({
  x402Facilitator: mockX402Facilitator,
}));

vi.mock('@x402/svm', () => ({
  toFacilitatorSvmSigner: mockToFacilitatorSvmSigner,
  SOLANA_DEVNET_CAIP2: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  SOLANA_MAINNET_CAIP2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  SOLANA_TESTNET_CAIP2: 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z',
}));

vi.mock('@x402/svm/exact/facilitator', () => ({
  registerExactSvmScheme: mockRegisterExactSvmScheme,
}));

vi.mock('@solana/kit', () => ({
  createSolanaRpc: mockCreateSolanaRpc,
}));

import { createFacilitatorApp } from '../src/server.js';
import type { Config } from '../src/config.js';

const mockSigner = {
  address: 'FakeAddress1111111111111111111111111111111111' as const,
  keyPair: {} as CryptoKeyPair,
  signMessages: vi.fn(),
  signTransactions: vi.fn(),
} as unknown as Parameters<typeof createFacilitatorApp>[1];

const testConfig: Config = {
  solanaRpcUrl: 'https://api.devnet.solana.com',
  facilitatorKeypairPath: '/tmp/test-keypair.json',
  facilitatorPassphrase: 'test-passphrase-long-enough',
  solanaNetwork: 'devnet',
  scryptMode: 'fast',
  host: '0.0.0.0',
  port: 4020,
  logLevel: 'info',
  governance: {
    rateLimitPerMinute: 60,
  },
};

describe('createFacilitatorApp', () => {
  let appResult: FacilitatorApp | undefined;

  afterEach(() => {
    appResult?.destroy();
    appResult = undefined;
  });

  it('creates app successfully', async () => {
    appResult = await createFacilitatorApp(testConfig, mockSigner);
    expect(appResult.app).toBeDefined();
    expect(appResult.facilitator).toBeDefined();
    expect(appResult.destroy).toBeInstanceOf(Function);
  });

  it('health endpoint returns 200', async () => {
    appResult = await createFacilitatorApp(testConfig, mockSigner);
    const res = await appResult.app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.network).toBe('devnet');
    expect(body.version).toBe('0.1.0-beta');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.replayGuardSize).toBe('number');
  });

  it('supported endpoint returns facilitator capabilities', async () => {
    appResult = await createFacilitatorApp(testConfig, mockSigner);
    const res = await appResult.app.request('/supported');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('kinds');
    expect(body).toHaveProperty('extensions');
  });

  it('unknown routes return 404', async () => {
    appResult = await createFacilitatorApp(testConfig, mockSigner);
    const res = await appResult.app.request('/nonexistent');
    expect(res.status).toBe(404);
  });

  it('destroy cleans up resources', async () => {
    appResult = await createFacilitatorApp(testConfig, mockSigner);
    expect(() => appResult!.destroy()).not.toThrow();
  });

  it('registers SVM scheme with correct network', async () => {
    appResult = await createFacilitatorApp(testConfig, mockSigner);
    expect(mockRegisterExactSvmScheme).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        networks: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      }),
    );
  });
});
