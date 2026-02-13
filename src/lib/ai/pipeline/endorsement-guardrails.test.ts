/**
 * Endorsement Guardrails Tests
 * Tests for investment language detection and endorsement disclosure enforcement
 */

import { describe, it, expect, vi } from 'vitest';
import { ModerationStatus } from '@/types/database';
import {
  checkInvestmentLanguage,
  checkEndorsementDisclosure,
  runEndorsementGuardrails,
} from './endorsement-guardrails';

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('checkInvestmentLanguage', () => {
  it('rejects "$HOPE will increase in value"', () => {
    const result = checkInvestmentLanguage('Buy now! $HOPE will increase in value soon');
    expect(result).not.toBeNull();
    expect(result?.status).toBe(ModerationStatus.REJECTED);
    expect(result?.details.rule).toBe('investment-language');
  });

  it('rejects "$HOPE investment" language', () => {
    const result = checkInvestmentLanguage('$HOPE investment is a great opportunity');
    expect(result).not.toBeNull();
    expect(result?.status).toBe(ModerationStatus.REJECTED);
  });

  it('rejects "invest in $HOPE"', () => {
    const result = checkInvestmentLanguage('You should invest in $HOPE today');
    expect(result).not.toBeNull();
    expect(result?.status).toBe(ModerationStatus.REJECTED);
  });

  it('rejects "$HOPE price prediction"', () => {
    const result = checkInvestmentLanguage('My $HOPE price prediction for next month');
    expect(result).not.toBeNull();
    expect(result?.status).toBe(ModerationStatus.REJECTED);
  });

  it('rejects "buy $HOPE before" language', () => {
    const result = checkInvestmentLanguage('Buy $HOPE before the price goes up');
    expect(result).not.toBeNull();
    expect(result?.status).toBe(ModerationStatus.REJECTED);
  });

  it('rejects "$HOPE to the moon"', () => {
    const result = checkInvestmentLanguage('$HOPE to the moon!');
    expect(result).not.toBeNull();
    expect(result?.status).toBe(ModerationStatus.REJECTED);
  });

  it('rejects "financial returns" language', () => {
    const result = checkInvestmentLanguage('Get great financial returns with $HOPE');
    expect(result).not.toBeNull();
    expect(result?.status).toBe(ModerationStatus.REJECTED);
  });

  it('rejects "$HOPE guaranteed" language', () => {
    const result = checkInvestmentLanguage('$HOPE is a guaranteed success');
    expect(result).not.toBeNull();
    expect(result?.status).toBe(ModerationStatus.REJECTED);
  });

  it('allows utility-framed $HOPE language', () => {
    const result = checkInvestmentLanguage('Earn $HOPE through platform activity to unlock premium features');
    expect(result).toBeNull();
  });

  it('allows "$HOPE unlocks premium features"', () => {
    const result = checkInvestmentLanguage('Hold $HOPE to access tier benefits and premium features');
    expect(result).toBeNull();
  });

  it('allows content without $HOPE mention', () => {
    const result = checkInvestmentLanguage('Building AI agents on Solana is amazing');
    expect(result).toBeNull();
  });

  it('allows empty string', () => {
    const result = checkInvestmentLanguage('');
    expect(result).toBeNull();
  });
});

describe('checkEndorsementDisclosure', () => {
  it('rejects endorsement content without disclosure', () => {
    const result = checkEndorsementDisclosure('We partnered with SolanaFM to bring you this feature');
    expect(result).not.toBeNull();
    expect(result?.status).toBe(ModerationStatus.REJECTED);
    expect(result?.details.rule).toBe('missing-endorsement-disclosure');
  });

  it('rejects sponsored content without disclosure', () => {
    const result = checkEndorsementDisclosure('Check out this promo from our friends at Jupiter');
    expect(result).not.toBeNull();
    expect(result?.status).toBe(ModerationStatus.REJECTED);
  });

  it('rejects affiliate content without disclosure', () => {
    const result = checkEndorsementDisclosure('Use my referral code OZSKR for a bonus');
    expect(result).not.toBeNull();
    expect(result?.status).toBe(ModerationStatus.REJECTED);
  });

  it('allows endorsement content with #ad', () => {
    const result = checkEndorsementDisclosure('We partnered with SolanaFM #ad');
    expect(result).toBeNull();
  });

  it('allows endorsement content with #sponsored', () => {
    const result = checkEndorsementDisclosure('Check out this promotion #sponsored');
    expect(result).toBeNull();
  });

  it('allows endorsement content with #partner', () => {
    const result = checkEndorsementDisclosure('Our partnership with Jupiter #partner');
    expect(result).toBeNull();
  });

  it('allows endorsement content with "paid partnership"', () => {
    const result = checkEndorsementDisclosure('This is a paid partnership with Helius');
    expect(result).toBeNull();
  });

  it('allows non-endorsement content without disclosure', () => {
    const result = checkEndorsementDisclosure('Just built a cool AI agent today');
    expect(result).toBeNull();
  });

  it('allows empty string', () => {
    const result = checkEndorsementDisclosure('');
    expect(result).toBeNull();
  });
});

describe('runEndorsementGuardrails', () => {
  it('rejects investment language over missing endorsement disclosure', () => {
    // Both violations present — investment language takes priority
    const result = runEndorsementGuardrails(
      'We partnered to promote $HOPE investment opportunity'
    );
    expect(result).not.toBeNull();
    expect(result?.details.rule).toBe('investment-language');
  });

  it('catches endorsement violations when no investment language', () => {
    const result = runEndorsementGuardrails(
      'Amazing collaboration with Jupiter Exchange!'
    );
    expect(result).not.toBeNull();
    expect(result?.details.rule).toBe('missing-endorsement-disclosure');
  });

  it('passes clean content', () => {
    const result = runEndorsementGuardrails(
      'Just generated an amazing AI character with ozskr.ai'
    );
    expect(result).toBeNull();
  });

  it('passes properly disclosed endorsement content', () => {
    const result = runEndorsementGuardrails(
      'Our partnership with Jupiter brings instant swaps #partner'
    );
    expect(result).toBeNull();
  });

  it('passes utility-framed $HOPE content', () => {
    const result = runEndorsementGuardrails(
      'Earn $HOPE by creating content and growing your community!'
    );
    expect(result).toBeNull();
  });
});
