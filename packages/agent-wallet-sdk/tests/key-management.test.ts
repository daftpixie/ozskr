import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Address } from '@solana/kit';
import { EncryptedJsonKeyManager, createKeyManager } from '../src/key-management/index.js';
import type { KeyManager } from '../src/key-management/types.js';
import { generateAgentKeypair, storeEncryptedKeypair } from '../src/keypair.js';
import { SCRYPT_PARAMS_FAST } from '../src/types.js';

describe('KeyManager Interface', () => {
  describe('Mock KeyManager Implementation', () => {
    it('should satisfy the KeyManager interface', async () => {
      // Create a mock implementation that satisfies the interface
      const mockKeyManager: KeyManager = {
        getPublicKey: vi.fn(async () => 'mockAddress' as Address),
        signTransaction: vi.fn(async () => new Uint8Array(64)),
        signMessage: vi.fn(async () => new Uint8Array(64)),
        healthCheck: vi.fn(async () => ({ healthy: true, provider: 'mock' })),
      };

      // Verify the interface contract
      const pubkey = await mockKeyManager.getPublicKey();
      expect(pubkey).toBe('mockAddress');

      const txSig = await mockKeyManager.signTransaction(new Uint8Array(32));
      expect(txSig).toHaveLength(64);

      const msgSig = await mockKeyManager.signMessage(new Uint8Array(32));
      expect(msgSig).toHaveLength(64);

      const health = await mockKeyManager.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.provider).toBe('mock');
    });
  });

  describe('EncryptedJsonKeyManager', () => {
    let testKeypairPath: string;
    const testPassphrase = 'test-passphrase-12345';

    beforeEach(async () => {
      // Generate a test keypair file
      testKeypairPath = join(tmpdir(), `test-keypair-${Date.now()}.json`);
      const { signer, keypairBytes } = await generateAgentKeypair();
      await storeEncryptedKeypair(
        keypairBytes,
        testPassphrase,
        testKeypairPath,
        false,
        SCRYPT_PARAMS_FAST,
      );
      keypairBytes.fill(0);
    });

    afterEach(async () => {
      // Clean up test files
      try {
        await unlink(testKeypairPath);
      } catch {
        // Ignore if file doesn't exist
      }
    });

    it('should load keypair and return correct address', async () => {
      const keyManager = new EncryptedJsonKeyManager(
        testKeypairPath,
        testPassphrase,
        SCRYPT_PARAMS_FAST,
      );

      const address = await keyManager.getPublicKey();
      expect(address).toBeTruthy();
      expect(typeof address).toBe('string');
      expect(address.length).toBeGreaterThan(32);
    });

    it('should cache the signer after first load', async () => {
      const keyManager = new EncryptedJsonKeyManager(
        testKeypairPath,
        testPassphrase,
        SCRYPT_PARAMS_FAST,
      );

      // First call should load the keypair
      const address1 = await keyManager.getPublicKey();
      // Second call should use cached signer (same address)
      const address2 = await keyManager.getPublicKey();

      expect(address1).toBe(address2);
    });

    it('should sign a transaction message', async () => {
      const keyManager = new EncryptedJsonKeyManager(
        testKeypairPath,
        testPassphrase,
        SCRYPT_PARAMS_FAST,
      );

      const fakeTransactionMessage = new Uint8Array(100);
      const signature = await keyManager.signTransaction(fakeTransactionMessage);

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBe(64);
    });

    it('should sign a message', async () => {
      const keyManager = new EncryptedJsonKeyManager(
        testKeypairPath,
        testPassphrase,
        SCRYPT_PARAMS_FAST,
      );

      const message = new TextEncoder().encode('Hello, world!');
      const signature = await keyManager.signMessage(message);

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBe(64);
    });

    it('should return healthy status from healthCheck', async () => {
      const keyManager = new EncryptedJsonKeyManager(
        testKeypairPath,
        testPassphrase,
        SCRYPT_PARAMS_FAST,
      );

      const health = await keyManager.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.provider).toBe('encrypted-json');
    });

    it('should return unhealthy status for invalid keypair', async () => {
      const invalidPath = join(tmpdir(), 'nonexistent-keypair.json');
      const keyManager = new EncryptedJsonKeyManager(
        invalidPath,
        testPassphrase,
        SCRYPT_PARAMS_FAST,
      );

      const health = await keyManager.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.provider).toBe('encrypted-json');
    });

    it('should destroy cached signer', async () => {
      const keyManager = new EncryptedJsonKeyManager(
        testKeypairPath,
        testPassphrase,
        SCRYPT_PARAMS_FAST,
      );

      // Load the signer
      await keyManager.getPublicKey();

      // Destroy it
      keyManager.destroy();

      // Accessing public key again should reload from disk
      const address = await keyManager.getPublicKey();
      expect(address).toBeTruthy();
    });
  });

  describe('createKeyManager factory', () => {
    let testKeypairPath: string;
    const testPassphrase = 'factory-test-passphrase-12345';

    beforeEach(async () => {
      testKeypairPath = join(tmpdir(), `factory-test-keypair-${Date.now()}.json`);
      const { signer, keypairBytes } = await generateAgentKeypair();
      await storeEncryptedKeypair(
        keypairBytes,
        testPassphrase,
        testKeypairPath,
        false,
        SCRYPT_PARAMS_FAST,
      );
      keypairBytes.fill(0);
    });

    afterEach(async () => {
      try {
        await unlink(testKeypairPath);
      } catch {
        // Ignore
      }
    });

    it('should create EncryptedJsonKeyManager from config', async () => {
      const keyManager = createKeyManager({
        provider: 'encrypted-json',
        options: {
          filePath: testKeypairPath,
          passphrase: testPassphrase,
          scryptParams: SCRYPT_PARAMS_FAST,
        },
      });

      expect(keyManager).toBeInstanceOf(EncryptedJsonKeyManager);

      const address = await keyManager.getPublicKey();
      expect(address).toBeTruthy();
    });

    it('should throw for unknown provider', () => {
      expect(() =>
        createKeyManager({
          provider: 'turnkey' as const,
          options: {},
        }),
      ).toThrow(/Unsupported key manager provider: turnkey/);
    });

    it('should throw if filePath is missing', () => {
      expect(() =>
        createKeyManager({
          provider: 'encrypted-json',
          options: {
            passphrase: testPassphrase,
          },
        }),
      ).toThrow(/requires options.filePath/);
    });

    it('should throw if passphrase is missing', () => {
      expect(() =>
        createKeyManager({
          provider: 'encrypted-json',
          options: {
            filePath: testKeypairPath,
          },
        }),
      ).toThrow(/requires options.passphrase/);
    });

    it('should work without scryptParams (uses default)', async () => {
      const keyManager = createKeyManager({
        provider: 'encrypted-json',
        options: {
          filePath: testKeypairPath,
          passphrase: testPassphrase,
        },
      });

      const address = await keyManager.getPublicKey();
      expect(address).toBeTruthy();
    });
  });
});
