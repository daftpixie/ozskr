import { describe, it, expect, vi, beforeEach } from 'vitest';
import { address } from '@solana/kit';
import type { KeyManager } from '@ozskr/agent-wallet-sdk';
import { createSignerFromKeyManager } from '../signer-adapter';

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

/**
 * The signer returned by createSignerFromKeyManager has signMessages and
 * signTransactions at runtime, but the TypeScript type is TransactionSigner
 * (a union that doesn't directly expose these). We cast through unknown to
 * access the actual methods in tests.
 */
interface TestableSignerShape {
  address: string;
  signMessages: (messages: readonly { content: Uint8Array }[]) => Promise<unknown[]>;
  signTransactions: (transactions: readonly { messageBytes: Uint8Array }[]) => Promise<unknown[]>;
}

describe('createSignerFromKeyManager', () => {
  const testAddress = address('So11111111111111111111111111111111111111112');
  const testSignature = new Uint8Array(64).fill(0xab);

  let mockKeyManager: KeyManager;

  beforeEach(() => {
    mockKeyManager = {
      getPublicKey: vi.fn(async () => testAddress),
      signTransaction: vi.fn(async () => testSignature),
      signMessage: vi.fn(async () => testSignature),
      healthCheck: vi.fn(async () => ({ healthy: true, provider: 'mock' })),
    };
  });

  function asSigner(s: unknown): TestableSignerShape {
    return s as TestableSignerShape;
  }

  it('should return a frozen signer object', () => {
    const signer = createSignerFromKeyManager(mockKeyManager, testAddress, 'local');
    const s = asSigner(signer);

    expect(Object.isFrozen(signer)).toBe(true);
    expect(s.address).toBe(testAddress);
    expect(typeof s.signMessages).toBe('function');
    expect(typeof s.signTransactions).toBe('function');
  });

  it('should have the correct address', () => {
    const signer = createSignerFromKeyManager(mockKeyManager, testAddress, 'turnkey');
    expect(asSigner(signer).address).toBe(testAddress);
  });

  describe('signMessages', () => {
    it('should sign a single message', async () => {
      const signer = asSigner(createSignerFromKeyManager(mockKeyManager, testAddress, 'local'));
      const content = new Uint8Array([1, 2, 3]);

      const results = await signer.signMessages([{ content }]);

      expect(results).toHaveLength(1);
      expect(mockKeyManager.signMessage).toHaveBeenCalledWith(content);
    });

    it('should sign multiple messages', async () => {
      const signer = asSigner(createSignerFromKeyManager(mockKeyManager, testAddress, 'local'));
      const messages = [
        { content: new Uint8Array([1]) },
        { content: new Uint8Array([2]) },
        { content: new Uint8Array([3]) },
      ];

      const results = await signer.signMessages(messages);

      expect(results).toHaveLength(3);
      expect(mockKeyManager.signMessage).toHaveBeenCalledTimes(3);
    });

    it('should return signature dict with address key', async () => {
      const signer = asSigner(createSignerFromKeyManager(mockKeyManager, testAddress, 'local'));

      const results = await signer.signMessages([{ content: new Uint8Array(32) }]);

      const sigDict = results[0] as Record<string, unknown>;
      expect(sigDict).toBeDefined();
      expect(sigDict[testAddress]).toBeDefined();
    });

    it('should return frozen signature dictionaries', async () => {
      const signer = asSigner(createSignerFromKeyManager(mockKeyManager, testAddress, 'local'));

      const results = await signer.signMessages([{ content: new Uint8Array(32) }]);

      expect(Object.isFrozen(results[0])).toBe(true);
    });
  });

  describe('signTransactions', () => {
    it('should sign a single transaction', async () => {
      const signer = asSigner(createSignerFromKeyManager(mockKeyManager, testAddress, 'turnkey'));
      const messageBytes = new Uint8Array([10, 20, 30]);

      const results = await signer.signTransactions([{ messageBytes }]);

      expect(results).toHaveLength(1);
      expect(mockKeyManager.signTransaction).toHaveBeenCalledWith(messageBytes);
    });

    it('should sign multiple transactions', async () => {
      const signer = asSigner(createSignerFromKeyManager(mockKeyManager, testAddress, 'turnkey'));
      const transactions = [
        { messageBytes: new Uint8Array([1]) },
        { messageBytes: new Uint8Array([2]) },
      ];

      const results = await signer.signTransactions(transactions);

      expect(results).toHaveLength(2);
      expect(mockKeyManager.signTransaction).toHaveBeenCalledTimes(2);
    });

    it('should propagate signing errors', async () => {
      const failingKm: KeyManager = {
        ...mockKeyManager,
        signTransaction: vi.fn(async () => {
          throw new Error('Signing failed');
        }),
      };

      const signer = asSigner(createSignerFromKeyManager(failingKm, testAddress, 'turnkey'));

      await expect(
        signer.signTransactions([{ messageBytes: new Uint8Array(32) }]),
      ).rejects.toThrow('Signing failed');
    });
  });

  describe('signer type logging', () => {
    it('should log with local signer type', async () => {
      const { logger } = await import('@/lib/utils/logger');
      const signer = asSigner(createSignerFromKeyManager(mockKeyManager, testAddress, 'local'));

      await signer.signMessages([{ content: new Uint8Array(32) }]);

      expect(logger.debug).toHaveBeenCalledWith(
        'Signing message via KeyManager',
        expect.objectContaining({ signerType: 'local' }),
      );
    });

    it('should log with turnkey signer type', async () => {
      const { logger } = await import('@/lib/utils/logger');
      const signer = asSigner(createSignerFromKeyManager(mockKeyManager, testAddress, 'turnkey'));

      await signer.signTransactions([{ messageBytes: new Uint8Array(32) }]);

      expect(logger.debug).toHaveBeenCalledWith(
        'Signing transaction via KeyManager',
        expect.objectContaining({ signerType: 'turnkey' }),
      );
    });
  });
});
