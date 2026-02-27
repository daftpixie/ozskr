/**
 * approveAgentDelegation Unit Tests
 * Tests the unsigned approveChecked transaction builder.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Address } from '@solana/kit';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockGetLatestBlockhashSend,
  mockAssertIsAddress,
  mockFetch,
  mockCompileTransaction,
  mockGetTransactionEncoder,
} = vi.hoisted(() => {
  // Minimal compiled transaction mock
  const mockCompileTransaction = vi.fn(() => ({
    messageBytes: new Uint8Array(10),
    signatures: {},
  }));

  // Minimal encoder that returns a fixed byte array
  const mockGetTransactionEncoder = vi.fn(() => ({
    encode: vi.fn(() => new Uint8Array(200)),
  }));

  return {
    mockGetLatestBlockhashSend: vi.fn(),
    mockAssertIsAddress: vi.fn(),
    mockFetch: vi.fn(),
    mockCompileTransaction,
    mockGetTransactionEncoder,
  };
});

const mockRpc = {
  getLatestBlockhash: vi.fn(() => ({ send: mockGetLatestBlockhashSend })),
};

vi.mock('@solana/kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@solana/kit')>();
  return {
    ...actual,
    assertIsAddress: mockAssertIsAddress,
    createSolanaRpc: vi.fn(() => mockRpc),
    compileTransaction: mockCompileTransaction,
    getTransactionEncoder: mockGetTransactionEncoder,
  };
});

// Mock validate module — delegate !== owner check
const { mockValidateDelegateNotOwner } = vi.hoisted(() => ({
  mockValidateDelegateNotOwner: vi.fn(),
}));

vi.mock('./validate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./validate')>();
  return {
    ...actual,
    validateDelegateNotOwner: mockValidateDelegateNotOwner,
  };
});

import { approveAgentDelegation } from './approve-agent-delegation';
import { DelegationValidationError } from './validate';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
const USER_WALLET = 'So11111111111111111111111111111111111111112' as Address;
const AGENT_PUBKEY = 'AgentKey1111111111111111111111111111111111' as Address;
const TOKEN_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as Address;
const TOKEN_ACCOUNT = 'TokenAcct111111111111111111111111111111111' as Address;

const MOCK_BLOCKHASH = {
  blockhash: '4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi' as string,
  lastValidBlockHeight: 150_000n,
};

function makeValidParams() {
  return {
    rpc: mockRpc as unknown as Parameters<typeof approveAgentDelegation>[0]['rpc'],
    tokenAccountAddress: TOKEN_ACCOUNT,
    delegatePubkey: AGENT_PUBKEY,
    amount: 1_000_000n,
    tokenMint: TOKEN_MINT,
    decimals: 6,
    userWallet: USER_WALLET,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('approveAgentDelegation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertIsAddress.mockReturnValue(undefined);
    mockValidateDelegateNotOwner.mockReturnValue(undefined);
    mockGetLatestBlockhashSend.mockResolvedValue({ value: MOCK_BLOCKHASH });

    // Stub global fetch for simulation — default: no RPC URL set, simulation skipped
    vi.stubGlobal('fetch', mockFetch);
    delete process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  });

  describe('input validation', () => {
    it('should throw when amount is 0', async () => {
      const params = { ...makeValidParams(), amount: 0n };

      await expect(approveAgentDelegation(params)).rejects.toThrow('positive');
    });

    it('should throw when amount is negative', async () => {
      const params = { ...makeValidParams(), amount: -1n };

      await expect(approveAgentDelegation(params)).rejects.toThrow('positive');
    });

    it('should throw when decimals is out of range (negative)', async () => {
      const params = { ...makeValidParams(), decimals: -1 };

      await expect(approveAgentDelegation(params)).rejects.toThrow('decimals');
    });

    it('should throw when decimals exceeds 18', async () => {
      const params = { ...makeValidParams(), decimals: 19 };

      await expect(approveAgentDelegation(params)).rejects.toThrow('decimals');
    });

    it('should throw when decimals is not an integer', async () => {
      const params = { ...makeValidParams(), decimals: 6.5 };

      await expect(approveAgentDelegation(params)).rejects.toThrow('decimals');
    });

    it('should throw DelegationValidationError when delegate equals owner', async () => {
      mockValidateDelegateNotOwner.mockImplementation(() => {
        throw new DelegationValidationError('Self-delegation is not permitted');
      });

      const params = { ...makeValidParams(), delegatePubkey: USER_WALLET };

      await expect(approveAgentDelegation(params)).rejects.toThrow(DelegationValidationError);
    });

    it('should accept decimals of 0', async () => {
      const params = { ...makeValidParams(), decimals: 0 };

      await expect(approveAgentDelegation(params)).resolves.toBeDefined();
    });

    it('should accept decimals of 18', async () => {
      const params = { ...makeValidParams(), decimals: 18 };

      await expect(approveAgentDelegation(params)).resolves.toBeDefined();
    });
  });

  describe('successful transaction building', () => {
    it('should return a transaction object', async () => {
      const result = await approveAgentDelegation(makeValidParams());

      expect(result).toHaveProperty('transaction');
      expect(result.transaction).toBeDefined();
    });

    it('should call getLatestBlockhash to fetch recent blockhash', async () => {
      await approveAgentDelegation(makeValidParams());

      expect(mockGetLatestBlockhashSend).toHaveBeenCalledOnce();
    });

    it('should call assertIsAddress for all address inputs', async () => {
      await approveAgentDelegation(makeValidParams());

      // tokenAccountAddress, delegatePubkey, tokenMint, userWallet
      expect(mockAssertIsAddress).toHaveBeenCalledWith(TOKEN_ACCOUNT);
      expect(mockAssertIsAddress).toHaveBeenCalledWith(AGENT_PUBKEY);
      expect(mockAssertIsAddress).toHaveBeenCalledWith(TOKEN_MINT);
      expect(mockAssertIsAddress).toHaveBeenCalledWith(USER_WALLET);
    });

    it('should build instruction with TOKEN_PROGRAM_ID as programAddress', async () => {
      const result = await approveAgentDelegation(makeValidParams());

      // Inspect the instruction in the transaction
      const tx = result.transaction as unknown as {
        instructions: Array<{ programAddress: string; data: Uint8Array }>;
      };
      const instruction = tx.instructions[0];
      expect(instruction.programAddress).toBe(TOKEN_PROGRAM_ID);
    });

    it('should set discriminator byte 13 (ApproveChecked) in instruction data', async () => {
      const result = await approveAgentDelegation(makeValidParams());

      const tx = result.transaction as unknown as {
        instructions: Array<{ programAddress: string; data: Uint8Array }>;
      };
      const instruction = tx.instructions[0];
      expect(instruction.data[0]).toBe(13);
    });

    it('should encode amount as u64 little-endian in instruction data bytes 1-8', async () => {
      const amount = 5_000_000n;
      const result = await approveAgentDelegation({ ...makeValidParams(), amount });

      const tx = result.transaction as unknown as {
        instructions: Array<{ programAddress: string; data: Uint8Array }>;
      };
      const data = tx.instructions[0].data;

      // Read u64 LE from bytes 1..8
      const view = new DataView(data.buffer, data.byteOffset);
      const readAmount = view.getBigUint64(1, true);
      expect(readAmount).toBe(amount);
    });

    it('should encode decimals in instruction data byte 9', async () => {
      const decimals = 9;
      const result = await approveAgentDelegation({ ...makeValidParams(), decimals });

      const tx = result.transaction as unknown as {
        instructions: Array<{ programAddress: string; data: Uint8Array }>;
      };
      const data = tx.instructions[0].data;
      expect(data[9]).toBe(decimals);
    });

    it('should build instruction with exactly 10 bytes of data', async () => {
      const result = await approveAgentDelegation(makeValidParams());

      const tx = result.transaction as unknown as {
        instructions: Array<{ programAddress: string; data: Uint8Array }>;
      };
      expect(tx.instructions[0].data.length).toBe(10);
    });

    it('should include exactly 4 accounts in instruction', async () => {
      const result = await approveAgentDelegation(makeValidParams());

      const tx = result.transaction as unknown as {
        instructions: Array<{ accounts: unknown[] }>;
      };
      expect(tx.instructions[0].accounts).toHaveLength(4);
    });
  });

  describe('simulation', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_HELIUS_RPC_URL = 'https://devnet.helius-rpc.com';
    });

    it('should throw when simulation returns an error', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            result: {
              value: {
                err: { InstructionError: [0, 'Custom(6001)'] },
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await expect(approveAgentDelegation(makeValidParams())).rejects.toThrow(
        'approveChecked simulation failed'
      );
    });

    it('should not throw when simulation returns no error', async () => {
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({ result: { value: { err: null } } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await expect(approveAgentDelegation(makeValidParams())).resolves.toBeDefined();
    });

    it('should treat network errors during simulation as non-fatal', async () => {
      mockFetch.mockRejectedValue(new Error('Network unreachable'));

      // Should NOT throw — network errors are non-fatal per source code comments
      await expect(approveAgentDelegation(makeValidParams())).resolves.toBeDefined();
    });

    it('should treat non-OK HTTP responses as non-fatal', async () => {
      mockFetch.mockResolvedValue(
        new Response('Service unavailable', { status: 503 })
      );

      // Non-OK responses are non-fatal
      await expect(approveAgentDelegation(makeValidParams())).resolves.toBeDefined();
    });

    it('should skip simulation when NEXT_PUBLIC_HELIUS_RPC_URL is not set', async () => {
      delete process.env.NEXT_PUBLIC_HELIUS_RPC_URL;

      await approveAgentDelegation(makeValidParams());

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
