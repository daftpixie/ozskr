/**
 * Tests for $HOPE Token Utilities
 */

import { describe, it, expect } from 'vitest';
import { formatHopeAmount, HOPE_MINT, HOPE_DECIMALS } from './hope-token';

describe('HOPE Token Constants', () => {
  it('should have valid mint address constant', () => {
    expect(HOPE_MINT).toBe('HoPExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    expect(HOPE_MINT.length).toBeGreaterThan(32);
  });

  it('should have correct decimals', () => {
    expect(HOPE_DECIMALS).toBe(6);
  });
});

describe('formatHopeAmount', () => {
  it('should format zero balance', () => {
    expect(formatHopeAmount(0)).toBe('0 $HOPE');
  });

  it('should format whole numbers', () => {
    expect(formatHopeAmount(100)).toBe('100 $HOPE');
    expect(formatHopeAmount(1000)).toBe('1,000 $HOPE');
    expect(formatHopeAmount(1000000)).toBe('1,000,000 $HOPE');
  });

  it('should format decimals with proper precision', () => {
    expect(formatHopeAmount(1.5)).toBe('1.5 $HOPE');
    expect(formatHopeAmount(1.23)).toBe('1.23 $HOPE');
    expect(formatHopeAmount(100.99)).toBe('100.99 $HOPE');
  });

  it('should format small amounts', () => {
    expect(formatHopeAmount(0.01)).toBe('0.01 $HOPE');
    expect(formatHopeAmount(0.1)).toBe('0.1 $HOPE');
  });

  it('should round to 2 decimal places', () => {
    expect(formatHopeAmount(1.234567)).toBe('1.23 $HOPE');
    expect(formatHopeAmount(99.999)).toBe('100 $HOPE');
  });

  it('should handle large numbers with thousands separators', () => {
    expect(formatHopeAmount(1234567.89)).toBe('1,234,567.89 $HOPE');
  });
});
