/**
 * checkAgentDelegation / checkAllAgentDelegations Unit Tests
 * Tests on-chain delegation status parsing from SPL token account data.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Address } from '@solana/kit';

// ---------------------------------------------------------------------------
// Constants (must match source)
// ---------------------------------------------------------------------------
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address;
const MINT_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as Address;
const OWNER_ADDRESS = 'So11111111111111111111111111111111111111112' as Address;
const DELEGATE_ADDRESS = 'AgentKey1111111111111111111111111111111111' as Address;
const TOKEN_ACCOUNT_ADDRESS = 'TokenAcct111111111111111111111111111111111' as Address;

// ---------------------------------------------------------------------------
// SPL token account buffer builder (165 bytes)
// Layout:
//   [0..31]   mint (32 bytes)
//   [32..63]  owner (32 bytes)
//   [64..71]  amount (u64 LE)
//   [72..75]  delegate_option (u32 LE, 0=None, 1=Some)
//   [76..107] delegate (32 bytes)
//   [108]     state (u8)
//   [109..112] is_native_option (u32 LE)
//   [113..120] is_native (u64 LE)
//   [121..128] delegated_amount (u64 LE)
//   [129..132] close_authority_option (u32 LE)
//   [133..164] close_authority (32 bytes)
// ---------------------------------------------------------------------------

function encodeAddress(addr: string): Uint8Array {
  // For testing: derive deterministic 32-byte encoding from base58 string
  // We use the real @solana/kit encoder behavior by filling with known patterns
  const buf = new Uint8Array(32);
  const encoded = new TextEncoder().encode(addr);
  buf.set(encoded.subarray(0, Math.min(encoded.length, 32)));
  return buf;
}

interface SplTokenAccountFields {
  mint?: string;
  owner?: string;
  amount?: bigint;
  delegateOption?: number;
  delegate?: string;
  state?: number;
  delegatedAmount?: bigint;
}

function buildSplTokenAccountBuffer(fields: SplTokenAccountFields = {}): Uint8Array {
  const buf = new Uint8Array(165);
  const view = new DataView(buf.buffer);

  // mint [0..31]
  const mintBytes = encodeAddress(fields.mint ?? MINT_ADDRESS);
  buf.set(mintBytes, 0);

  // owner [32..63]
  const ownerBytes = encodeAddress(fields.owner ?? OWNER_ADDRESS);
  buf.set(ownerBytes, 32);

  // amount [64..71] u64 LE
  const amount = fields.amount ?? 5_000_000n;
  view.setBigUint64(64, amount, true);

  // delegate_option [72..75] u32 LE
  const delegateOption = fields.delegateOption ?? 0;
  view.setUint32(72, delegateOption, true);

  // delegate [76..107]
  const delegateBytes = encodeAddress(fields.delegate ?? DELEGATE_ADDRESS);
  buf.set(delegateBytes, 76);

  // state [108]
  buf[108] = fields.state ?? 1; // 1 = initialized

  // is_native_option [109..112]
  view.setUint32(109, 0, true);

  // is_native [113..120]
  view.setBigUint64(113, 0n, true);

  // delegated_amount [121..128] u64 LE
  const delegatedAmount = fields.delegatedAmount ?? 0n;
  view.setBigUint64(121, delegatedAmount, true);

  // close_authority_option [129..132]
  view.setUint32(129, 0, true);

  // close_authority [133..164]
  buf.set(new Uint8Array(32), 133);

  return buf;
}

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockGetAccountInfoSend,
  mockGetMultipleAccountsSend,
  mockAssertIsAddress,
  mockAddressFn,
  sharedDecoder,
} = vi.hoisted(() => {
  // Build a decoder that is set up before module import (module-level cached)
  const decoderDecodeFn = vi.fn((data: Uint8Array, offset: number): string => {
    const slice = data.slice(offset, offset + 32);
    const decoded = new TextDecoder().decode(slice).replace(/\0/g, '');
    return decoded;
  });
  const sharedDecoder = { decode: decoderDecodeFn };

  return {
    mockGetAccountInfoSend: vi.fn(),
    mockGetMultipleAccountsSend: vi.fn(),
    mockAssertIsAddress: vi.fn(),
    mockAddressFn: vi.fn((addr: string) => addr as Address),
    sharedDecoder,
  };
});

const mockRpc = {
  getAccountInfo: vi.fn(() => ({ send: mockGetAccountInfoSend })),
  getMultipleAccounts: vi.fn(() => ({ send: mockGetMultipleAccountsSend })),
};

vi.mock('@solana/kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@solana/kit')>();
  return {
    ...actual,
    assertIsAddress: mockAssertIsAddress,
    address: mockAddressFn,
    createSolanaRpc: vi.fn(() => mockRpc),
    getAddressDecoder: vi.fn(() => sharedDecoder),
  };
});

import {
  checkAgentDelegation,
  checkAllAgentDelegations,
} from './check-agent-delegation';

function makeBase64AccountData(buf: Uint8Array): string {
  return Buffer.from(buf).toString('base64');
}

// ---------------------------------------------------------------------------
// Tests: checkAgentDelegation
// ---------------------------------------------------------------------------

describe('checkAgentDelegation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertIsAddress.mockReturnValue(undefined);
    mockAddressFn.mockImplementation((addr: string) => addr as Address);
  });

  describe('account does not exist', () => {
    it('should return inactive status when result.value is null', async () => {
      mockGetAccountInfoSend.mockResolvedValue({ value: null });

      const status = await checkAgentDelegation(
        mockRpc as unknown as Parameters<typeof checkAgentDelegation>[0],
        TOKEN_ACCOUNT_ADDRESS
      );

      expect(status.isActive).toBe(false);
      expect(status.delegate).toBeNull();
      expect(status.remainingAmount).toBe(0n);
      expect(status.balance).toBe(0n);
      expect(status.tokenAccount).toBe(TOKEN_ACCOUNT_ADDRESS);
    });

    it('should return tokenAccount matching the queried address when account is missing', async () => {
      mockGetAccountInfoSend.mockResolvedValue({ value: null });

      const status = await checkAgentDelegation(
        mockRpc as unknown as Parameters<typeof checkAgentDelegation>[0],
        TOKEN_ACCOUNT_ADDRESS
      );

      expect(status.tokenAccount).toBe(TOKEN_ACCOUNT_ADDRESS);
    });
  });

  describe('account exists with active delegation', () => {
    it('should detect active delegation when delegateOption=1 and delegatedAmount>0', async () => {
      const buf = buildSplTokenAccountBuffer({
        delegateOption: 1,
        delegatedAmount: 1_000_000n,
        amount: 5_000_000n,
      });

      mockGetAccountInfoSend.mockResolvedValue({
        value: {
          owner: TOKEN_PROGRAM_ID,
          data: [makeBase64AccountData(buf), 'base64'],
        },
      });

      const status = await checkAgentDelegation(
        mockRpc as unknown as Parameters<typeof checkAgentDelegation>[0],
        TOKEN_ACCOUNT_ADDRESS
      );

      expect(status.isActive).toBe(true);
      expect(status.remainingAmount).toBe(1_000_000n);
    });

    it('should parse balance correctly from amount field', async () => {
      const buf = buildSplTokenAccountBuffer({
        delegateOption: 1,
        delegatedAmount: 500_000n,
        amount: 2_000_000n,
      });

      mockGetAccountInfoSend.mockResolvedValue({
        value: {
          owner: TOKEN_PROGRAM_ID,
          data: [makeBase64AccountData(buf), 'base64'],
        },
      });

      const status = await checkAgentDelegation(
        mockRpc as unknown as Parameters<typeof checkAgentDelegation>[0],
        TOKEN_ACCOUNT_ADDRESS
      );

      expect(status.balance).toBe(2_000_000n);
    });

    it('should return programId as TOKEN_PROGRAM_ID for classic SPL accounts', async () => {
      const buf = buildSplTokenAccountBuffer({ delegateOption: 1, delegatedAmount: 100n });

      mockGetAccountInfoSend.mockResolvedValue({
        value: {
          owner: TOKEN_PROGRAM_ID,
          data: [makeBase64AccountData(buf), 'base64'],
        },
      });

      const status = await checkAgentDelegation(
        mockRpc as unknown as Parameters<typeof checkAgentDelegation>[0],
        TOKEN_ACCOUNT_ADDRESS
      );

      expect(status.programId).toBe(TOKEN_PROGRAM_ID);
    });
  });

  describe('account exists with inactive delegation', () => {
    it('should return isActive=false when delegateOption=0', async () => {
      const buf = buildSplTokenAccountBuffer({
        delegateOption: 0,
        delegatedAmount: 0n,
      });

      mockGetAccountInfoSend.mockResolvedValue({
        value: {
          owner: TOKEN_PROGRAM_ID,
          data: [makeBase64AccountData(buf), 'base64'],
        },
      });

      const status = await checkAgentDelegation(
        mockRpc as unknown as Parameters<typeof checkAgentDelegation>[0],
        TOKEN_ACCOUNT_ADDRESS
      );

      expect(status.isActive).toBe(false);
    });

    it('should return isActive=false when delegateOption=1 but delegatedAmount=0', async () => {
      const buf = buildSplTokenAccountBuffer({
        delegateOption: 1,
        delegatedAmount: 0n,
      });

      mockGetAccountInfoSend.mockResolvedValue({
        value: {
          owner: TOKEN_PROGRAM_ID,
          data: [makeBase64AccountData(buf), 'base64'],
        },
      });

      const status = await checkAgentDelegation(
        mockRpc as unknown as Parameters<typeof checkAgentDelegation>[0],
        TOKEN_ACCOUNT_ADDRESS
      );

      expect(status.isActive).toBe(false);
    });

    it('should return delegate=null when delegateOption=0', async () => {
      const buf = buildSplTokenAccountBuffer({ delegateOption: 0, delegatedAmount: 0n });

      mockGetAccountInfoSend.mockResolvedValue({
        value: {
          owner: TOKEN_PROGRAM_ID,
          data: [makeBase64AccountData(buf), 'base64'],
        },
      });

      const status = await checkAgentDelegation(
        mockRpc as unknown as Parameters<typeof checkAgentDelegation>[0],
        TOKEN_ACCOUNT_ADDRESS
      );

      expect(status.delegate).toBeNull();
    });
  });

  describe('Token-2022 detection', () => {
    it('should return programId as TOKEN_2022_PROGRAM_ID when owner is Token-2022', async () => {
      const buf = buildSplTokenAccountBuffer({ delegateOption: 1, delegatedAmount: 100n });

      mockGetAccountInfoSend.mockResolvedValue({
        value: {
          owner: TOKEN_2022_PROGRAM_ID,
          data: [makeBase64AccountData(buf), 'base64'],
        },
      });

      // address() fn: TOKEN_2022_PROGRAM_ID === TOKEN_2022_PROGRAM_ID
      mockAddressFn.mockImplementation((addr: string) => addr as Address);

      const status = await checkAgentDelegation(
        mockRpc as unknown as Parameters<typeof checkAgentDelegation>[0],
        TOKEN_ACCOUNT_ADDRESS
      );

      expect(status.programId).toBe(TOKEN_2022_PROGRAM_ID);
    });
  });

  describe('data encoding fallback', () => {
    it('should handle plain string data (non-array format)', async () => {
      const buf = buildSplTokenAccountBuffer({ delegateOption: 1, delegatedAmount: 50_000n });

      mockGetAccountInfoSend.mockResolvedValue({
        value: {
          owner: TOKEN_PROGRAM_ID,
          data: makeBase64AccountData(buf), // plain string, not array
        },
      });

      const status = await checkAgentDelegation(
        mockRpc as unknown as Parameters<typeof checkAgentDelegation>[0],
        TOKEN_ACCOUNT_ADDRESS
      );

      expect(status.isActive).toBe(true);
      expect(status.remainingAmount).toBe(50_000n);
    });

    it('should return inactive status when data is unexpected type', async () => {
      mockGetAccountInfoSend.mockResolvedValue({
        value: {
          owner: TOKEN_PROGRAM_ID,
          data: 12345, // not string or array
        },
      });

      const status = await checkAgentDelegation(
        mockRpc as unknown as Parameters<typeof checkAgentDelegation>[0],
        TOKEN_ACCOUNT_ADDRESS
      );

      expect(status.isActive).toBe(false);
    });

    it('should return inactive status when buffer is too short', async () => {
      const shortBuf = new Uint8Array(100); // less than 165 bytes
      mockGetAccountInfoSend.mockResolvedValue({
        value: {
          owner: TOKEN_PROGRAM_ID,
          data: [Buffer.from(shortBuf).toString('base64'), 'base64'],
        },
      });

      const status = await checkAgentDelegation(
        mockRpc as unknown as Parameters<typeof checkAgentDelegation>[0],
        TOKEN_ACCOUNT_ADDRESS
      );

      expect(status.isActive).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw when RPC call fails', async () => {
      mockGetAccountInfoSend.mockRejectedValue(new Error('RPC unavailable'));

      await expect(
        checkAgentDelegation(
          mockRpc as unknown as Parameters<typeof checkAgentDelegation>[0],
          TOKEN_ACCOUNT_ADDRESS
        )
      ).rejects.toThrow();
    });

    it('should include the account address in the thrown error message', async () => {
      mockGetAccountInfoSend.mockRejectedValue(new Error('connection refused'));

      await expect(
        checkAgentDelegation(
          mockRpc as unknown as Parameters<typeof checkAgentDelegation>[0],
          TOKEN_ACCOUNT_ADDRESS
        )
      ).rejects.toThrow(TOKEN_ACCOUNT_ADDRESS);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: checkAllAgentDelegations
// ---------------------------------------------------------------------------

describe('checkAllAgentDelegations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertIsAddress.mockReturnValue(undefined);
    mockAddressFn.mockImplementation((addr: string) => addr as Address);
  });

  describe('empty input', () => {
    it('should return an empty map when addresses array is empty', async () => {
      const result = await checkAllAgentDelegations(
        mockRpc as unknown as Parameters<typeof checkAllAgentDelegations>[0],
        []
      );

      expect(result.size).toBe(0);
      expect(mockGetMultipleAccountsSend).not.toHaveBeenCalled();
    });
  });

  describe('missing accounts', () => {
    it('should return inactive status for null accounts in getMultipleAccounts', async () => {
      const addresses = [TOKEN_ACCOUNT_ADDRESS, 'TokenAcct222222222222222222222222222222222' as Address];

      mockGetMultipleAccountsSend.mockResolvedValue({
        value: [null, null],
      });

      const result = await checkAllAgentDelegations(
        mockRpc as unknown as Parameters<typeof checkAllAgentDelegations>[0],
        addresses
      );

      expect(result.size).toBe(2);
      for (const addr of addresses) {
        const status = result.get(addr);
        expect(status?.isActive).toBe(false);
        expect(status?.delegate).toBeNull();
        expect(status?.remainingAmount).toBe(0n);
      }
    });
  });

  describe('batching', () => {
    // Generate unique Solana-base58-like addresses of exactly 44 chars
    function makeUniqueAddresses(count: number): Address[] {
      return Array.from({ length: count }, (_, i) => {
        // Zero-pad i to 10 digits, prefix with 'Addr' (4), suffix ensures 44 total
        const suffix = String(i).padStart(10, '0');
        return `Addr${suffix}111111111111111111111111111111` as Address;
      });
    }

    it('should call getMultipleAccounts twice when given more than 100 addresses', async () => {
      const addresses = makeUniqueAddresses(150);

      // Each batch call returns all-null (missing accounts)
      mockGetMultipleAccountsSend.mockResolvedValue({ value: new Array(100).fill(null) });

      await checkAllAgentDelegations(
        mockRpc as unknown as Parameters<typeof checkAllAgentDelegations>[0],
        addresses
      );

      expect(mockGetMultipleAccountsSend).toHaveBeenCalledTimes(2);
    });

    it('should correctly handle first batch of 100 and second batch of 50 for 150 addresses', async () => {
      const addresses = makeUniqueAddresses(150);

      const activeBuf = buildSplTokenAccountBuffer({ delegateOption: 1, delegatedAmount: 1000n });

      // First batch: 100 active accounts
      mockGetMultipleAccountsSend.mockResolvedValueOnce({
        value: new Array(100).fill({
          owner: TOKEN_PROGRAM_ID,
          data: [makeBase64AccountData(activeBuf), 'base64'],
        }),
      });

      // Second batch: 50 null accounts
      mockGetMultipleAccountsSend.mockResolvedValueOnce({
        value: new Array(50).fill(null),
      });

      const result = await checkAllAgentDelegations(
        mockRpc as unknown as Parameters<typeof checkAllAgentDelegations>[0],
        addresses
      );

      // All 150 unique addresses should be in the result map
      expect(result.size).toBe(150);
    });

    it('should call getMultipleAccounts exactly once for exactly 100 addresses', async () => {
      const addresses = makeUniqueAddresses(100);

      mockGetMultipleAccountsSend.mockResolvedValue({ value: new Array(100).fill(null) });

      await checkAllAgentDelegations(
        mockRpc as unknown as Parameters<typeof checkAllAgentDelegations>[0],
        addresses
      );

      expect(mockGetMultipleAccountsSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should throw when getMultipleAccounts fails', async () => {
      const addresses = [TOKEN_ACCOUNT_ADDRESS];
      mockGetMultipleAccountsSend.mockRejectedValue(new Error('RPC error'));

      await expect(
        checkAllAgentDelegations(
          mockRpc as unknown as Parameters<typeof checkAllAgentDelegations>[0],
          addresses
        )
      ).rejects.toThrow();
    });

    it('should include batch index in error message when getMultipleAccounts fails', async () => {
      const addresses = [TOKEN_ACCOUNT_ADDRESS];
      mockGetMultipleAccountsSend.mockRejectedValue(new Error('connection timeout'));

      await expect(
        checkAllAgentDelegations(
          mockRpc as unknown as Parameters<typeof checkAllAgentDelegations>[0],
          addresses
        )
      ).rejects.toThrow('batch');
    });
  });

  describe('active accounts in batch', () => {
    it('should correctly parse active delegation in batch response', async () => {
      const activeBuf = buildSplTokenAccountBuffer({
        delegateOption: 1,
        delegatedAmount: 2_500_000n,
        amount: 10_000_000n,
      });

      mockGetMultipleAccountsSend.mockResolvedValue({
        value: [
          {
            owner: TOKEN_PROGRAM_ID,
            data: [makeBase64AccountData(activeBuf), 'base64'],
          },
        ],
      });

      const result = await checkAllAgentDelegations(
        mockRpc as unknown as Parameters<typeof checkAllAgentDelegations>[0],
        [TOKEN_ACCOUNT_ADDRESS]
      );

      const status = result.get(TOKEN_ACCOUNT_ADDRESS);
      expect(status?.isActive).toBe(true);
      expect(status?.remainingAmount).toBe(2_500_000n);
      expect(status?.balance).toBe(10_000_000n);
    });

    it('should return TOKEN_2022_PROGRAM_ID in programId for Token-2022 accounts in batch', async () => {
      const buf = buildSplTokenAccountBuffer({ delegateOption: 1, delegatedAmount: 100n });

      mockGetMultipleAccountsSend.mockResolvedValue({
        value: [
          {
            owner: TOKEN_2022_PROGRAM_ID,
            data: [makeBase64AccountData(buf), 'base64'],
          },
        ],
      });

      const result = await checkAllAgentDelegations(
        mockRpc as unknown as Parameters<typeof checkAllAgentDelegations>[0],
        [TOKEN_ACCOUNT_ADDRESS]
      );

      const status = result.get(TOKEN_ACCOUNT_ADDRESS);
      expect(status?.programId).toBe(TOKEN_2022_PROGRAM_ID);
    });

    it('should return inactive status for accounts with too-short data in batch', async () => {
      const shortBuf = new Uint8Array(50);

      mockGetMultipleAccountsSend.mockResolvedValue({
        value: [
          {
            owner: TOKEN_PROGRAM_ID,
            data: [Buffer.from(shortBuf).toString('base64'), 'base64'],
          },
        ],
      });

      const result = await checkAllAgentDelegations(
        mockRpc as unknown as Parameters<typeof checkAllAgentDelegations>[0],
        [TOKEN_ACCOUNT_ADDRESS]
      );

      const status = result.get(TOKEN_ACCOUNT_ADDRESS);
      expect(status?.isActive).toBe(false);
    });
  });
});
