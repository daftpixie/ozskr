/**
 * Cron Expression Utils Tests
 * Tests cron expression parsing and next run time computation
 *
 * NOTE: getNextRunTime uses local time methods (getHours, getMinutes, etc.)
 * so tests must construct dates using local time, not UTC strings.
 */

import { describe, it, expect } from 'vitest';
import { getNextRunTime } from './cron-utils';

describe('cron-utils', () => {
  describe('getNextRunTime', () => {
    it('should return next minute for "* * * * *"', () => {
      const now = new Date(2024, 0, 15, 10, 30, 45); // local time
      const next = getNextRunTime('* * * * *', now);

      expect(next.getMinutes()).toBe(31);
      expect(next.getSeconds()).toBe(0);
      expect(next.getMilliseconds()).toBe(0);
    });

    it('should return correct 15-min intervals for "*/15 * * * *"', () => {
      const now = new Date(2024, 0, 15, 10, 7, 0);
      const next = getNextRunTime('*/15 * * * *', now);

      // Next valid minute is 15
      expect(next.getMinutes()).toBe(15);
      expect(next.getHours()).toBe(10);
    });

    it('should return next hour for "*/15 * * * *" when past last interval', () => {
      const now = new Date(2024, 0, 15, 10, 52, 0);
      const next = getNextRunTime('*/15 * * * *', now);

      // Next valid minute is 0 of next hour
      expect(next.getMinutes()).toBe(0);
      expect(next.getHours()).toBe(11);
    });

    it('should return 9:30 AM next day if past that time for "30 9 * * *"', () => {
      const now = new Date(2024, 0, 15, 10, 0, 0);
      const next = getNextRunTime('30 9 * * *', now);

      // 9:30 today already passed, should be tomorrow
      expect(next.getMinutes()).toBe(30);
      expect(next.getHours()).toBe(9);
      expect(next.getDate()).toBe(16);
    });

    it('should return today at 9:30 if before that time for "30 9 * * *"', () => {
      const now = new Date(2024, 0, 15, 8, 0, 0);
      const next = getNextRunTime('30 9 * * *', now);

      // 9:30 today hasn't happened yet
      expect(next.getMinutes()).toBe(30);
      expect(next.getHours()).toBe(9);
      expect(next.getDate()).toBe(15);
    });

    it('should return next Monday at noon for "0 12 * * 1"', () => {
      // Jan 14, 2024 is a Sunday in local time
      const now = new Date(2024, 0, 14, 15, 0, 0);
      const next = getNextRunTime('0 12 * * 1', now);

      // Next Monday is Jan 15
      expect(next.getDay()).toBe(1); // Monday
      expect(next.getHours()).toBe(12);
      expect(next.getMinutes()).toBe(0);
      expect(next.getDate()).toBe(15);
    });

    it('should return next week Monday if on Monday past the time for "0 12 * * 1"', () => {
      // Monday Jan 15, 2024 at 15:00 (past 12:00)
      const now = new Date(2024, 0, 15, 15, 0, 0);
      const next = getNextRunTime('0 12 * * 1', now);

      // Next Monday is Jan 22
      expect(next.getDay()).toBe(1); // Monday
      expect(next.getDate()).toBe(22);
    });

    it('should throw error for invalid cron expression (not 5 parts)', () => {
      expect(() => getNextRunTime('* * *')).toThrow('Invalid cron expression');
    });

    it('should throw error for invalid minute value', () => {
      expect(() => getNextRunTime('60 * * * *')).toThrow('Invalid minute value');
      expect(() => getNextRunTime('-1 * * * *')).toThrow('Invalid minute value');
    });

    it('should throw error for invalid hour value', () => {
      expect(() => getNextRunTime('0 24 * * *')).toThrow('Invalid hour value');
      expect(() => getNextRunTime('0 -1 * * *')).toThrow('Invalid hour value');
    });

    it('should throw error for invalid weekday value', () => {
      expect(() => getNextRunTime('0 12 * * 7')).toThrow('Invalid weekday value');
      expect(() => getNextRunTime('0 12 * * -1')).toThrow('Invalid weekday value');
    });

    it('should throw error for invalid minute interval', () => {
      expect(() => getNextRunTime('*/0 * * * *')).toThrow('Invalid minute interval');
      expect(() => getNextRunTime('*/-5 * * * *')).toThrow('Invalid minute interval');
    });

    it('should handle edge case at exactly a matching time', () => {
      // Exactly at 9:30 local time
      const now = new Date(2024, 0, 15, 9, 30, 0);
      const next = getNextRunTime('30 9 * * *', now);

      // Should return tomorrow at 9:30 (we always start from next minute)
      expect(next.getMinutes()).toBe(30);
      expect(next.getHours()).toBe(9);
      expect(next.getDate()).toBe(16);
    });

    it('should handle crossing midnight', () => {
      const now = new Date(2024, 0, 15, 23, 55, 0);
      const next = getNextRunTime('0 0 * * *', now);

      // Should be midnight of next day
      expect(next.getHours()).toBe(0);
      expect(next.getMinutes()).toBe(0);
      expect(next.getDate()).toBe(16);
    });

    it('should handle crossing month boundary', () => {
      const now = new Date(2024, 0, 31, 23, 30, 0);
      const next = getNextRunTime('0 0 * * *', now);

      // Should be midnight of Feb 1
      expect(next.getHours()).toBe(0);
      expect(next.getMinutes()).toBe(0);
      expect(next.getMonth()).toBe(1); // February (0-indexed)
      expect(next.getDate()).toBe(1);
    });

    it('should handle */30 interval correctly', () => {
      const now = new Date(2024, 0, 15, 10, 15, 0);
      const next = getNextRunTime('*/30 * * * *', now);

      // Valid minutes are 0 and 30, next is 30
      expect(next.getMinutes()).toBe(30);
      expect(next.getHours()).toBe(10);
    });

    it('should handle */5 interval at minute 58', () => {
      const now = new Date(2024, 0, 15, 10, 58, 0);
      const next = getNextRunTime('*/5 * * * *', now);

      // Next valid minute is 0 of next hour
      expect(next.getMinutes()).toBe(0);
      expect(next.getHours()).toBe(11);
    });
  });
});
