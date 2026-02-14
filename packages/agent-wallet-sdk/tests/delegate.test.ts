import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Address, TransactionSigner } from '@solana/kit';

// ---------------------------------------------------------------------------
// Mocks — must be defined before imports that use them
// ---------------------------------------------------------------------------

const mockSend = vi.fn();
const mockGetLatestBlockhash = vi.fn(() => ({ send: mockSend }));
const mockSimulateTransaction = vi.fn(() => ({ send: mockSend }));
const mockSendTransaction = vi.fn(() => ({ send: mockSend }));

vi.mock('@solana/kit', async (importOriginal) => {
  const original = await importOriginal<typeof import('@solana/kit')>();
  return {
    ...original,
    createSolanaRpc: vi.fn(() => ({
      getLatestBlockhash: mockGetLatestBlockhash,
      simulateTransaction: mockSimulateTransaction,
      sendTransaction: mockSendTransaction,
    })),
    signTransactionMessageWithSigners: vi.fn(async () => ({
      messageBytes: new Uint8Array([1, 2, 3]),
      signatures: {},
    })),
    getBase64EncodedWireTransaction: vi.fn(() => 'base64encodedtx'),
    getSignatureFromTransaction: vi.fn(() => 'mocksignature123'),
  };
});

vi.mock('@solana-program/token', () => ({
  getApproveCheckedInstruction: vi.fn(() => ({
    programAddress: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    accounts: [],
    data: new Uint8Array(),
  })),
  getTransferCheckedInstruction: vi.fn(() => ({
    programAddress: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    accounts: [],
    data: new Uint8Array(),
  })),
  getRevokeInstruction: vi.fn(() => ({
    programAddress: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    accounts: [],
    data: new Uint8Array(),
  })),
  fetchToken: vi.fn(),
}));

import {
  createDelegation,
  checkDelegation,
  transferAsDelegate,
  revokeDelegation,
} from '../src/delegate.js';
import { DelegationError, DelegationErrorCode } from '../src/types.js';
import { fetchToken } from '@solana-program/token';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const VALID_ADDRESS = '11111111111111111111111111111111' as Address;
const VALID_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as Address;
const VALID_DEST = 'So11111111111111111111111111111111111111112' as Address;

function createMockSigner(addr: string = VALID_ADDRESS): TransactionSigner {
  return {
    address: addr as Address,
    signTransactions: vi.fn(async (txs: unknown[]) =>
      txs.map(() => ({ messageBytes: new Uint8Array(), signatures: {} })),
    ),
  } as unknown as TransactionSigner;
}

const mockRpcConfig = { endpoint: 'https://api.devnet.solana.com' };

const mockBlockhash = {
  blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
  lastValidBlockHeight: 100n,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createDelegation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ value: mockBlockhash });
  });

  it('should build an approveChecked transaction message', async () => {
    const config = {
      ownerTokenAccount: VALID_ADDRESS,
      ownerSigner: createMockSigner(),
      delegateAddress: VALID_DEST,
      tokenMint: VALID_MINT,
      maxAmount: 10_000_000n,
      decimals: 6,
    };

    const result = await createDelegation(config, mockRpcConfig);
    expect(result).toBeDefined();
    expect(result).toHaveProperty('instructions');
    expect(result).toHaveProperty('version', 0);
  });

  it('should reject invalid ownerTokenAccount address', async () => {
    const config = {
      ownerTokenAccount: 'not-a-valid-address' as Address,
      ownerSigner: createMockSigner(),
      delegateAddress: VALID_DEST,
      tokenMint: VALID_MINT,
      maxAmount: 10_000_000n,
      decimals: 6,
    };

    await expect(createDelegation(config, mockRpcConfig)).rejects.toThrow(DelegationError);
    await expect(createDelegation(config, mockRpcConfig)).rejects.toThrow(/Invalid ownerTokenAccount address/);
  });

  it('should reject zero amount', async () => {
    const config = {
      ownerTokenAccount: VALID_ADDRESS,
      ownerSigner: createMockSigner(),
      delegateAddress: VALID_DEST,
      tokenMint: VALID_MINT,
      maxAmount: 0n,
      decimals: 6,
    };

    await expect(createDelegation(config, mockRpcConfig)).rejects.toThrow(DelegationError);

    try {
      await createDelegation(config, mockRpcConfig);
    } catch (error) {
      expect(error).toBeInstanceOf(DelegationError);
      expect((error as DelegationError).code).toBe(DelegationErrorCode.INVALID_AMOUNT);
    }
  });

  it('should reject negative amount', async () => {
    const config = {
      ownerTokenAccount: VALID_ADDRESS,
      ownerSigner: createMockSigner(),
      delegateAddress: VALID_DEST,
      tokenMint: VALID_MINT,
      maxAmount: -1n,
      decimals: 6,
    };

    await expect(createDelegation(config, mockRpcConfig)).rejects.toThrow(/must be positive/);
  });

  it('should reject invalid decimals', async () => {
    const config = {
      ownerTokenAccount: VALID_ADDRESS,
      ownerSigner: createMockSigner(),
      delegateAddress: VALID_DEST,
      tokenMint: VALID_MINT,
      maxAmount: 10_000_000n,
      decimals: 19,
    };

    await expect(createDelegation(config, mockRpcConfig)).rejects.toThrow(/Decimals must be an integer 0-18/);
  });

  it('should reject non-integer decimals', async () => {
    const config = {
      ownerTokenAccount: VALID_ADDRESS,
      ownerSigner: createMockSigner(),
      delegateAddress: VALID_DEST,
      tokenMint: VALID_MINT,
      maxAmount: 10_000_000n,
      decimals: 6.5,
    };

    await expect(createDelegation(config, mockRpcConfig)).rejects.toThrow(DelegationError);
  });
});

describe('checkDelegation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return active delegation status', async () => {
    vi.mocked(fetchToken).mockResolvedValue({
      address: VALID_ADDRESS,
      data: {
        mint: VALID_MINT,
        owner: VALID_ADDRESS,
        amount: 100_000_000n,
        delegate: { __option: 'Some' as const, value: VALID_DEST },
        delegatedAmount: 5_000_000n,
        state: 1, // Initialized
        isNative: { __option: 'None' as const },
        closeAuthority: { __option: 'None' as const },
      },
      executable: false,
      lamports: 2_039_280n,
      programAddress: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address,
    } as never);

    const status = await checkDelegation(VALID_ADDRESS, mockRpcConfig);

    expect(status.isActive).toBe(true);
    expect(status.delegate).toBe(VALID_DEST);
    expect(status.remainingAmount).toBe(5_000_000n);
    expect(status.tokenMint).toBe(VALID_MINT);
    expect(status.ownerTokenAccount).toBe(VALID_ADDRESS);
  });

  it('should return inactive when no delegate', async () => {
    vi.mocked(fetchToken).mockResolvedValue({
      address: VALID_ADDRESS,
      data: {
        mint: VALID_MINT,
        owner: VALID_ADDRESS,
        amount: 100_000_000n,
        delegate: { __option: 'None' as const },
        delegatedAmount: 0n,
        state: 1,
        isNative: { __option: 'None' as const },
        closeAuthority: { __option: 'None' as const },
      },
      executable: false,
      lamports: 2_039_280n,
      programAddress: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address,
    } as never);

    const status = await checkDelegation(VALID_ADDRESS, mockRpcConfig);

    expect(status.isActive).toBe(false);
    expect(status.delegate).toBeNull();
    expect(status.remainingAmount).toBe(0n);
  });

  it('should return inactive when delegated amount is zero', async () => {
    vi.mocked(fetchToken).mockResolvedValue({
      address: VALID_ADDRESS,
      data: {
        mint: VALID_MINT,
        owner: VALID_ADDRESS,
        amount: 100_000_000n,
        delegate: { __option: 'Some' as const, value: VALID_DEST },
        delegatedAmount: 0n,
        state: 1,
        isNative: { __option: 'None' as const },
        closeAuthority: { __option: 'None' as const },
      },
      executable: false,
      lamports: 2_039_280n,
      programAddress: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address,
    } as never);

    const status = await checkDelegation(VALID_ADDRESS, mockRpcConfig);

    expect(status.isActive).toBe(false);
  });

  it('should throw RPC_ERROR on fetch failure', async () => {
    vi.mocked(fetchToken).mockRejectedValue(new Error('Network error'));

    await expect(checkDelegation(VALID_ADDRESS, mockRpcConfig)).rejects.toThrow(DelegationError);

    try {
      await checkDelegation(VALID_ADDRESS, mockRpcConfig);
    } catch (error) {
      expect((error as DelegationError).code).toBe(DelegationErrorCode.RPC_ERROR);
      expect((error as DelegationError).message).toContain('Network error');
    }
  });

  it('should reject invalid token account address', async () => {
    await expect(
      checkDelegation('bad-addr' as Address, mockRpcConfig),
    ).rejects.toThrow(/Invalid tokenAccount address/);
  });
});

describe('transferAsDelegate', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: active delegation with sufficient funds
    vi.mocked(fetchToken).mockResolvedValue({
      address: VALID_ADDRESS,
      data: {
        mint: VALID_MINT,
        owner: VALID_ADDRESS,
        amount: 100_000_000n,
        delegate: { __option: 'Some' as const, value: VALID_DEST },
        delegatedAmount: 10_000_000n,
        state: 1,
        isNative: { __option: 'None' as const },
        closeAuthority: { __option: 'None' as const },
      },
      executable: false,
      lamports: 2_039_280n,
      programAddress: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address,
    } as never);

    // Default: blockhash + simulate + send (checkDelegation uses fetchToken, not getLatestBlockhash)
    mockSend
      .mockResolvedValueOnce({ value: mockBlockhash }) // getLatestBlockhash (for transfer tx)
      .mockResolvedValueOnce({ value: { err: null } }) // simulateTransaction
      .mockResolvedValueOnce('mocksignature123'); // sendTransaction
  });

  it('should return transaction signature on success', async () => {
    const params = {
      delegateSigner: createMockSigner(VALID_DEST),
      sourceTokenAccount: VALID_ADDRESS,
      destinationTokenAccount: VALID_DEST,
      amount: 1_000_000n,
      decimals: 6,
      tokenMint: VALID_MINT,
      feePayer: createMockSigner(VALID_DEST),
    };

    const signature = await transferAsDelegate(params, mockRpcConfig);
    expect(signature).toBe('mocksignature123');
  });

  it('should reject when no active delegation', async () => {
    vi.mocked(fetchToken).mockResolvedValue({
      address: VALID_ADDRESS,
      data: {
        mint: VALID_MINT,
        owner: VALID_ADDRESS,
        amount: 100_000_000n,
        delegate: { __option: 'None' as const },
        delegatedAmount: 0n,
        state: 1,
        isNative: { __option: 'None' as const },
        closeAuthority: { __option: 'None' as const },
      },
      executable: false,
      lamports: 2_039_280n,
      programAddress: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address,
    } as never);

    const params = {
      delegateSigner: createMockSigner(VALID_DEST),
      sourceTokenAccount: VALID_ADDRESS,
      destinationTokenAccount: VALID_DEST,
      amount: 1_000_000n,
      decimals: 6,
      tokenMint: VALID_MINT,
      feePayer: createMockSigner(VALID_DEST),
    };

    try {
      await transferAsDelegate(params, mockRpcConfig);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DelegationError);
      expect((error as DelegationError).code).toBe(DelegationErrorCode.NO_ACTIVE_DELEGATION);
    }
  });

  it('should reject when transfer exceeds delegation', async () => {
    const params = {
      delegateSigner: createMockSigner(VALID_DEST),
      sourceTokenAccount: VALID_ADDRESS,
      destinationTokenAccount: VALID_DEST,
      amount: 20_000_000n, // More than the 10_000_000 delegation
      decimals: 6,
      tokenMint: VALID_MINT,
      feePayer: createMockSigner(VALID_DEST),
    };

    try {
      await transferAsDelegate(params, mockRpcConfig);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DelegationError);
      expect((error as DelegationError).code).toBe(DelegationErrorCode.INSUFFICIENT_DELEGATION);
      expect((error as DelegationError).message).toContain('requested 20000000');
    }
  });

  it('should reject when simulation fails', async () => {
    // Reset mockSend to clear the beforeEach queue, then set up fresh
    mockSend.mockReset();
    mockSend
      .mockResolvedValueOnce({ value: mockBlockhash }) // getLatestBlockhash
      .mockResolvedValueOnce({ value: { err: { InstructionError: [0, 'Custom'] } } }); // simulateTransaction

    const params = {
      delegateSigner: createMockSigner(VALID_DEST),
      sourceTokenAccount: VALID_ADDRESS,
      destinationTokenAccount: VALID_DEST,
      amount: 1_000_000n,
      decimals: 6,
      tokenMint: VALID_MINT,
      feePayer: createMockSigner(VALID_DEST),
    };

    await expect(transferAsDelegate(params, mockRpcConfig)).rejects.toThrow(DelegationError);
    mockSend.mockReset();
    mockSend
      .mockResolvedValueOnce({ value: mockBlockhash })
      .mockResolvedValueOnce({ value: { err: { InstructionError: [0, 'Custom'] } } });
    await expect(transferAsDelegate(params, mockRpcConfig)).rejects.toThrow(/simulation failed/i);
  });

  it('should reject zero transfer amount', async () => {
    const params = {
      delegateSigner: createMockSigner(VALID_DEST),
      sourceTokenAccount: VALID_ADDRESS,
      destinationTokenAccount: VALID_DEST,
      amount: 0n,
      decimals: 6,
      tokenMint: VALID_MINT,
      feePayer: createMockSigner(VALID_DEST),
    };

    await expect(transferAsDelegate(params, mockRpcConfig)).rejects.toThrow(/must be positive/);
  });

  it('should reject invalid destination address', async () => {
    const params = {
      delegateSigner: createMockSigner(VALID_DEST),
      sourceTokenAccount: VALID_ADDRESS,
      destinationTokenAccount: 'bad' as Address,
      amount: 1_000_000n,
      decimals: 6,
      tokenMint: VALID_MINT,
      feePayer: createMockSigner(VALID_DEST),
    };

    await expect(transferAsDelegate(params, mockRpcConfig)).rejects.toThrow(/Invalid destinationTokenAccount address/);
  });
});

describe('revokeDelegation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ value: mockBlockhash });
  });

  it('should build a revoke transaction message', async () => {
    const params = {
      ownerSigner: createMockSigner(),
      tokenAccount: VALID_ADDRESS,
    };

    const result = await revokeDelegation(params, mockRpcConfig);
    expect(result).toBeDefined();
    expect(result).toHaveProperty('instructions');
    expect(result).toHaveProperty('version', 0);
  });

  it('should reject invalid token account address', async () => {
    const params = {
      ownerSigner: createMockSigner(),
      tokenAccount: 'not-valid' as Address,
    };

    await expect(revokeDelegation(params, mockRpcConfig)).rejects.toThrow(DelegationError);
    await expect(revokeDelegation(params, mockRpcConfig)).rejects.toThrow(/Invalid tokenAccount address/);
  });
});
