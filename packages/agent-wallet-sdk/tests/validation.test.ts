import { describe, it, expect } from 'vitest';
import { address } from '@solana/kit';
import { validateTokenMint } from '../src/validation.js';
import { USDC_MINT_MAINNET } from '../src/constants.js';
import { DelegationError, DelegationErrorCode } from '../src/types.js';

describe('validateTokenMint', () => {
  it('passes for matching mint addresses', () => {
    expect(() => validateTokenMint(USDC_MINT_MAINNET, USDC_MINT_MAINNET)).not.toThrow();
  });

  it('rejects spoofed USDC mint', () => {
    const spoofedMint = address('FakeUSDCmint11111111111111111111111111111111');
    expect(() => validateTokenMint(spoofedMint, USDC_MINT_MAINNET))
      .toThrow(DelegationError);
  });

  it('provides useful error message for spoofed mint', () => {
    const spoofedMint = address('FakeUSDCmint11111111111111111111111111111111');
    try {
      validateTokenMint(spoofedMint, USDC_MINT_MAINNET);
      // Should not reach here
      expect.fail('Expected DelegationError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DelegationError);
      expect((error as DelegationError).code).toBe(DelegationErrorCode.INVALID_ADDRESS);
      expect((error as DelegationError).message).toContain('spoofed token');
    }
  });

  it('rejects when mints are different valid addresses', () => {
    const mintA = address('So11111111111111111111111111111111111111112');
    const mintB = address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    expect(() => validateTokenMint(mintA, mintB)).toThrow(DelegationError);
  });
});
