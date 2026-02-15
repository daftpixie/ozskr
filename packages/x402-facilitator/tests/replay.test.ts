import { describe, it, expect, afterEach, vi } from 'vitest';
import { createReplayGuard, type ReplayGuard } from '../src/replay.js';

describe('ReplayGuard', () => {
  let guard: ReplayGuard;

  afterEach(() => {
    guard?.destroy();
  });

  it('returns false for unseen signature', () => {
    guard = createReplayGuard();
    expect(guard.check('sig_unseen')).toBe(false);
  });

  it('returns true for recorded signature', () => {
    guard = createReplayGuard();
    guard.record('sig_abc', 300);
    expect(guard.check('sig_abc')).toBe(true);
  });

  it('returns false after signature expires', () => {
    guard = createReplayGuard();
    vi.useFakeTimers();
    try {
      guard.record('sig_expiring', 10);
      expect(guard.check('sig_expiring')).toBe(true);

      // Advance past TTL
      vi.advanceTimersByTime(11_000);
      expect(guard.check('sig_expiring')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('tracks size accurately', () => {
    guard = createReplayGuard();
    expect(guard.size()).toBe(0);
    guard.record('sig_1', 300);
    guard.record('sig_2', 300);
    expect(guard.size()).toBe(2);
  });

  it('evicts expired entries', () => {
    guard = createReplayGuard();
    vi.useFakeTimers();
    try {
      guard.record('sig_old', 1);
      guard.record('sig_new', 600);

      vi.advanceTimersByTime(2_000);
      const evicted = guard.evict();
      expect(evicted).toBe(1);
      expect(guard.size()).toBe(1);
      expect(guard.check('sig_new')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('destroy clears all entries and timer', () => {
    guard = createReplayGuard();
    guard.record('sig_x', 300);
    guard.destroy();
    expect(guard.size()).toBe(0);
  });

  it('handles duplicate recordings', () => {
    guard = createReplayGuard();
    guard.record('sig_dup', 300);
    guard.record('sig_dup', 600);
    expect(guard.size()).toBe(1);
    expect(guard.check('sig_dup')).toBe(true);
  });

  it('periodic eviction cleans up expired entries', () => {
    vi.useFakeTimers();
    try {
      guard = createReplayGuard(100);
      guard.record('sig_periodic', 0);

      // Advance past eviction interval
      vi.advanceTimersByTime(150);
      expect(guard.size()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
