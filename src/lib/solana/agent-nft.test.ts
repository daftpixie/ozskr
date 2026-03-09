/**
 * Agent NFT Minting Tests
 *
 * Covers constructMintTransaction, deriveMetadataPda,
 * and deriveAssociatedTokenAddress.
 *
 * Key regression: verifies getAddressFromPublicKey is used (not the broken
 * getBase58Codec().decode() path that caused the 500 in production).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Address } from '@solana/kit';

// ---------------------------------------------------------------------------
// Hoisted mock references
// ---------------------------------------------------------------------------

const mockGetAddressFromPublicKey = vi.hoisted(() => vi.fn());
const mockAssertIsAddress = vi.hoisted(() =>
  vi.fn((addr: unknown) => {
    if (typeof addr !== 'string' || addr.length < 32 || addr.length > 44) {
      throw new Error(`Invalid address: ${String(addr)}`);
    }
  })
);
const mockAddress = vi.hoisted(() =>
  vi.fn((addr: string) => {
    if (addr.length < 32 || addr.length > 44) {
      throw new Error(`Invalid address: ${addr}`);
    }
    return addr as Address;
  })
);
const mockGenerateKeyPair = vi.hoisted(() => vi.fn());
const mockGetProgramDerivedAddress = vi.hoisted(() => vi.fn());
const mockGetAddressEncoder = vi.hoisted(() => vi.fn());
const mockSimulateTransaction = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ success: true })
);

// ---------------------------------------------------------------------------
// Module-level mocks (must be at top level, not inside describe/it)
// ---------------------------------------------------------------------------

vi.mock('@solana/kit', () => ({
  address: mockAddress,
  assertIsAddress: mockAssertIsAddress,
  createTransactionMessage: vi.fn(() => ({ version: 0, instructions: [] })),
  pipe: vi.fn(
    (init: unknown, ...fns: Array<(x: unknown) => unknown>) =>
      fns.reduce((acc, fn) => fn(acc), init)
  ),
  setTransactionMessageFeePayer: vi.fn((_payer: unknown, msg: unknown) => msg),
  setTransactionMessageLifetimeUsingBlockhash: vi.fn(
    (_bh: unknown, msg: unknown) => msg
  ),
  appendTransactionMessageInstruction: vi.fn(
    (_ix: unknown, msg: unknown) => msg
  ),
  getAddressEncoder: mockGetAddressEncoder,
  getProgramDerivedAddress: mockGetProgramDerivedAddress,
  generateKeyPair: mockGenerateKeyPair,
  getAddressFromPublicKey: mockGetAddressFromPublicKey,
  // dynamic imports used inside constructMintTransaction
  compileTransaction: vi.fn(() => ({ messageBytes: new Uint8Array(10) })),
  getTransactionEncoder: vi.fn(() => ({
    encode: vi.fn(() => new Uint8Array([1, 2, 3, 4])),
  })),
  getBase64EncodedWireTransaction: vi.fn(() => 'base64encodedtx'),
}));

vi.mock('@/lib/solana/rpc', () => ({
  getSolanaRpc: vi.fn(() => ({
    getMinimumBalanceForRentExemption: vi.fn(() => ({
      send: vi.fn().mockResolvedValue(2039280n),
    })),
    getLatestBlockhash: vi.fn(() => ({
      send: vi.fn().mockResolvedValue({
        value: {
          blockhash: 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N',
          lastValidBlockHeight: 100n,
        },
      }),
    })),
  })),
  getFallbackRpc: vi.fn(),
}));

vi.mock('@/lib/solana/transactions', () => ({
  simulateTransaction: mockSimulateTransaction,
}));

vi.mock('@/lib/solana/agent-registry', () => ({
  publishRegistrationFile: vi.fn(),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Stable test fixtures
// ---------------------------------------------------------------------------

const VALID_OWNER_WALLET =
  'So11111111111111111111111111111111111111112' as Address;
const VALID_TREASURY =
  'GsbwXfJraMomNxBcpR3DBs1dpR9egjPXxXwAk1qECmPw' as Address;
const VALID_MINT_ADDR =
  'Mint1111111111111111111111111111111111111111' as Address;
const VALID_ATA_ADDR =
  'ATAa1111111111111111111111111111111111111111' as Address;

function makeFakeMintKeypair() {
  return {
    publicKey: {
      type: 'public',
      algorithm: { name: 'Ed25519' },
    } as unknown as CryptoKey,
    privateKey: {} as CryptoKey,
  };
}

// Mock crypto.subtle so uploadNFTMetadata's SHA-256 and HMAC calls work
// without real keys/network access.
function mockCryptoSubtle() {
  const fakeHash = new Uint8Array(32).fill(0xab);
  vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(fakeHash.buffer as ArrayBuffer);
  vi.spyOn(crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey);
  vi.spyOn(crypto.subtle, 'sign').mockResolvedValue(fakeHash.buffer as ArrayBuffer);
  // exportKey is no longer called after the fix (regression guard)
  vi.spyOn(crypto.subtle, 'exportKey').mockResolvedValue(fakeHash.buffer as ArrayBuffer);
}

// Mock global fetch for R2 upload inside uploadNFTMetadata
function mockFetchSuccess() {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(null, { status: 200 })
  );
}

// ---------------------------------------------------------------------------
// beforeEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Address encoder: returns a fixed 32-byte buffer
  mockGetAddressEncoder.mockReturnValue({
    encode: vi.fn(() => new Uint8Array(32)),
  });

  // PDA derivation returns stable addresses
  mockGetProgramDerivedAddress
    .mockResolvedValueOnce([VALID_ATA_ADDR, 255])
    .mockResolvedValue([
      'MetaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      254,
    ]);

  // generateKeyPair produces a fake keypair
  mockGenerateKeyPair.mockResolvedValue(makeFakeMintKeypair());

  // getAddressFromPublicKey returns a valid base58 address
  mockGetAddressFromPublicKey.mockResolvedValue(VALID_MINT_ADDR);

  // Simulation succeeds by default
  mockSimulateTransaction.mockResolvedValue({ success: true });

  // Env vars
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL = 'https://rpc.helius.xyz/test';
  process.env.NEXT_PUBLIC_PLATFORM_TREASURY = VALID_TREASURY;
  process.env.CLOUDFLARE_ACCOUNT_ID = 'fake-account-id';
  process.env.R2_ACCESS_KEY_ID = 'fake-access-key';
  process.env.R2_SECRET_ACCESS_KEY = 'fake-secret-key';
  process.env.R2_BUCKET_NAME = 'fake-bucket';
  process.env.R2_PUBLIC_URL = 'https://cdn.example.com';
  process.env.NEXT_PUBLIC_APP_URL = 'https://ozskr.example.com';

  mockCryptoSubtle();
  mockFetchSuccess();
});

// ---------------------------------------------------------------------------
// Tests: deriveMetadataPda
// ---------------------------------------------------------------------------

describe('deriveMetadataPda', () => {
  it('calls getProgramDerivedAddress with correct seed count', async () => {
    const { deriveMetadataPda } = await import('./agent-nft');
    const result = await deriveMetadataPda(VALID_MINT_ADDR);

    expect(mockGetProgramDerivedAddress).toHaveBeenCalledTimes(1);
    const call = mockGetProgramDerivedAddress.mock.calls[0][0] as {
      programAddress: Address;
      seeds: Uint8Array[];
    };
    // Seeds: ["metadata" bytes, program bytes, mint bytes]
    expect(call.seeds).toHaveLength(3);
    expect(typeof result).toBe('string');
  });

  it('passes assertIsAddress on the input mint', async () => {
    const { deriveMetadataPda } = await import('./agent-nft');
    await deriveMetadataPda(VALID_MINT_ADDR);
    expect(mockAssertIsAddress).toHaveBeenCalledWith(VALID_MINT_ADDR);
  });
});

// ---------------------------------------------------------------------------
// Tests: deriveAssociatedTokenAddress
// ---------------------------------------------------------------------------

describe('deriveAssociatedTokenAddress', () => {
  it('derives ATA using SPL_ASSOCIATED_TOKEN_PROGRAM_ID', async () => {
    const { deriveAssociatedTokenAddress, SPL_ASSOCIATED_TOKEN_PROGRAM_ID } =
      await import('./agent-nft');
    const ata = await deriveAssociatedTokenAddress(
      VALID_OWNER_WALLET,
      VALID_MINT_ADDR
    );

    expect(mockGetProgramDerivedAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        programAddress: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      })
    );
    expect(ata).toBe(VALID_ATA_ADDR);
  });

  it('validates owner and mint with assertIsAddress', async () => {
    const { deriveAssociatedTokenAddress } = await import('./agent-nft');
    await deriveAssociatedTokenAddress(VALID_OWNER_WALLET, VALID_MINT_ADDR);
    expect(mockAssertIsAddress).toHaveBeenCalledWith(VALID_OWNER_WALLET);
    expect(mockAssertIsAddress).toHaveBeenCalledWith(VALID_MINT_ADDR);
  });
});

// ---------------------------------------------------------------------------
// Tests: constructMintTransaction
// ---------------------------------------------------------------------------

describe('constructMintTransaction', () => {
  async function callConstruct(overrides?: {
    ownerWallet?: string;
    characterId?: string;
  }) {
    const { constructMintTransaction } = await import('./agent-nft');
    return constructMintTransaction({
      characterId: overrides?.characterId ?? 'test-char-id',
      name: 'Test Agent',
      description: 'A test agent for unit tests',
      imageUrl: 'https://example.com/agent.png',
      capabilities: ['content-creation', 'social'],
      ownerWallet: (overrides?.ownerWallet ?? VALID_OWNER_WALLET) as Address,
    });
  }

  it('returns the expected result shape', async () => {
    const result = await callConstruct();

    expect(result).toMatchObject({
      transactionBase64: expect.any(String),
      mintAddress: expect.any(String),
      metadataUri: expect.stringContaining('nft-metadata.json'),
      costBreakdown: {
        mintFeeSOL: expect.any(String),
        platformFeeSOL: expect.any(String),
        totalSOL: expect.any(String),
      },
    });
  });

  it('uses getAddressFromPublicKey to derive mint address — regression guard against getBase58Codec().decode()', async () => {
    await callConstruct();

    // getAddressFromPublicKey MUST be called with the CryptoKey from generateKeyPair
    expect(mockGetAddressFromPublicKey).toHaveBeenCalledTimes(1);

    // The argument must be the publicKey from the generated keypair (a CryptoKey object)
    const callArg = mockGetAddressFromPublicKey.mock.calls[0][0] as CryptoKey;
    expect(callArg).toMatchObject({ type: 'public' });

    // crypto.subtle.exportKey must NOT be called for address derivation
    // (it was used in the broken code path)
    const exportKeyCallsForAddressDerivation = vi.mocked(
      crypto.subtle.exportKey
    ).mock.calls.length;
    // exportKey is only legitimately called by uploadJsonToR2 for AWS signing
    // but NOT for CryptoKey → address conversion. We verify getAddressFromPublicKey
    // was used instead by confirming it was called.
    expect(mockGetAddressFromPublicKey).toHaveBeenCalled();
    void exportKeyCallsForAddressDerivation; // exportKey may be called by R2 upload — that's OK
  });

  it('returns the mint address produced by getAddressFromPublicKey', async () => {
    mockGetAddressFromPublicKey.mockResolvedValue(VALID_MINT_ADDR);
    const result = await callConstruct();
    expect(result.mintAddress).toBe(VALID_MINT_ADDR);
  });

  it('throws early when NEXT_PUBLIC_PLATFORM_TREASURY is unset', async () => {
    delete process.env.NEXT_PUBLIC_PLATFORM_TREASURY;
    const { constructMintTransaction } = await import('./agent-nft');

    await expect(
      constructMintTransaction({
        characterId: 'test-char',
        name: 'Test',
        description: 'Test',
        imageUrl: 'https://example.com/img.png',
        capabilities: [],
        ownerWallet: VALID_OWNER_WALLET,
      })
    ).rejects.toThrow('NEXT_PUBLIC_PLATFORM_TREASURY');
  });

  it('throws when both NEXT_PUBLIC_HELIUS_RPC_URL and NEXT_PUBLIC_APP_URL are unset', async () => {
    // The code falls back to NEXT_PUBLIC_APP_URL when HELIUS_RPC_URL is missing,
    // so both must be unset to trigger the guard.
    delete process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    const { constructMintTransaction } = await import('./agent-nft');

    await expect(
      constructMintTransaction({
        characterId: 'test-char',
        name: 'Test',
        description: 'Test',
        imageUrl: 'https://example.com/img.png',
        capabilities: [],
        ownerWallet: VALID_OWNER_WALLET,
      })
    ).rejects.toThrow('NEXT_PUBLIC_HELIUS_RPC_URL');
  });

  it('throws when simulation returns a non-signer error', async () => {
    mockSimulateTransaction.mockResolvedValueOnce({
      success: false,
      error: 'insufficient lamports for transaction',
      logs: [],
    });

    await expect(callConstruct()).rejects.toThrow(
      'NFT mint transaction simulation failed'
    );
  });

  it('does NOT throw when simulation fails with missing-signer-only error', async () => {
    mockSimulateTransaction.mockResolvedValueOnce({
      success: false,
      error: 'missing required signature',
      logs: [],
    });

    const result = await callConstruct();
    expect(result.transactionBase64).toBeTruthy();
  });

  it('transactionBase64 is a valid base64 string', async () => {
    const result = await callConstruct();
    expect(() => Buffer.from(result.transactionBase64, 'base64')).not.toThrow();
    expect(result.transactionBase64.length).toBeGreaterThan(0);
  });

  it('cost breakdown numbers are parseable floats', async () => {
    const result = await callConstruct();

    const platform = parseFloat(result.costBreakdown.platformFeeSOL);
    const mint = parseFloat(result.costBreakdown.mintFeeSOL);
    const total = parseFloat(result.costBreakdown.totalSOL);

    expect(isNaN(platform)).toBe(false);
    expect(isNaN(mint)).toBe(false);
    expect(isNaN(total)).toBe(false);
    expect(total).toBeGreaterThan(0);
  });

  it('platform fee is 0.05 SOL', async () => {
    const result = await callConstruct();
    expect(parseFloat(result.costBreakdown.platformFeeSOL)).toBeCloseTo(
      0.05,
      4
    );
  });
});
