// ---------------------------------------------------------------------------
// Circuit Breaker with Same-Recipient Velocity Tracking
// ---------------------------------------------------------------------------

import type { CircuitBreakerConfig } from '../config.js';

export interface CircuitBreakerResult {
  status: 'open' | 'tripped' | 'skip';
  reason?: string;
  tripType?: 'agent_velocity' | 'recipient_velocity' | 'global_velocity';
  windowStats?: {
    settlementsInWindow: number;
    valueInWindow: bigint;
    sameRecipientCountInWindow: number;
  };
}

interface SettlementRecord {
  timestamp: number;
  agent: string;
  recipient: string;
  amount: bigint;
}

export interface CircuitBreaker {
  check(agent: string, recipient: string, amount: bigint): CircuitBreakerResult;
  record(agent: string, recipient: string, amount: bigint): void;
  destroy(): void;
}

/**
 * Creates a circuit breaker with sliding window velocity tracking.
 *
 * Tracks three dimensions:
 * 1. Per-agent settlement count and value per hour/day
 * 2. Per-recipient settlements per minute/hour (prompt injection defense)
 * 3. Global settlement rate per minute
 *
 * RESTART BEHAVIOR: All sliding window records reset on process restart.
 * This temporarily allows bursts that would normally trip the breaker.
 * Acceptable for single-instance: velocity limits recover within one
 * window period (1 minute for per-minute, 1 hour for per-hour limits).
 * For multi-instance, use Redis-backed counters.
 */
export function createCircuitBreaker(config: CircuitBreakerConfig): CircuitBreaker {
  const records: SettlementRecord[] = [];
  let evictionTimer: ReturnType<typeof setInterval> | null = null;

  // Periodic cleanup of old records (older than 24h)
  evictionTimer = setInterval(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let i = 0;
    while (i < records.length && records[i].timestamp < cutoff) {
      i++;
    }
    if (i > 0) records.splice(0, i);
  }, 60_000);

  if (evictionTimer && typeof evictionTimer === 'object' && 'unref' in evictionTimer) {
    evictionTimer.unref();
  }

  function getRecordsInWindow(windowMs: number): SettlementRecord[] {
    const cutoff = Date.now() - windowMs;
    return records.filter((r) => r.timestamp >= cutoff);
  }

  return {
    check(agent: string, recipient: string, amount: bigint): CircuitBreakerResult {
      const now = Date.now();
      const oneMinute = 60 * 1000;
      const oneHour = 60 * 60 * 1000;
      const oneDay = 24 * 60 * 60 * 1000;

      // 1. Same-recipient velocity (per minute) — prompt injection defense
      const recipientLastMinute = records.filter(
        (r) => r.recipient === recipient && r.timestamp >= now - oneMinute,
      );
      if (recipientLastMinute.length >= config.maxSameRecipientPerMinute) {
        return {
          status: 'tripped',
          reason: `Same recipient ${recipient} exceeded ${config.maxSameRecipientPerMinute} settlements/minute`,
          tripType: 'recipient_velocity',
          windowStats: {
            settlementsInWindow: recipientLastMinute.length,
            valueInWindow: recipientLastMinute.reduce((sum, r) => sum + r.amount, 0n),
            sameRecipientCountInWindow: recipientLastMinute.length,
          },
        };
      }

      // 2. Same-recipient velocity (per hour)
      const recipientLastHour = records.filter(
        (r) => r.recipient === recipient && r.timestamp >= now - oneHour,
      );
      if (recipientLastHour.length >= config.maxSameRecipientPerHour) {
        return {
          status: 'tripped',
          reason: `Same recipient ${recipient} exceeded ${config.maxSameRecipientPerHour} settlements/hour`,
          tripType: 'recipient_velocity',
          windowStats: {
            settlementsInWindow: recipientLastHour.length,
            valueInWindow: recipientLastHour.reduce((sum, r) => sum + r.amount, 0n),
            sameRecipientCountInWindow: recipientLastHour.length,
          },
        };
      }

      // 3. Per-agent hourly velocity
      const agentLastHour = records.filter(
        (r) => r.agent === agent && r.timestamp >= now - oneHour,
      );
      if (agentLastHour.length >= config.maxSettlementsPerHour) {
        return {
          status: 'tripped',
          reason: `Agent ${agent} exceeded ${config.maxSettlementsPerHour} settlements/hour`,
          tripType: 'agent_velocity',
          windowStats: {
            settlementsInWindow: agentLastHour.length,
            valueInWindow: agentLastHour.reduce((sum, r) => sum + r.amount, 0n),
            sameRecipientCountInWindow: 0,
          },
        };
      }

      // 4. Per-agent daily velocity
      const agentLastDay = records.filter(
        (r) => r.agent === agent && r.timestamp >= now - oneDay,
      );
      if (agentLastDay.length >= config.maxSettlementsPerDay) {
        return {
          status: 'tripped',
          reason: `Agent ${agent} exceeded ${config.maxSettlementsPerDay} settlements/day`,
          tripType: 'agent_velocity',
          windowStats: {
            settlementsInWindow: agentLastDay.length,
            valueInWindow: agentLastDay.reduce((sum, r) => sum + r.amount, 0n),
            sameRecipientCountInWindow: 0,
          },
        };
      }

      // 5. Per-agent hourly value
      const agentHourlyValue = agentLastHour.reduce((sum, r) => sum + r.amount, 0n);
      if (agentHourlyValue + amount > BigInt(config.maxValuePerHourBaseUnits)) {
        return {
          status: 'tripped',
          reason: `Agent ${agent} value ${agentHourlyValue + amount} exceeds hourly cap ${config.maxValuePerHourBaseUnits}`,
          tripType: 'agent_velocity',
          windowStats: {
            settlementsInWindow: agentLastHour.length,
            valueInWindow: agentHourlyValue,
            sameRecipientCountInWindow: 0,
          },
        };
      }

      // 6. Global per-minute
      const globalLastMinute = getRecordsInWindow(oneMinute);
      if (globalLastMinute.length >= config.maxGlobalSettlementsPerMinute) {
        return {
          status: 'tripped',
          reason: `Global settlements exceeded ${config.maxGlobalSettlementsPerMinute}/minute`,
          tripType: 'global_velocity',
          windowStats: {
            settlementsInWindow: globalLastMinute.length,
            valueInWindow: globalLastMinute.reduce((sum, r) => sum + r.amount, 0n),
            sameRecipientCountInWindow: 0,
          },
        };
      }

      return { status: 'open' };
    },

    record(agent: string, recipient: string, amount: bigint): void {
      records.push({ timestamp: Date.now(), agent, recipient, amount });
    },

    destroy(): void {
      if (evictionTimer) {
        clearInterval(evictionTimer);
        evictionTimer = null;
      }
      records.length = 0;
    },
  };
}
