import { describe, it, expect, vi, afterEach } from 'vitest';
import { createCircuitBreaker, type CircuitBreaker } from '../../src/governance/circuit-breaker.js';
import type { CircuitBreakerConfig } from '../../src/config.js';

const defaultConfig: CircuitBreakerConfig = {
  maxSettlementsPerHour: 100,
  maxSettlementsPerDay: 500,
  maxValuePerHourBaseUnits: '10000000',
  maxSameRecipientPerMinute: 5,
  maxSameRecipientPerHour: 20,
  maxGlobalSettlementsPerMinute: 30,
};

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  afterEach(() => {
    breaker?.destroy();
    vi.useRealTimers();
  });

  it('returns open when under all limits', () => {
    breaker = createCircuitBreaker(defaultConfig);
    const result = breaker.check('agent1', 'recipient1', 1000000n);
    expect(result.status).toBe('open');
  });

  it('trips on same-recipient exceeding per-minute limit', () => {
    breaker = createCircuitBreaker({ ...defaultConfig, maxSameRecipientPerMinute: 3 });

    breaker.record('agent1', 'evil-endpoint', 100n);
    breaker.record('agent1', 'evil-endpoint', 100n);
    breaker.record('agent1', 'evil-endpoint', 100n);

    const result = breaker.check('agent1', 'evil-endpoint', 100n);
    expect(result.status).toBe('tripped');
    expect(result.tripType).toBe('recipient_velocity');
    expect(result.reason).toContain('evil-endpoint');
  });

  it('trips on same-recipient exceeding per-hour limit', () => {
    breaker = createCircuitBreaker({ ...defaultConfig, maxSameRecipientPerHour: 3 });

    breaker.record('agent1', 'endpoint', 100n);
    breaker.record('agent1', 'endpoint', 100n);
    breaker.record('agent1', 'endpoint', 100n);

    const result = breaker.check('agent1', 'endpoint', 100n);
    expect(result.status).toBe('tripped');
    expect(result.tripType).toBe('recipient_velocity');
  });

  it('trips on per-agent hourly settlement count', () => {
    breaker = createCircuitBreaker({ ...defaultConfig, maxSettlementsPerHour: 3 });

    breaker.record('agent1', 'r1', 100n);
    breaker.record('agent1', 'r2', 100n);
    breaker.record('agent1', 'r3', 100n);

    const result = breaker.check('agent1', 'r4', 100n);
    expect(result.status).toBe('tripped');
    expect(result.tripType).toBe('agent_velocity');
  });

  it('trips on per-agent hourly value cap', () => {
    breaker = createCircuitBreaker({ ...defaultConfig, maxValuePerHourBaseUnits: '3000000' });

    breaker.record('agent1', 'r1', 2000000n);

    const result = breaker.check('agent1', 'r2', 2000000n);
    expect(result.status).toBe('tripped');
    expect(result.tripType).toBe('agent_velocity');
    expect(result.reason).toContain('value');
  });

  it('trips on global per-minute limit', () => {
    breaker = createCircuitBreaker({ ...defaultConfig, maxGlobalSettlementsPerMinute: 2 });

    breaker.record('agent1', 'r1', 100n);
    breaker.record('agent2', 'r2', 100n);

    const result = breaker.check('agent3', 'r3', 100n);
    expect(result.status).toBe('tripped');
    expect(result.tripType).toBe('global_velocity');
  });

  it('allows different recipients at same-recipient limit', () => {
    breaker = createCircuitBreaker({ ...defaultConfig, maxSameRecipientPerMinute: 2 });

    breaker.record('agent1', 'r1', 100n);
    breaker.record('agent1', 'r1', 100n);

    // Different recipient is fine
    const result = breaker.check('agent1', 'r2', 100n);
    expect(result.status).toBe('open');
  });

  it('window expiry resets counts', () => {
    vi.useFakeTimers();
    breaker = createCircuitBreaker({ ...defaultConfig, maxSameRecipientPerMinute: 2 });

    breaker.record('agent1', 'r1', 100n);
    breaker.record('agent1', 'r1', 100n);

    // Tripped now
    expect(breaker.check('agent1', 'r1', 100n).status).toBe('tripped');

    // Advance 61 seconds
    vi.advanceTimersByTime(61_000);

    // Should be open again
    expect(breaker.check('agent1', 'r1', 100n).status).toBe('open');
  });

  it('config with higher thresholds adjusts accordingly', () => {
    breaker = createCircuitBreaker({
      ...defaultConfig,
      maxSameRecipientPerMinute: 100,
      maxSameRecipientPerHour: 200,
      maxSettlementsPerHour: 1000,
      maxSettlementsPerDay: 5000,
      maxGlobalSettlementsPerMinute: 200,
      maxValuePerHourBaseUnits: '100000000',
    });

    // Record 50 to same recipient — should be fine
    for (let i = 0; i < 50; i++) {
      breaker.record('agent1', 'r1', 100n);
    }

    const result = breaker.check('agent1', 'r1', 100n);
    expect(result.status).toBe('open');
  });

  it('destroy clears all state', () => {
    breaker = createCircuitBreaker({ ...defaultConfig, maxSameRecipientPerMinute: 1 });
    breaker.record('agent1', 'r1', 100n);

    breaker.destroy();

    // After destroy, create new breaker — old state should be gone
    breaker = createCircuitBreaker({ ...defaultConfig, maxSameRecipientPerMinute: 1 });
    expect(breaker.check('agent1', 'r1', 100n).status).toBe('open');
  });
});
