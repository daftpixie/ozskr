/**
 * deriveAgentTokenAccount Unit Tests
 * Tests PDA derivation with deterministic seeds.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Address } from '@solana/kit';

// Hoisted mock references
const {
  mockGetProgramDerivedAddress,
  mockAssertIsAddress,
  mockGetAddressEncoder,
} = vi.hoisted(() => ({
  mockGetProgramDerivedAddress: vi.fn(),
  mockAssertIsAddress: vi.fn(),
  mockGetAddressEncoder: vi.fn(),
}));

vi.mock('@solana/kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@solana/kit')>();
  return {
    ...actual,
    assertIsAddress: mockAssertIsAddress,
    getAddressEncoder: mockGetAddressEncoder,
    getProgramDerivedAddress: mockGetProgramDerivedAddress,
  };
});

import { deriveAgentTokenAccount } from './derive-agent-token-account';

const USER_WALLET = 'So11111111111111111111111111111111111111112' as Address;
const TOKEN_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as Address;
const DERIVED_PDA = 'DerivedPda111111111111111111111111111111111' as Address;
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;

// Minimal encoder that returns deterministic bytes per address
function makeEncoder() {
  const encoderFn = vi.fn((addr: Address) => {
    // Return a reproducible 32-byte array based on the address string
    const buf = new Uint8Array(32);
    const bytes = new TextEncoder().encode(addr);
    buf.set(bytes.subarray(0, Math.min(bytes.length, 32)));
    return buf;
  });
  return { encode: encoderFn };
}

describe('deriveAgentTokenAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertIsAddress.mockReturnValue(undefined);
    mockGetAddressEncoder.mockReturnValue(makeEncoder());
    mockGetProgramDerivedAddress.mockResolvedValue([DERIVED_PDA, 255] as [Address, number]);
  });

  describe('basic derivation', () => {
    it('should return the derived address and bump from getProgramDerivedAddress', async () => {
      const result = await deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, 'char-001');

      expect(result.address).toBe(DERIVED_PDA);
      expect(result.bump).toBe(255);
    });

    it('should call getProgramDerivedAddress with TOKEN_PROGRAM_ID as programAddress', async () => {
      await deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, 'char-001');

      expect(mockGetProgramDerivedAddress).toHaveBeenCalledWith(
        expect.objectContaining({ programAddress: TOKEN_PROGRAM_ID })
      );
    });

    it('should call getProgramDerivedAddress with 4 seeds', async () => {
      await deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, 'char-001');

      const callArgs = mockGetProgramDerivedAddress.mock.calls[0][0] as {
        seeds: Uint8Array[];
      };
      expect(callArgs.seeds).toHaveLength(4);
    });

    it('should use walletBytes as first seed (32 bytes)', async () => {
      await deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, 'char-001');

      const callArgs = mockGetProgramDerivedAddress.mock.calls[0][0] as {
        seeds: Uint8Array[];
      };
      expect(callArgs.seeds[0]).toBeInstanceOf(Uint8Array);
      expect((callArgs.seeds[0] as Uint8Array).length).toBe(32);
    });

    it('should use mintBytes as second seed (32 bytes)', async () => {
      await deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, 'char-001');

      const callArgs = mockGetProgramDerivedAddress.mock.calls[0][0] as {
        seeds: Uint8Array[];
      };
      expect(callArgs.seeds[1]).toBeInstanceOf(Uint8Array);
      expect((callArgs.seeds[1] as Uint8Array).length).toBe(32);
    });

    it('should use UTF-8 encoded characterId as third seed', async () => {
      const characterId = 'my-agent-123';
      await deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, characterId);

      const callArgs = mockGetProgramDerivedAddress.mock.calls[0][0] as {
        seeds: Uint8Array[];
      };
      const characterIdSeed = callArgs.seeds[2] as Uint8Array;
      const decoded = new TextDecoder().decode(characterIdSeed);
      expect(decoded).toBe(characterId);
    });

    it('should use UTF-8 "delegation" literal as fourth seed', async () => {
      await deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, 'char-001');

      const callArgs = mockGetProgramDerivedAddress.mock.calls[0][0] as {
        seeds: Uint8Array[];
      };
      const delegationSeed = callArgs.seeds[3] as Uint8Array;
      const decoded = new TextDecoder().decode(delegationSeed);
      expect(decoded).toBe('delegation');
    });
  });

  describe('address validation', () => {
    it('should call assertIsAddress for userWallet', async () => {
      await deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, 'char-001');

      expect(mockAssertIsAddress).toHaveBeenCalledWith(USER_WALLET);
    });

    it('should call assertIsAddress for tokenMint', async () => {
      await deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, 'char-001');

      expect(mockAssertIsAddress).toHaveBeenCalledWith(TOKEN_MINT);
    });

    it('should throw when assertIsAddress throws for userWallet', async () => {
      mockAssertIsAddress.mockImplementationOnce(() => {
        throw new Error('invalid address');
      });

      await expect(
        deriveAgentTokenAccount('bad-wallet' as Address, TOKEN_MINT, 'char-001')
      ).rejects.toThrow();
    });

    it('should throw when assertIsAddress throws for tokenMint', async () => {
      mockAssertIsAddress
        .mockReturnValueOnce(undefined) // userWallet passes
        .mockImplementationOnce(() => {
          throw new Error('invalid mint');
        });

      await expect(
        deriveAgentTokenAccount(USER_WALLET, 'bad-mint' as Address, 'char-001')
      ).rejects.toThrow();
    });
  });

  describe('characterId validation', () => {
    it('should throw when characterId is empty string', async () => {
      await expect(
        deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, '')
      ).rejects.toThrow('characterId');
    });

    it('should throw when characterId is only whitespace', async () => {
      await expect(
        deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, '   ')
      ).rejects.toThrow();
    });

    it('should accept a UUID as valid characterId', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      await expect(
        deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, uuid)
      ).resolves.not.toThrow();
    });
  });

  describe('determinism', () => {
    it('should call getProgramDerivedAddress with same seeds for identical inputs', async () => {
      const firstEncoder = makeEncoder();
      const secondEncoder = makeEncoder();
      mockGetAddressEncoder
        .mockReturnValueOnce(firstEncoder)
        .mockReturnValueOnce(secondEncoder);

      await deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, 'char-001');
      const firstCallArgs = mockGetProgramDerivedAddress.mock.calls[0][0] as {
        seeds: Uint8Array[];
      };

      await deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, 'char-001');
      const secondCallArgs = mockGetProgramDerivedAddress.mock.calls[1][0] as {
        seeds: Uint8Array[];
      };

      // Seeds at index 2 (characterId) and 3 (delegation) should encode identically
      expect(
        new TextDecoder().decode(firstCallArgs.seeds[2] as Uint8Array)
      ).toBe(
        new TextDecoder().decode(secondCallArgs.seeds[2] as Uint8Array)
      );
      expect(
        new TextDecoder().decode(firstCallArgs.seeds[3] as Uint8Array)
      ).toBe(
        new TextDecoder().decode(secondCallArgs.seeds[3] as Uint8Array)
      );
    });

    it('should produce different seeds when characterId differs', async () => {
      await deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, 'char-001');
      const firstCallArgs = mockGetProgramDerivedAddress.mock.calls[0][0] as {
        seeds: Uint8Array[];
      };

      await deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, 'char-002');
      const secondCallArgs = mockGetProgramDerivedAddress.mock.calls[1][0] as {
        seeds: Uint8Array[];
      };

      const firstCharId = new TextDecoder().decode(firstCallArgs.seeds[2] as Uint8Array);
      const secondCharId = new TextDecoder().decode(secondCallArgs.seeds[2] as Uint8Array);
      expect(firstCharId).not.toBe(secondCharId);
    });
  });

  describe('result shape', () => {
    it('should return an object with address and bump properties', async () => {
      const result = await deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, 'char-001');

      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('bump');
    });

    it('should return different bump values when mock returns different bumps', async () => {
      mockGetProgramDerivedAddress.mockResolvedValueOnce([DERIVED_PDA, 200] as [Address, number]);

      const result = await deriveAgentTokenAccount(USER_WALLET, TOKEN_MINT, 'char-001');

      expect(result.bump).toBe(200);
    });
  });
});
