/**
 * Tests for src/lib/x402/kora-facilitator-bridge.ts
 *
 * Hono router implementing the x402 facilitator protocol over Kora.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const {
  mockIsKoraConfigured,
  mockKoraSignAndSend,
  mockKoraGetSupportedTokens,
  mockKoraGetConfig,
} = vi.hoisted(() => ({
  mockIsKoraConfigured: vi.fn(() => true),
  mockKoraSignAndSend: vi.fn(async () => ({ signature: 'mockedSig123' })),
  mockKoraGetSupportedTokens: vi.fn(async () => [
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  ]),
  mockKoraGetConfig: vi.fn(async () => ({ fee_payers: ['fakePayer'] })),
}));

// ---------------------------------------------------------------------------
// Module mocks — at file level
// ---------------------------------------------------------------------------

vi.mock('./kora-client', () => ({
  isKoraConfigured: mockIsKoraConfigured,
  koraSignAndSend: mockKoraSignAndSend,
  koraGetSupportedTokens: mockKoraGetSupportedTokens,
  koraGetConfig: mockKoraGetConfig,
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import the router under test — AFTER vi.mock() calls
// ---------------------------------------------------------------------------

import { koraFacilitatorRoutes } from './kora-facilitator-bridge';

// ---------------------------------------------------------------------------
// Constants used across tests
// ---------------------------------------------------------------------------

const USDC_MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_DEVNET_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const SOLANA_DEVNET_CAIP2 = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
const TREASURY = 'TreasuryAddress11111111111111111111111111111';
const UNKNOWN_MINT = 'UnknownMint1111111111111111111111111111111111';

/**
 * Build a minimal valid VerifyBody / SettleBody request payload.
 */
function buildBody(overrides?: {
  asset?: string;
  payTo?: string;
  amount?: string;
  signedTransaction?: string;
}) {
  return {
    paymentPayload: {
      x402Version: 1,
      payload: {
        signedTransaction: overrides?.signedTransaction ?? 'base64SignedTx==',
      },
    },
    paymentRequirements: {
      scheme: 'exact',
      network: 'solana-devnet',
      asset: overrides?.asset ?? USDC_DEVNET_MINT,
      amount: overrides?.amount ?? '1000000',
      payTo: overrides?.payTo ?? TREASURY,
    },
  };
}

/**
 * POST helper — sends a JSON body to the Hono router under test.
 */
async function postJson(path: string, body: unknown): Promise<Response> {
  return koraFacilitatorRoutes.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockIsKoraConfigured.mockReturnValue(true);
  mockKoraSignAndSend.mockResolvedValue({ signature: 'mockedSig123' });
  mockKoraGetSupportedTokens.mockResolvedValue([USDC_MAINNET_MINT]);
  mockKoraGetConfig.mockResolvedValue({ fee_payers: ['fakePayer'] });

  // Default: no treasury restriction, devnet
  vi.stubEnv('PLATFORM_TREASURY_ADDRESS', '');
  vi.stubEnv('SOLANA_NETWORK', 'devnet');
  vi.stubEnv('NEXT_PUBLIC_SOLANA_NETWORK', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /x402/supported
// ---------------------------------------------------------------------------

describe('GET /x402/supported', () => {
  it('should return 200 with correct CAIP-2 devnet chain and Kora token list when Kora is configured', async () => {
    mockIsKoraConfigured.mockReturnValue(true);
    mockKoraGetSupportedTokens.mockResolvedValue([USDC_MAINNET_MINT, USDC_DEVNET_MINT]);

    const res = await koraFacilitatorRoutes.request('/supported');

    expect(res.status).toBe(200);
    const body = await res.json() as { schemes: { exact: Record<string, { tokens: string[] }> } };
    expect(body.schemes.exact[SOLANA_DEVNET_CAIP2]).toBeDefined();
    expect(body.schemes.exact[SOLANA_DEVNET_CAIP2].tokens).toContain(USDC_MAINNET_MINT);
    expect(body.schemes.exact[SOLANA_DEVNET_CAIP2].tokens).toContain(USDC_DEVNET_MINT);
    expect(mockKoraGetSupportedTokens).toHaveBeenCalledOnce();
  });

  it('should return fallback USDC devnet mint when Kora is NOT configured', async () => {
    mockIsKoraConfigured.mockReturnValue(false);

    const res = await koraFacilitatorRoutes.request('/supported');

    expect(res.status).toBe(200);
    const body = await res.json() as { schemes: { exact: Record<string, { tokens: string[] }> } };
    expect(body.schemes.exact[SOLANA_DEVNET_CAIP2]).toBeDefined();
    expect(body.schemes.exact[SOLANA_DEVNET_CAIP2].tokens).toEqual([USDC_DEVNET_MINT]);
    expect(mockKoraGetSupportedTokens).not.toHaveBeenCalled();
  });

  it('should return mainnet CAIP-2 and mainnet USDC when SOLANA_NETWORK is mainnet-beta', async () => {
    // isMainnet() uses: NEXT_PUBLIC_SOLANA_NETWORK ?? SOLANA_NETWORK
    // ?? only bypasses null/undefined — NOT empty string. We must delete the
    // NEXT_PUBLIC env var so the fallback SOLANA_NETWORK='mainnet-beta' is used.
    delete process.env.NEXT_PUBLIC_SOLANA_NETWORK;
    vi.stubEnv('SOLANA_NETWORK', 'mainnet-beta');
    mockIsKoraConfigured.mockReturnValue(false);

    const res = await koraFacilitatorRoutes.request('/supported');

    expect(res.status).toBe(200);
    const body = await res.json() as { schemes: { exact: Record<string, { tokens: string[] }> } };
    expect(body.schemes.exact[SOLANA_MAINNET_CAIP2]).toBeDefined();
    expect(body.schemes.exact[SOLANA_MAINNET_CAIP2].tokens).toEqual([USDC_MAINNET_MINT]);
  });

  it('should fall back to hardcoded USDC mint when koraGetSupportedTokens throws', async () => {
    mockIsKoraConfigured.mockReturnValue(true);
    mockKoraGetSupportedTokens.mockRejectedValue(new Error('Kora unreachable'));

    const res = await koraFacilitatorRoutes.request('/supported');

    expect(res.status).toBe(200);
    const body = await res.json() as { schemes: { exact: Record<string, { tokens: string[] }> } };
    // Falls back to devnet USDC
    expect(body.schemes.exact[SOLANA_DEVNET_CAIP2].tokens).toEqual([USDC_DEVNET_MINT]);
  });

  it('should use koraGetSupportedTokens result only when non-empty', async () => {
    mockIsKoraConfigured.mockReturnValue(true);
    // Kora returns empty list → should stay on fallback
    mockKoraGetSupportedTokens.mockResolvedValue([]);

    const res = await koraFacilitatorRoutes.request('/supported');

    expect(res.status).toBe(200);
    const body = await res.json() as { schemes: { exact: Record<string, { tokens: string[] }> } };
    expect(body.schemes.exact[SOLANA_DEVNET_CAIP2].tokens).toEqual([USDC_DEVNET_MINT]);
  });
});

// ---------------------------------------------------------------------------
// POST /x402/verify
// ---------------------------------------------------------------------------

describe('POST /x402/verify', () => {
  describe('governance checks', () => {
    it('should return { isValid: true } for a valid USDC payment to any recipient when no treasury set', async () => {
      vi.stubEnv('PLATFORM_TREASURY_ADDRESS', '');

      const res = await postJson('/verify', buildBody({ asset: USDC_DEVNET_MINT }));

      expect(res.status).toBe(200);
      const body = await res.json() as { isValid: boolean };
      expect(body.isValid).toBe(true);
    });

    it('should return { isValid: true } when recipient matches treasury', async () => {
      vi.stubEnv('PLATFORM_TREASURY_ADDRESS', TREASURY);

      const res = await postJson('/verify', buildBody({
        asset: USDC_DEVNET_MINT,
        payTo: TREASURY,
      }));

      expect(res.status).toBe(200);
      const body = await res.json() as { isValid: boolean };
      expect(body.isValid).toBe(true);
    });

    it('should return { isValid: false } for unknown token mint', async () => {
      const res = await postJson('/verify', buildBody({ asset: UNKNOWN_MINT }));

      expect(res.status).toBe(200);
      const body = await res.json() as { isValid: boolean; invalidReason: string };
      expect(body.isValid).toBe(false);
      expect(body.invalidReason).toContain(UNKNOWN_MINT);
    });

    it('should return { isValid: false } when amount exceeds 10 USDC cap', async () => {
      // DEFAULT_MAX_AMOUNT = '10000000' (10 USDC with 6 decimals)
      const res = await postJson('/verify', buildBody({ amount: '10000001' }));

      expect(res.status).toBe(200);
      const body = await res.json() as { isValid: boolean; invalidReason: string };
      expect(body.isValid).toBe(false);
      expect(body.invalidReason).toContain('exceeds cap');
    });

    it('should return { isValid: true } when amount equals the cap exactly', async () => {
      const res = await postJson('/verify', buildBody({ amount: '10000000' }));

      expect(res.status).toBe(200);
      const body = await res.json() as { isValid: boolean };
      expect(body.isValid).toBe(true);
    });

    it('should return { isValid: false } for unknown recipient when treasury is configured', async () => {
      vi.stubEnv('PLATFORM_TREASURY_ADDRESS', TREASURY);

      const res = await postJson('/verify', buildBody({
        asset: USDC_DEVNET_MINT,
        payTo: 'UnknownRecipient111111111111111111111111111',
      }));

      expect(res.status).toBe(200);
      const body = await res.json() as { isValid: boolean };
      expect(body.isValid).toBe(false);
    });
  });

  describe('input validation', () => {
    it('should return 400 when required fields are missing', async () => {
      const res = await postJson('/verify', { paymentPayload: {} });

      expect(res.status).toBe(400);
      const body = await res.json() as { isValid: boolean; invalidReason: string };
      expect(body.isValid).toBe(false);
      expect(body.invalidReason).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when paymentRequirements is missing', async () => {
      const res = await postJson('/verify', {
        paymentPayload: { payload: { signedTransaction: 'tx==' } },
      });

      expect(res.status).toBe(400);
    });

    it('should return 400 when paymentPayload.payload is missing', async () => {
      const res = await postJson('/verify', {
        paymentPayload: {},
        paymentRequirements: {
          scheme: 'exact',
          network: 'solana-devnet',
          asset: USDC_DEVNET_MINT,
          amount: '1000000',
          payTo: TREASURY,
        },
      });

      expect(res.status).toBe(400);
    });
  });
});

// ---------------------------------------------------------------------------
// POST /x402/settle
// ---------------------------------------------------------------------------

describe('POST /x402/settle', () => {
  describe('successful settlement', () => {
    it('should call koraSignAndSend and return { success: true, txHash }', async () => {
      mockKoraSignAndSend.mockResolvedValue({ signature: 'txSig123' });

      const res = await postJson('/settle', buildBody());

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; txHash: string };
      expect(body.success).toBe(true);
      expect(body.txHash).toBe('txSig123');
      expect(mockKoraSignAndSend).toHaveBeenCalledWith('base64SignedTx==');
    });

    it('should include transaction field in response for @x402/core compatibility', async () => {
      mockKoraSignAndSend.mockResolvedValue({ signature: 'txSig456' });

      const res = await postJson('/settle', buildBody());

      const body = await res.json() as { transaction: string };
      expect(body.transaction).toBe('txSig456');
    });

    it('should include network field from paymentRequirements in response', async () => {
      const res = await postJson('/settle', buildBody());

      const body = await res.json() as { network: string };
      expect(body.network).toBe('solana-devnet');
    });

    it('should accept "transaction" field name in payload (alternate field name)', async () => {
      const bodyWithAltField = {
        paymentPayload: {
          x402Version: 1,
          payload: {
            transaction: 'altFieldTx==',
          },
        },
        paymentRequirements: {
          scheme: 'exact',
          network: 'solana-devnet',
          asset: USDC_DEVNET_MINT,
          amount: '1000000',
          payTo: TREASURY,
        },
      };

      mockKoraSignAndSend.mockResolvedValue({ signature: 'altSig' });

      const res = await postJson('/settle', bodyWithAltField);

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean };
      expect(body.success).toBe(true);
      expect(mockKoraSignAndSend).toHaveBeenCalledWith('altFieldTx==');
    });
  });

  describe('governance failures', () => {
    it('should return { success: false, errorReason: GOVERNANCE_FAILED } for unknown token mint', async () => {
      const res = await postJson('/settle', buildBody({ asset: UNKNOWN_MINT }));

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; errorReason: string };
      expect(body.success).toBe(false);
      expect(body.errorReason).toBe('GOVERNANCE_FAILED');
      expect(mockKoraSignAndSend).not.toHaveBeenCalled();
    });

    it('should return { success: false, errorReason: GOVERNANCE_FAILED } when amount exceeds cap', async () => {
      const res = await postJson('/settle', buildBody({ amount: '99999999' }));

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; errorReason: string; errorMessage: string };
      expect(body.success).toBe(false);
      expect(body.errorReason).toBe('GOVERNANCE_FAILED');
      expect(body.errorMessage).toContain('exceeds cap');
      expect(mockKoraSignAndSend).not.toHaveBeenCalled();
    });

    it('should return { success: false, errorReason: GOVERNANCE_FAILED } for wrong recipient when treasury set', async () => {
      vi.stubEnv('PLATFORM_TREASURY_ADDRESS', TREASURY);

      const res = await postJson('/settle', buildBody({
        payTo: 'WrongRecipient11111111111111111111111111111',
      }));

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; errorReason: string };
      expect(body.success).toBe(false);
      expect(body.errorReason).toBe('GOVERNANCE_FAILED');
      expect(mockKoraSignAndSend).not.toHaveBeenCalled();
    });
  });

  describe('Kora not configured', () => {
    it('should return { success: false, errorReason: SETTLEMENT_FAILED } when Kora is not configured', async () => {
      mockIsKoraConfigured.mockReturnValue(false);

      const res = await postJson('/settle', buildBody());

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; errorReason: string; errorMessage: string };
      expect(body.success).toBe(false);
      expect(body.errorReason).toBe('SETTLEMENT_FAILED');
      expect(body.errorMessage).toContain('KORA_RPC_URL');
      expect(mockKoraSignAndSend).not.toHaveBeenCalled();
    });
  });

  describe('Kora RPC failure', () => {
    it('should return { success: false, errorReason: SETTLEMENT_FAILED } when koraSignAndSend throws', async () => {
      mockKoraSignAndSend.mockRejectedValue(new Error('Kora network error'));

      const res = await postJson('/settle', buildBody());

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; errorReason: string; errorMessage: string };
      expect(body.success).toBe(false);
      expect(body.errorReason).toBe('SETTLEMENT_FAILED');
      // The bridge returns an opaque message to prevent internal URL / config disclosure
      expect(body.errorMessage).toBe('Kora settlement service unavailable');
    });
  });

  describe('invalid payload', () => {
    it('should return { success: false, errorReason: INVALID_PAYLOAD } when no signedTransaction in payload', async () => {
      const noTxBody = {
        paymentPayload: {
          x402Version: 1,
          payload: {
            // Neither 'signedTransaction' nor 'transaction' present
            other_field: 'value',
          },
        },
        paymentRequirements: {
          scheme: 'exact',
          network: 'solana-devnet',
          asset: USDC_DEVNET_MINT,
          amount: '1000000',
          payTo: TREASURY,
        },
      };

      const res = await postJson('/settle', noTxBody);

      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; errorReason: string };
      expect(body.success).toBe(false);
      expect(body.errorReason).toBe('INVALID_PAYLOAD');
      expect(mockKoraSignAndSend).not.toHaveBeenCalled();
    });

    it('should return 400 VALIDATION_ERROR when required schema fields are missing', async () => {
      const res = await postJson('/settle', { paymentPayload: {} });

      expect(res.status).toBe(400);
      const body = await res.json() as { success: boolean; errorReason: string };
      expect(body.success).toBe(false);
      expect(body.errorReason).toBe('VALIDATION_ERROR');
    });
  });
});

// ---------------------------------------------------------------------------
// Integration — full flow describe block
// ---------------------------------------------------------------------------

describe('integration: full flow', () => {
  it('should complete settlement when governance passes and Kora is reachable', async () => {
    vi.stubEnv('PLATFORM_TREASURY_ADDRESS', TREASURY);
    mockIsKoraConfigured.mockReturnValue(true);
    mockKoraSignAndSend.mockResolvedValue({ signature: 'integrationSig' });

    const res = await postJson('/settle', buildBody({
      asset: USDC_DEVNET_MINT,
      payTo: TREASURY,
      amount: '5000000',
    }));

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; txHash: string };
    expect(body.success).toBe(true);
    expect(body.txHash).toBe('integrationSig');
    expect(mockKoraSignAndSend).toHaveBeenCalledWith('base64SignedTx==');
  });

  it('should NOT call Kora when governance fails — Kora remains uninvoked', async () => {
    vi.stubEnv('PLATFORM_TREASURY_ADDRESS', TREASURY);
    mockIsKoraConfigured.mockReturnValue(true);

    const res = await postJson('/settle', buildBody({
      asset: UNKNOWN_MINT, // governance will reject this
    }));

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; errorReason: string };
    expect(body.success).toBe(false);
    expect(body.errorReason).toBe('GOVERNANCE_FAILED');
    // Kora must NOT be called — never reach settlement with bad token
    expect(mockKoraSignAndSend).not.toHaveBeenCalled();
  });

  it('should return graceful error response when Kora is unreachable (throws)', async () => {
    mockIsKoraConfigured.mockReturnValue(true);
    mockKoraSignAndSend.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await postJson('/settle', buildBody());

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; errorReason: string; errorMessage: string };
    expect(body.success).toBe(false);
    expect(body.errorReason).toBe('SETTLEMENT_FAILED');
    // The bridge intentionally returns an opaque message to prevent internal error
    // details (including KORA_RPC_URL) from leaking to the caller
    expect(body.errorMessage).toBe('Kora settlement service unavailable');
  });

  it('should complete /verify check independently of Kora availability', async () => {
    // Even with Kora down, /verify should still evaluate governance
    mockIsKoraConfigured.mockReturnValue(false);

    const res = await postJson('/verify', buildBody({ asset: USDC_DEVNET_MINT }));

    expect(res.status).toBe(200);
    const body = await res.json() as { isValid: boolean };
    // Governance passes (valid mint, amount within cap, no treasury restriction)
    expect(body.isValid).toBe(true);
  });

  it('should correctly use NEXT_PUBLIC_SOLANA_NETWORK for network resolution', async () => {
    // NEXT_PUBLIC_SOLANA_NETWORK takes precedence when set to a non-empty string
    vi.stubEnv('NEXT_PUBLIC_SOLANA_NETWORK', 'mainnet-beta');
    delete process.env.SOLANA_NETWORK;
    mockIsKoraConfigured.mockReturnValue(false);

    const res = await koraFacilitatorRoutes.request('/supported');

    expect(res.status).toBe(200);
    const body = await res.json() as { schemes: { exact: Record<string, { tokens: string[] }> } };
    expect(body.schemes.exact[SOLANA_MAINNET_CAIP2]).toBeDefined();
    expect(body.schemes.exact[SOLANA_MAINNET_CAIP2].tokens).toEqual([USDC_MAINNET_MINT]);
  });
});
