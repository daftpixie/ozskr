/**
 * Access Tier Tests
 * Tests for tier determination, comparison, and display
 */

import { describe, it, expect } from 'vitest';
import {
  AccessTier,
  determineAccessTier,
  meetsMinimumTier,
  getTierLabel,
  TIER_THRESHOLDS,
  TIER_AGENT_LIMITS,
} from './access-tier';

describe('determineAccessTier', () => {
  it('returns ALPHA for 10,000+ $HOPE', () => {
    expect(determineAccessTier(10_000)).toBe(AccessTier.ALPHA);
    expect(determineAccessTier(50_000)).toBe(AccessTier.ALPHA);
    expect(determineAccessTier(10_000.01)).toBe(AccessTier.ALPHA);
  });

  it('returns BETA for 5,000-9,999 $HOPE', () => {
    expect(determineAccessTier(5_000)).toBe(AccessTier.BETA);
    expect(determineAccessTier(9_999)).toBe(AccessTier.BETA);
    expect(determineAccessTier(7_500)).toBe(AccessTier.BETA);
  });

  it('returns EARLY_ACCESS for 1,000-4,999 $HOPE', () => {
    expect(determineAccessTier(1_000)).toBe(AccessTier.EARLY_ACCESS);
    expect(determineAccessTier(4_999)).toBe(AccessTier.EARLY_ACCESS);
    expect(determineAccessTier(2_500)).toBe(AccessTier.EARLY_ACCESS);
  });

  it('returns WAITLIST for 0-999 $HOPE', () => {
    expect(determineAccessTier(0)).toBe(AccessTier.WAITLIST);
    expect(determineAccessTier(999)).toBe(AccessTier.WAITLIST);
    expect(determineAccessTier(500)).toBe(AccessTier.WAITLIST);
  });

  it('handles exact boundary values', () => {
    expect(determineAccessTier(999)).toBe(AccessTier.WAITLIST);
    expect(determineAccessTier(1_000)).toBe(AccessTier.EARLY_ACCESS);
    expect(determineAccessTier(4_999)).toBe(AccessTier.EARLY_ACCESS);
    expect(determineAccessTier(5_000)).toBe(AccessTier.BETA);
    expect(determineAccessTier(9_999)).toBe(AccessTier.BETA);
    expect(determineAccessTier(10_000)).toBe(AccessTier.ALPHA);
  });
});

describe('meetsMinimumTier', () => {
  it('ALPHA meets all tiers', () => {
    expect(meetsMinimumTier(AccessTier.ALPHA, AccessTier.ALPHA)).toBe(true);
    expect(meetsMinimumTier(AccessTier.ALPHA, AccessTier.BETA)).toBe(true);
    expect(meetsMinimumTier(AccessTier.ALPHA, AccessTier.EARLY_ACCESS)).toBe(true);
    expect(meetsMinimumTier(AccessTier.ALPHA, AccessTier.WAITLIST)).toBe(true);
  });

  it('BETA meets BETA, EARLY_ACCESS, WAITLIST', () => {
    expect(meetsMinimumTier(AccessTier.BETA, AccessTier.ALPHA)).toBe(false);
    expect(meetsMinimumTier(AccessTier.BETA, AccessTier.BETA)).toBe(true);
    expect(meetsMinimumTier(AccessTier.BETA, AccessTier.EARLY_ACCESS)).toBe(true);
    expect(meetsMinimumTier(AccessTier.BETA, AccessTier.WAITLIST)).toBe(true);
  });

  it('EARLY_ACCESS meets EARLY_ACCESS, WAITLIST', () => {
    expect(meetsMinimumTier(AccessTier.EARLY_ACCESS, AccessTier.ALPHA)).toBe(false);
    expect(meetsMinimumTier(AccessTier.EARLY_ACCESS, AccessTier.BETA)).toBe(false);
    expect(meetsMinimumTier(AccessTier.EARLY_ACCESS, AccessTier.EARLY_ACCESS)).toBe(true);
    expect(meetsMinimumTier(AccessTier.EARLY_ACCESS, AccessTier.WAITLIST)).toBe(true);
  });

  it('WAITLIST only meets WAITLIST', () => {
    expect(meetsMinimumTier(AccessTier.WAITLIST, AccessTier.ALPHA)).toBe(false);
    expect(meetsMinimumTier(AccessTier.WAITLIST, AccessTier.BETA)).toBe(false);
    expect(meetsMinimumTier(AccessTier.WAITLIST, AccessTier.EARLY_ACCESS)).toBe(false);
    expect(meetsMinimumTier(AccessTier.WAITLIST, AccessTier.WAITLIST)).toBe(true);
  });
});

describe('getTierLabel', () => {
  it('returns correct labels', () => {
    expect(getTierLabel(AccessTier.ALPHA)).toBe('Alpha Tester');
    expect(getTierLabel(AccessTier.BETA)).toBe('Beta Access');
    expect(getTierLabel(AccessTier.EARLY_ACCESS)).toBe('Early Access');
    expect(getTierLabel(AccessTier.WAITLIST)).toBe('Waitlist');
  });
});

describe('constants', () => {
  it('tier thresholds are in descending order', () => {
    expect(TIER_THRESHOLDS[AccessTier.ALPHA]).toBeGreaterThan(TIER_THRESHOLDS[AccessTier.BETA]);
    expect(TIER_THRESHOLDS[AccessTier.BETA]).toBeGreaterThan(TIER_THRESHOLDS[AccessTier.EARLY_ACCESS]);
    expect(TIER_THRESHOLDS[AccessTier.EARLY_ACCESS]).toBeGreaterThan(TIER_THRESHOLDS[AccessTier.WAITLIST]);
  });

  it('agent limits are in descending order', () => {
    expect(TIER_AGENT_LIMITS[AccessTier.ALPHA]).toBeGreaterThan(TIER_AGENT_LIMITS[AccessTier.BETA]);
    expect(TIER_AGENT_LIMITS[AccessTier.BETA]).toBeGreaterThan(TIER_AGENT_LIMITS[AccessTier.EARLY_ACCESS]);
    expect(TIER_AGENT_LIMITS[AccessTier.EARLY_ACCESS]).toBeGreaterThan(TIER_AGENT_LIMITS[AccessTier.WAITLIST]);
  });
});
