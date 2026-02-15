import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, stat, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  generateAgentKeypair,
  encryptKeypair,
  decryptKeypair,
  storeEncryptedKeypair,
  loadEncryptedKeypair,
  secureDelete,
} from '../src/keypair.js';
import {
  DelegationError,
  DelegationErrorCode,
  SCRYPT_PARAMS_FAST,
} from '../src/types.js';
import type { EncryptedKeypairFile } from '../src/types.js';

const TEST_PASSPHRASE = 'test-passphrase-at-least-12';

// ---------------------------------------------------------------------------
// Temp directory management
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'keypair-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// generateAgentKeypair
// ---------------------------------------------------------------------------

describe('generateAgentKeypair', () => {
  it('should generate a valid 64-byte keypair', async () => {
    const { signer, keypairBytes } = await generateAgentKeypair();

    expect(keypairBytes).toHaveLength(64);
    expect(signer.address).toBeTruthy();
    expect(typeof signer.address).toBe('string');
    expect(signer.address.length).toBeGreaterThanOrEqual(32);

    keypairBytes.fill(0);
  });

  it('should generate unique keypairs on each call', async () => {
    const result1 = await generateAgentKeypair();
    const result2 = await generateAgentKeypair();

    expect(result1.signer.address).not.toBe(result2.signer.address);
    expect(Buffer.from(result1.keypairBytes).equals(Buffer.from(result2.keypairBytes))).toBe(false);

    result1.keypairBytes.fill(0);
    result2.keypairBytes.fill(0);
  });
});

// ---------------------------------------------------------------------------
// encryptKeypair
// ---------------------------------------------------------------------------

describe('encryptKeypair', () => {
  it('should produce a valid EncryptedKeypairFile', async () => {
    const { keypairBytes } = await generateAgentKeypair();

    const encrypted = encryptKeypair(keypairBytes, TEST_PASSPHRASE, SCRYPT_PARAMS_FAST);

    expect(encrypted.version).toBe(2);
    expect(encrypted.scryptParams).toEqual(SCRYPT_PARAMS_FAST);
    expect(encrypted.salt).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.authTag).toBeTruthy();

    // Verify base64 encoding
    expect(() => Buffer.from(encrypted.salt, 'base64')).not.toThrow();
    expect(() => Buffer.from(encrypted.iv, 'base64')).not.toThrow();
    expect(() => Buffer.from(encrypted.ciphertext, 'base64')).not.toThrow();
    expect(() => Buffer.from(encrypted.authTag, 'base64')).not.toThrow();

    keypairBytes.fill(0);
  });

  it('should reject passphrase shorter than 12 characters', async () => {
    const { keypairBytes } = await generateAgentKeypair();

    expect(() => encryptKeypair(keypairBytes, 'short', SCRYPT_PARAMS_FAST)).toThrow(DelegationError);
    expect(() => encryptKeypair(keypairBytes, 'short', SCRYPT_PARAMS_FAST)).toThrow('at least 12 characters');

    keypairBytes.fill(0);
  });

  it('should reject invalid keypair length', () => {
    const badBytes = new Uint8Array(32);

    expect(() => encryptKeypair(badBytes, TEST_PASSPHRASE, SCRYPT_PARAMS_FAST)).toThrow(DelegationError);
    expect(() => encryptKeypair(badBytes, TEST_PASSPHRASE, SCRYPT_PARAMS_FAST)).toThrow('exactly 64 bytes');
  });
});

// ---------------------------------------------------------------------------
// decryptKeypair
// ---------------------------------------------------------------------------

describe('decryptKeypair', () => {
  it('should roundtrip encrypt/decrypt with matching bytes', async () => {
    const { keypairBytes } = await generateAgentKeypair();
    const original = new Uint8Array(keypairBytes);

    const encrypted = encryptKeypair(keypairBytes, TEST_PASSPHRASE, SCRYPT_PARAMS_FAST);
    const decrypted = decryptKeypair(encrypted, TEST_PASSPHRASE, SCRYPT_PARAMS_FAST);

    expect(Buffer.from(decrypted).equals(Buffer.from(original))).toBe(true);

    keypairBytes.fill(0);
    decrypted.fill(0);
  });

  it('should reject wrong passphrase', async () => {
    const { keypairBytes } = await generateAgentKeypair();

    const encrypted = encryptKeypair(keypairBytes, TEST_PASSPHRASE, SCRYPT_PARAMS_FAST);

    expect(() => decryptKeypair(encrypted, 'wrong-passphrase-here', SCRYPT_PARAMS_FAST)).toThrow(DelegationError);

    try {
      decryptKeypair(encrypted, 'wrong-passphrase-here', SCRYPT_PARAMS_FAST);
    } catch (error) {
      expect(error).toBeInstanceOf(DelegationError);
      expect((error as DelegationError).code).toBe(DelegationErrorCode.DECRYPTION_FAILED);
    }

    keypairBytes.fill(0);
  });

  it('should reject unsupported version', async () => {
    const { keypairBytes } = await generateAgentKeypair();
    const encrypted = encryptKeypair(keypairBytes, TEST_PASSPHRASE, SCRYPT_PARAMS_FAST);

    const badVersion = { ...encrypted, version: 99 as 1 };

    expect(() => decryptKeypair(badVersion, TEST_PASSPHRASE, SCRYPT_PARAMS_FAST)).toThrow(DelegationError);
    expect(() => decryptKeypair(badVersion, TEST_PASSPHRASE, SCRYPT_PARAMS_FAST)).toThrow('Unsupported');

    keypairBytes.fill(0);
  });
});

// ---------------------------------------------------------------------------
// storeEncryptedKeypair
// ---------------------------------------------------------------------------

describe('storeEncryptedKeypair', () => {
  it('should store with 0600 permissions', async () => {
    const { keypairBytes } = await generateAgentKeypair();
    const filePath = join(tempDir, 'agent-keypair.json');

    await storeEncryptedKeypair(keypairBytes, TEST_PASSPHRASE, filePath, false, SCRYPT_PARAMS_FAST);

    const fileStat = await stat(filePath);
    const mode = fileStat.mode & 0o777;
    expect(mode).toBe(0o600);

    keypairBytes.fill(0);
  });

  it('should reject overwrite without force flag', async () => {
    const { keypairBytes } = await generateAgentKeypair();
    const filePath = join(tempDir, 'agent-keypair.json');

    await storeEncryptedKeypair(keypairBytes, TEST_PASSPHRASE, filePath, false, SCRYPT_PARAMS_FAST);

    await expect(
      storeEncryptedKeypair(keypairBytes, TEST_PASSPHRASE, filePath, false, SCRYPT_PARAMS_FAST),
    ).rejects.toThrow(DelegationError);

    await expect(
      storeEncryptedKeypair(keypairBytes, TEST_PASSPHRASE, filePath, false, SCRYPT_PARAMS_FAST),
    ).rejects.toThrow('already exists');

    keypairBytes.fill(0);
  });

  it('should allow overwrite with force flag', async () => {
    const { keypairBytes } = await generateAgentKeypair();
    const filePath = join(tempDir, 'agent-keypair.json');

    await storeEncryptedKeypair(keypairBytes, TEST_PASSPHRASE, filePath, false, SCRYPT_PARAMS_FAST);
    await expect(
      storeEncryptedKeypair(keypairBytes, TEST_PASSPHRASE, filePath, true, SCRYPT_PARAMS_FAST),
    ).resolves.toBeUndefined();

    keypairBytes.fill(0);
  });
});

// ---------------------------------------------------------------------------
// loadEncryptedKeypair
// ---------------------------------------------------------------------------

describe('loadEncryptedKeypair', () => {
  it('should roundtrip store/load with matching address', async () => {
    const { signer, keypairBytes } = await generateAgentKeypair();
    const filePath = join(tempDir, 'agent-keypair.json');

    await storeEncryptedKeypair(keypairBytes, TEST_PASSPHRASE, filePath, false, SCRYPT_PARAMS_FAST);
    keypairBytes.fill(0);

    const loadedSigner = await loadEncryptedKeypair(filePath, TEST_PASSPHRASE, SCRYPT_PARAMS_FAST);

    expect(loadedSigner.address).toBe(signer.address);
  });

  it('should reject missing file', async () => {
    const filePath = join(tempDir, 'nonexistent.json');

    await expect(
      loadEncryptedKeypair(filePath, TEST_PASSPHRASE, SCRYPT_PARAMS_FAST),
    ).rejects.toThrow(DelegationError);

    try {
      await loadEncryptedKeypair(filePath, TEST_PASSPHRASE, SCRYPT_PARAMS_FAST);
    } catch (error) {
      expect((error as DelegationError).code).toBe(DelegationErrorCode.KEYPAIR_NOT_FOUND);
    }
  });

  it('should reject insecure file permissions', async () => {
    const { keypairBytes } = await generateAgentKeypair();
    const filePath = join(tempDir, 'insecure-keypair.json');

    const encrypted = encryptKeypair(keypairBytes, TEST_PASSPHRASE, SCRYPT_PARAMS_FAST);
    await writeFile(filePath, JSON.stringify(encrypted));
    await chmod(filePath, 0o644);

    await expect(
      loadEncryptedKeypair(filePath, TEST_PASSPHRASE, SCRYPT_PARAMS_FAST),
    ).rejects.toThrow(DelegationError);

    try {
      await loadEncryptedKeypair(filePath, TEST_PASSPHRASE, SCRYPT_PARAMS_FAST);
    } catch (error) {
      expect((error as DelegationError).code).toBe(DelegationErrorCode.INVALID_PERMISSIONS);
    }

    keypairBytes.fill(0);
  });
});

// ---------------------------------------------------------------------------
// secureDelete
// ---------------------------------------------------------------------------

describe('secureDelete', () => {
  it('should remove the file after overwriting', async () => {
    const filePath = join(tempDir, 'to-delete.json');
    await writeFile(filePath, 'sensitive data');

    await secureDelete(filePath);

    await expect(stat(filePath)).rejects.toThrow();
  });

  it('should not throw on missing file', async () => {
    const filePath = join(tempDir, 'does-not-exist.json');

    await expect(secureDelete(filePath)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Full Roundtrip
// ---------------------------------------------------------------------------

describe('full roundtrip', () => {
  it('should generate → encrypt → store → load → verify address match', async () => {
    const { signer: originalSigner, keypairBytes } = await generateAgentKeypair();
    const filePath = join(tempDir, 'roundtrip-keypair.json');

    // Store
    await storeEncryptedKeypair(keypairBytes, TEST_PASSPHRASE, filePath, false, SCRYPT_PARAMS_FAST);
    keypairBytes.fill(0);

    // Load
    const restoredSigner = await loadEncryptedKeypair(filePath, TEST_PASSPHRASE, SCRYPT_PARAMS_FAST);

    // Verify address matches
    expect(restoredSigner.address).toBe(originalSigner.address);

    // Verify the restored signer can be used (basic sanity)
    expect(restoredSigner.keyPair).toBeDefined();
    expect(restoredSigner.keyPair.privateKey).toBeDefined();
    expect(restoredSigner.keyPair.publicKey).toBeDefined();
  });
});
