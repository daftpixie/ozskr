/**
 * Validate.ts Unit Tests
 * Pure validation helpers for the agent delegation subsystem.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock references
const { mockAssertIsAddress } = vi.hoisted(() => ({
  mockAssertIsAddress: vi.fn(),
}));

vi.mock('@solana/kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@solana/kit')>();
  return {
    ...actual,
    assertIsAddress: mockAssertIsAddress,
  };
});

// Import after mocks are set up
import {
  DelegationValidationError,
  validateTokenProgramId,
  validatePdaDerivation,
  validateDelegateNotOwner,
  validateAmountBigInt,
} from './validate';

// Import types from delegation types directly
import type { Address } from '@solana/kit';

// The real addresses used in the source
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address;
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address;
const VALID_ADDRESS_A = 'So11111111111111111111111111111111111111112' as Address;
const VALID_ADDRESS_B = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as Address;

describe('validateTokenProgramId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw DelegationValidationError for Token-2022 program ID', () => {
    expect(() => validateTokenProgramId(TOKEN_2022_PROGRAM_ID)).toThrow(DelegationValidationError);
  });

  it('should include descriptive message when rejecting Token-2022', () => {
    expect(() => validateTokenProgramId(TOKEN_2022_PROGRAM_ID)).toThrow('Token-2022');
  });

  it('should not throw for classic SPL Token Program ID', () => {
    expect(() => validateTokenProgramId(TOKEN_PROGRAM_ID)).not.toThrow();
  });

  it('should not throw for arbitrary non-Token-2022 addresses', () => {
    expect(() => validateTokenProgramId(VALID_ADDRESS_A)).not.toThrow();
    expect(() => validateTokenProgramId(VALID_ADDRESS_B)).not.toThrow();
  });

  it('should throw an error with name DelegationValidationError', () => {
    try {
      validateTokenProgramId(TOKEN_2022_PROGRAM_ID);
    } catch (err) {
      expect(err).toBeInstanceOf(DelegationValidationError);
      expect((err as Error).name).toBe('DelegationValidationError');
    }
  });
});

describe('validatePdaDerivation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: assertIsAddress passes (no throw)
    mockAssertIsAddress.mockReturnValue(undefined);
  });

  it('should not throw when all inputs are valid', () => {
    expect(() =>
      validatePdaDerivation(VALID_ADDRESS_A, VALID_ADDRESS_A, VALID_ADDRESS_B, 'char-123')
    ).not.toThrow();
  });

  it('should throw DelegationValidationError when assertIsAddress throws for derivedAddress', () => {
    mockAssertIsAddress.mockImplementationOnce(() => {
      throw new Error('invalid address');
    });

    expect(() =>
      validatePdaDerivation('not-valid' as Address, VALID_ADDRESS_A, VALID_ADDRESS_B, 'char-123')
    ).toThrow(DelegationValidationError);
  });

  it('should throw DelegationValidationError when assertIsAddress throws for userWallet', () => {
    mockAssertIsAddress
      .mockReturnValueOnce(undefined) // derivedAddress passes
      .mockImplementationOnce(() => {
        throw new Error('invalid wallet');
      });

    expect(() =>
      validatePdaDerivation(VALID_ADDRESS_A, 'bad-wallet' as Address, VALID_ADDRESS_B, 'char-123')
    ).toThrow(DelegationValidationError);
  });

  it('should throw DelegationValidationError when assertIsAddress throws for mint', () => {
    mockAssertIsAddress
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined)
      .mockImplementationOnce(() => {
        throw new Error('invalid mint');
      });

    expect(() =>
      validatePdaDerivation(VALID_ADDRESS_A, VALID_ADDRESS_A, 'bad-mint' as Address, 'char-123')
    ).toThrow(DelegationValidationError);
  });

  it('should throw DelegationValidationError when characterId is empty string', () => {
    expect(() =>
      validatePdaDerivation(VALID_ADDRESS_A, VALID_ADDRESS_A, VALID_ADDRESS_B, '')
    ).toThrow(DelegationValidationError);
  });

  it('should throw DelegationValidationError when characterId is only whitespace', () => {
    expect(() =>
      validatePdaDerivation(VALID_ADDRESS_A, VALID_ADDRESS_A, VALID_ADDRESS_B, '   ')
    ).toThrow(DelegationValidationError);
  });

  it('should include "characterId" in error message when characterId is empty', () => {
    expect(() =>
      validatePdaDerivation(VALID_ADDRESS_A, VALID_ADDRESS_A, VALID_ADDRESS_B, '')
    ).toThrow('characterId');
  });

  it('should accept a UUID as valid characterId', () => {
    expect(() =>
      validatePdaDerivation(
        VALID_ADDRESS_A,
        VALID_ADDRESS_A,
        VALID_ADDRESS_B,
        '550e8400-e29b-41d4-a716-446655440000'
      )
    ).not.toThrow();
  });
});

describe('validateDelegateNotOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw DelegationValidationError when delegate equals owner', () => {
    expect(() =>
      validateDelegateNotOwner(VALID_ADDRESS_A, VALID_ADDRESS_A)
    ).toThrow(DelegationValidationError);
  });

  it('should include owner address in error message', () => {
    expect(() =>
      validateDelegateNotOwner(VALID_ADDRESS_A, VALID_ADDRESS_A)
    ).toThrow(VALID_ADDRESS_A);
  });

  it('should not throw when delegate and owner are different addresses', () => {
    expect(() =>
      validateDelegateNotOwner(VALID_ADDRESS_A, VALID_ADDRESS_B)
    ).not.toThrow();
  });

  it('should not throw when owner is TOKEN_PROGRAM_ID and delegate is different', () => {
    expect(() =>
      validateDelegateNotOwner(VALID_ADDRESS_A, TOKEN_PROGRAM_ID)
    ).not.toThrow();
  });

  it('should include "Self-delegation" in the error message', () => {
    expect(() =>
      validateDelegateNotOwner(VALID_ADDRESS_A, VALID_ADDRESS_A)
    ).toThrow('Self-delegation');
  });
});

describe('validateAmountBigInt', () => {
  it('should parse a valid decimal string to bigint', () => {
    expect(validateAmountBigInt('1000000')).toBe(1000000n);
  });

  it('should parse "0" to 0n', () => {
    expect(validateAmountBigInt('0')).toBe(0n);
  });

  it('should parse u64 maximum value', () => {
    const U64_MAX = 18446744073709551615n;
    expect(validateAmountBigInt('18446744073709551615')).toBe(U64_MAX);
  });

  it('should parse large amount correctly', () => {
    expect(validateAmountBigInt('1000000000000')).toBe(1000000000000n);
  });

  it('should reject empty string', () => {
    expect(() => validateAmountBigInt('')).toThrow(DelegationValidationError);
  });

  it('should reject non-digit string', () => {
    expect(() => validateAmountBigInt('abc')).toThrow(DelegationValidationError);
  });

  it('should reject decimal number string', () => {
    expect(() => validateAmountBigInt('1.5')).toThrow(DelegationValidationError);
  });

  it('should reject string with negative sign', () => {
    expect(() => validateAmountBigInt('-1')).toThrow(DelegationValidationError);
  });

  it('should reject string with leading plus sign', () => {
    expect(() => validateAmountBigInt('+1')).toThrow(DelegationValidationError);
  });

  it('should reject strings with spaces', () => {
    expect(() => validateAmountBigInt('1 000')).toThrow(DelegationValidationError);
  });

  it('should reject string with hex prefix', () => {
    expect(() => validateAmountBigInt('0xff')).toThrow(DelegationValidationError);
  });

  it('should reject amount exceeding u64 max', () => {
    // u64 max + 1
    expect(() =>
      validateAmountBigInt('18446744073709551616')
    ).toThrow(DelegationValidationError);
  });

  it('should reject amount exceeding u64 max with descriptive message', () => {
    expect(() =>
      validateAmountBigInt('99999999999999999999')
    ).toThrow('u64 maximum');
  });

  it('should reject non-numeric character mixed with digits', () => {
    expect(() => validateAmountBigInt('123abc')).toThrow(DelegationValidationError);
  });

  it('should reject string with newline character', () => {
    expect(() => validateAmountBigInt('123\n456')).toThrow(DelegationValidationError);
  });
});
