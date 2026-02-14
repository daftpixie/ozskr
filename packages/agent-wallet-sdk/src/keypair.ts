import {
  type KeyPairSigner,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
} from '@solana/kit';
import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import { readFile, writeFile, unlink, stat, chmod } from 'node:fs/promises';
import type {
  ScryptParams,
  EncryptedKeypairFile,
  KeypairGenerationResult,
} from './types.js';
import {
  DelegationError,
  DelegationErrorCode,
  SCRYPT_PARAMS_PRODUCTION,
} from './types.js';

// ---------------------------------------------------------------------------
// Keypair Generation
// ---------------------------------------------------------------------------

/**
 * Generates a new agent keypair using a CSPRNG seed.
 *
 * Uses `createKeyPairSignerFromPrivateKeyBytes` with extractable=true so the
 * public key can be exported for storage. Returns both the KeyPairSigner (for
 * signing) and the raw 64-byte keypair (for encrypted storage).
 *
 * The caller MUST zero `keypairBytes` after use.
 *
 * @returns KeyPairSigner and raw keypair bytes
 */
export async function generateAgentKeypair(): Promise<KeypairGenerationResult> {
  const seed = randomBytes(32);

  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed, true);

  // Export public key to build the 64-byte [seed | pubkey] format
  const publicKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey('raw', signer.keyPair.publicKey),
  );

  const keypairBytes = new Uint8Array(64);
  keypairBytes.set(seed, 0);
  keypairBytes.set(publicKeyBytes, 32);

  // Zero intermediate buffers
  seed.fill(0);
  publicKeyBytes.fill(0);

  return { signer, keypairBytes };
}

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

/**
 * Encrypts a 64-byte keypair using scrypt KDF + AES-256-GCM.
 *
 * @param keypairBytes - Raw 64-byte keypair (32 secret + 32 public)
 * @param passphrase - Encryption passphrase (minimum 12 characters)
 * @param params - Scrypt parameters (defaults to production)
 * @returns Encrypted keypair file structure
 */
export function encryptKeypair(
  keypairBytes: Uint8Array,
  passphrase: string,
  params: ScryptParams = SCRYPT_PARAMS_PRODUCTION,
): EncryptedKeypairFile {
  if (keypairBytes.length !== 64) {
    throw new DelegationError(
      DelegationErrorCode.INVALID_KEYPAIR_FORMAT,
      `Keypair must be exactly 64 bytes, got ${keypairBytes.length}`,
    );
  }

  if (passphrase.length < 12) {
    throw new DelegationError(
      DelegationErrorCode.INVALID_KEYPAIR_FORMAT,
      'Passphrase must be at least 12 characters',
    );
  }

  const salt = randomBytes(32);
  const iv = randomBytes(12);

  // Derive encryption key via scrypt
  const derivedKey = scryptSync(passphrase, salt, params.keyLen, {
    N: params.N,
    r: params.r,
    p: params.p,
  });

  const cipher = createCipheriv('aes-256-gcm', derivedKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(keypairBytes),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Zero derived key
  derivedKey.fill(0);

  return {
    version: 1,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

// ---------------------------------------------------------------------------
// Decryption
// ---------------------------------------------------------------------------

/**
 * Decrypts an encrypted keypair file back to raw 64-byte keypair.
 *
 * @param encrypted - Encrypted keypair file structure
 * @param passphrase - Decryption passphrase
 * @param params - Scrypt parameters (must match encryption params)
 * @returns Raw 64-byte keypair as Uint8Array. Caller MUST zero after use.
 */
export function decryptKeypair(
  encrypted: EncryptedKeypairFile,
  passphrase: string,
  params: ScryptParams = SCRYPT_PARAMS_PRODUCTION,
): Uint8Array {
  if (encrypted.version !== 1) {
    throw new DelegationError(
      DelegationErrorCode.INVALID_KEYPAIR_FORMAT,
      `Unsupported encrypted keypair version: ${encrypted.version}`,
    );
  }

  const salt = Buffer.from(encrypted.salt, 'base64');
  const iv = Buffer.from(encrypted.iv, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');

  const derivedKey = scryptSync(passphrase, salt, params.keyLen, {
    N: params.N,
    r: params.r,
    p: params.p,
  });

  try {
    const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return new Uint8Array(decrypted);
  } catch {
    throw new DelegationError(
      DelegationErrorCode.DECRYPTION_FAILED,
      'Decryption failed — wrong passphrase or corrupted data',
    );
  } finally {
    derivedKey.fill(0);
  }
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

/**
 * Encrypts and stores an agent keypair to disk with 0600 permissions.
 *
 * @param keypairBytes - Raw 64-byte keypair
 * @param passphrase - Encryption passphrase (minimum 12 characters)
 * @param outputPath - File path for the encrypted keypair
 * @param force - Overwrite existing file if true
 * @param params - Scrypt parameters (defaults to production)
 */
export async function storeEncryptedKeypair(
  keypairBytes: Uint8Array,
  passphrase: string,
  outputPath: string,
  force = false,
  params: ScryptParams = SCRYPT_PARAMS_PRODUCTION,
): Promise<void> {
  // Check if file already exists
  if (!force) {
    try {
      await stat(outputPath);
      throw new DelegationError(
        DelegationErrorCode.KEYPAIR_EXISTS,
        `Keypair file already exists at ${outputPath}. Use force=true to overwrite.`,
      );
    } catch (error) {
      if (error instanceof DelegationError) throw error;
      // File doesn't exist — proceed
    }
  }

  const encrypted = encryptKeypair(keypairBytes, passphrase, params);
  await writeFile(outputPath, JSON.stringify(encrypted, null, 2), { mode: 0o600 });
  // Ensure permissions even if umask interfered
  await chmod(outputPath, 0o600);
}

/**
 * Loads and decrypts an agent keypair from disk, returning a KeyPairSigner.
 *
 * Validates file permissions (must be 0600) before reading.
 * Zeros decrypted bytes in a finally block after creating the signer.
 *
 * @param filePath - Path to the encrypted keypair file
 * @param passphrase - Decryption passphrase
 * @param params - Scrypt parameters (must match encryption params)
 * @returns KeyPairSigner for signing transactions
 */
export async function loadEncryptedKeypair(
  filePath: string,
  passphrase: string,
  params: ScryptParams = SCRYPT_PARAMS_PRODUCTION,
): Promise<KeyPairSigner> {
  // Check file exists
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    throw new DelegationError(
      DelegationErrorCode.KEYPAIR_NOT_FOUND,
      `Keypair file not found: ${filePath}`,
    );
  }

  // Check permissions (Unix: mode & 0o777 should be 0o600)
  const mode = fileStat.mode & 0o777;
  if (mode !== 0o600) {
    throw new DelegationError(
      DelegationErrorCode.INVALID_PERMISSIONS,
      `Insecure file permissions on ${filePath}: expected 0600, got ${mode.toString(8).padStart(4, '0')}`,
    );
  }

  const content = await readFile(filePath, 'utf-8');
  const encrypted: EncryptedKeypairFile = JSON.parse(content);

  let decryptedBytes: Uint8Array | null = null;
  try {
    decryptedBytes = decryptKeypair(encrypted, passphrase, params);
    const signer = await createKeyPairSignerFromBytes(decryptedBytes);
    return signer;
  } finally {
    if (decryptedBytes) {
      decryptedBytes.fill(0);
    }
  }
}

// ---------------------------------------------------------------------------
// Secure Delete
// ---------------------------------------------------------------------------

/**
 * Securely deletes a file by overwriting with random data before unlinking.
 *
 * Does not throw if the file doesn't exist.
 *
 * @param filePath - Path to the file to securely delete
 */
export async function secureDelete(filePath: string): Promise<void> {
  try {
    const fileStat = await stat(filePath);
    const randomData = randomBytes(fileStat.size);
    await writeFile(filePath, randomData);
    await unlink(filePath);
  } catch (error) {
    // Ignore ENOENT (file doesn't exist)
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return;
    }
    throw error;
  }
}
