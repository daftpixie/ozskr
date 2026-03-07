/**
 * Tests for src/lib/x402/kora-client.ts
 *
 * Kora RPC Client — singleton wrapper around @solana/kora's KoraClient.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state — must be created before vi.mock() calls
// ---------------------------------------------------------------------------

const {
  mockSignAndSendTransaction,
  mockSignTransaction,
  mockGetSupportedTokens,
  mockGetConfig,
  MockKoraClient,
} = vi.hoisted(() => {
  const mockSignAndSendTransaction = vi.fn();
  const mockSignTransaction = vi.fn();
  const mockGetSupportedTokens = vi.fn();
  const mockGetConfig = vi.fn();

  // Constructor mock — must use regular function (not arrow) for Vitest 4
  const MockKoraClient = vi.fn(function (this: unknown) {
    return {
      signAndSendTransaction: mockSignAndSendTransaction,
      signTransaction: mockSignTransaction,
      getSupportedTokens: mockGetSupportedTokens,
      getConfig: mockGetConfig,
    };
  });

  return {
    mockSignAndSendTransaction,
    mockSignTransaction,
    mockGetSupportedTokens,
    mockGetConfig,
    MockKoraClient,
  };
});

// ---------------------------------------------------------------------------
// Module mocks — must be at file level
// ---------------------------------------------------------------------------

vi.mock('@solana/kora', () => ({
  KoraClient: MockKoraClient,
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
// Import the module under test — AFTER vi.mock() declarations
// ---------------------------------------------------------------------------

// The module uses a process-level singleton. We use vi.resetModules() in
// beforeEach to clear the singleton between tests.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function importFresh() {
  // Reset the singleton by re-importing the module fresh
  const mod = await import('./kora-client?t=' + Date.now());
  return mod;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('kora-client', () => {
  beforeEach(() => {
    vi.resetModules();
    MockKoraClient.mockClear();
    mockSignAndSendTransaction.mockReset();
    mockSignTransaction.mockReset();
    mockGetSupportedTokens.mockReset();
    mockGetConfig.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // -------------------------------------------------------------------------
  // isKoraConfigured()
  // -------------------------------------------------------------------------

  describe('isKoraConfigured()', () => {
    it('should return false when KORA_RPC_URL is not set', async () => {
      vi.stubEnv('KORA_RPC_URL', '');
      const { isKoraConfigured } = await importFresh();
      expect(isKoraConfigured()).toBe(false);
    });

    it('should return true when KORA_RPC_URL is set', async () => {
      vi.stubEnv('KORA_RPC_URL', 'http://localhost:8080');
      const { isKoraConfigured } = await importFresh();
      expect(isKoraConfigured()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // koraSignAndSend()
  // -------------------------------------------------------------------------

  describe('koraSignAndSend()', () => {
    it('should call KoraClient.signAndSendTransaction with correct params and return { signature }', async () => {
      vi.stubEnv('KORA_RPC_URL', 'http://localhost:8080');
      mockSignAndSendTransaction.mockResolvedValue({
        signed_transaction: 'base64SignedTx==',
        signature: 'onChainSig',
      });

      const { koraSignAndSend } = await importFresh();
      const result = await koraSignAndSend('base64Tx==');

      expect(mockSignAndSendTransaction).toHaveBeenCalledWith({
        transaction: 'base64Tx==',
        signer_key: undefined,
      });
      expect(result).toEqual({ signature: 'base64SignedTx==' });
    });

    it('should pass signerKey option through to the RPC call', async () => {
      vi.stubEnv('KORA_RPC_URL', 'http://localhost:8080');
      mockSignAndSendTransaction.mockResolvedValue({
        signed_transaction: 'signedResult==',
        signature: 'onChainSig',
      });

      const { koraSignAndSend } = await importFresh();
      await koraSignAndSend('tx==', { signerKey: 'AgentKey111' });

      expect(mockSignAndSendTransaction).toHaveBeenCalledWith({
        transaction: 'tx==',
        signer_key: 'AgentKey111',
      });
    });

    it('should throw a wrapped error when KoraClient.signAndSendTransaction fails', async () => {
      vi.stubEnv('KORA_RPC_URL', 'http://localhost:8080');
      mockSignAndSendTransaction.mockRejectedValue(new Error('RPC timeout'));

      const { koraSignAndSend } = await importFresh();

      await expect(koraSignAndSend('tx==')).rejects.toThrow(
        'Kora signAndSendTransaction failed: RPC timeout',
      );
    });

    it('should throw if KORA_RPC_URL is not configured', async () => {
      vi.stubEnv('KORA_RPC_URL', '');

      const { koraSignAndSend } = await importFresh();

      await expect(koraSignAndSend('tx==')).rejects.toThrow(
        'Kora is not configured: KORA_RPC_URL environment variable is not set',
      );
    });

    it('should wrap non-Error thrown values as strings', async () => {
      vi.stubEnv('KORA_RPC_URL', 'http://localhost:8080');
      mockSignAndSendTransaction.mockRejectedValue('string error');

      const { koraSignAndSend } = await importFresh();

      await expect(koraSignAndSend('tx==')).rejects.toThrow(
        'Kora signAndSendTransaction failed: string error',
      );
    });
  });

  // -------------------------------------------------------------------------
  // koraSignOnly()
  // -------------------------------------------------------------------------

  describe('koraSignOnly()', () => {
    it('should return { signedTransaction } on success', async () => {
      vi.stubEnv('KORA_RPC_URL', 'http://localhost:8080');
      mockSignTransaction.mockResolvedValue({
        signed_transaction: 'signedOnly==',
        signature: 'sigOnly',
      });

      const { koraSignOnly } = await importFresh();
      const result = await koraSignOnly('unsignedTx==');

      expect(mockSignTransaction).toHaveBeenCalledWith({
        transaction: 'unsignedTx==',
        signer_key: undefined,
      });
      expect(result).toEqual({ signedTransaction: 'signedOnly==' });
    });

    it('should pass signerKey through to the RPC call', async () => {
      vi.stubEnv('KORA_RPC_URL', 'http://localhost:8080');
      mockSignTransaction.mockResolvedValue({
        signed_transaction: 'signed==',
        signature: 'sig',
      });

      const { koraSignOnly } = await importFresh();
      await koraSignOnly('tx==', { signerKey: 'AgentKey222' });

      expect(mockSignTransaction).toHaveBeenCalledWith({
        transaction: 'tx==',
        signer_key: 'AgentKey222',
      });
    });

    it('should throw a wrapped error on KoraClient.signTransaction failure', async () => {
      vi.stubEnv('KORA_RPC_URL', 'http://localhost:8080');
      mockSignTransaction.mockRejectedValue(new Error('server unavailable'));

      const { koraSignOnly } = await importFresh();

      await expect(koraSignOnly('tx==')).rejects.toThrow(
        'Kora signTransaction failed: server unavailable',
      );
    });

    it('should throw if KORA_RPC_URL is not configured', async () => {
      vi.stubEnv('KORA_RPC_URL', '');

      const { koraSignOnly } = await importFresh();

      await expect(koraSignOnly('tx==')).rejects.toThrow(
        'Kora is not configured: KORA_RPC_URL environment variable is not set',
      );
    });
  });

  // -------------------------------------------------------------------------
  // koraGetSupportedTokens()
  // -------------------------------------------------------------------------

  describe('koraGetSupportedTokens()', () => {
    it('should return array of mint strings from getSupportedTokens', async () => {
      vi.stubEnv('KORA_RPC_URL', 'http://localhost:8080');
      mockGetSupportedTokens.mockResolvedValue({
        tokens: [
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        ],
      });

      const { koraGetSupportedTokens } = await importFresh();
      const result = await koraGetSupportedTokens();

      expect(result).toEqual([
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      ]);
    });

    it('should throw a wrapped error on getSupportedTokens failure', async () => {
      vi.stubEnv('KORA_RPC_URL', 'http://localhost:8080');
      mockGetSupportedTokens.mockRejectedValue(new Error('token list unavailable'));

      const { koraGetSupportedTokens } = await importFresh();

      await expect(koraGetSupportedTokens()).rejects.toThrow(
        'Kora getSupportedTokens failed: token list unavailable',
      );
    });

    it('should throw if KORA_RPC_URL is not configured', async () => {
      vi.stubEnv('KORA_RPC_URL', '');

      const { koraGetSupportedTokens } = await importFresh();

      await expect(koraGetSupportedTokens()).rejects.toThrow(
        'Kora is not configured: KORA_RPC_URL environment variable is not set',
      );
    });
  });

  // -------------------------------------------------------------------------
  // koraGetConfig()
  // -------------------------------------------------------------------------

  describe('koraGetConfig()', () => {
    it('should return Config object on success', async () => {
      vi.stubEnv('KORA_RPC_URL', 'http://localhost:8080');
      const mockConfig = {
        fee_payers: ['FeePayerAddress111111111111111111111111111111'],
        validation_config: {
          max_allowed_lamports: 1000000,
          max_signatures: 5,
          allowed_programs: [],
          allowed_tokens: [],
          allowed_spl_paid_tokens: [],
          disallowed_accounts: [],
          price: { type: 'Mock' as const, tokens: [] },
          token2022: { blocked_mint_extensions: [], blocked_account_extensions: [] },
        },
        enabled_methods: {
          get_config: true,
          get_blockhash: true,
          get_supported_tokens: true,
          sign_and_send_transaction: true,
          sign_transaction: true,
          transfer_transaction: true,
          estimate_transaction_fee: true,
          liveness: true,
        },
      };
      mockGetConfig.mockResolvedValue(mockConfig);

      const { koraGetConfig } = await importFresh();
      const result = await koraGetConfig();

      expect(result).toEqual(mockConfig);
      expect(mockGetConfig).toHaveBeenCalledOnce();
    });

    it('should throw a wrapped error on getConfig failure', async () => {
      vi.stubEnv('KORA_RPC_URL', 'http://localhost:8080');
      mockGetConfig.mockRejectedValue(new Error('config endpoint down'));

      const { koraGetConfig } = await importFresh();

      await expect(koraGetConfig()).rejects.toThrow(
        'Kora getConfig failed: config endpoint down',
      );
    });

    it('should throw if KORA_RPC_URL is not configured', async () => {
      vi.stubEnv('KORA_RPC_URL', '');

      const { koraGetConfig } = await importFresh();

      await expect(koraGetConfig()).rejects.toThrow(
        'Kora is not configured: KORA_RPC_URL environment variable is not set',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Singleton behaviour — client is reused across calls
  // -------------------------------------------------------------------------

  describe('singleton behaviour', () => {
    it('should construct KoraClient only once across multiple calls', async () => {
      vi.stubEnv('KORA_RPC_URL', 'http://localhost:8080');
      mockSignAndSendTransaction.mockResolvedValue({ signed_transaction: 'tx1', signature: 's1' });
      mockGetSupportedTokens.mockResolvedValue({ tokens: [] });

      const { koraSignAndSend, koraGetSupportedTokens } = await importFresh();

      await koraSignAndSend('tx==');
      await koraSignAndSend('tx2==');
      await koraGetSupportedTokens();

      // Only one KoraClient should be constructed (singleton)
      expect(MockKoraClient).toHaveBeenCalledTimes(1);
    });
  });
});
