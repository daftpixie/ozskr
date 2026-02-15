// ---------------------------------------------------------------------------
// Replay Guard — In-Memory Signature Deduplication
// ---------------------------------------------------------------------------

export interface ReplayGuard {
  /** Returns true if the signature has been seen (replay detected). */
  check(signature: string): boolean;
  /** Records a signature with a TTL in seconds. */
  record(signature: string, ttlSeconds: number): void;
  /** Returns the number of tracked signatures. */
  size(): number;
  /** Evicts expired entries. Returns the number evicted. */
  evict(): number;
  /** Clears all state and stops the eviction timer. */
  destroy(): void;
}

/**
 * Creates an in-memory replay guard that tracks transaction signatures
 * with TTL-based expiration.
 *
 * Signatures are stored with an expiry timestamp. Periodic eviction
 * runs on a configurable interval (default 60s) to clean up expired entries.
 *
 * RESTART BEHAVIOR: State resets on process restart. This creates a brief
 * window where replays of recently-settled transactions could pass the guard.
 * However, on-chain nonce/blockhash mismatch will still reject the replay at
 * the RPC level, so no funds are at risk. For multi-instance deployments,
 * replace with a Redis-backed implementation sharing the same key space.
 *
 * @param evictIntervalMs - Eviction interval in milliseconds (default 60000)
 */
export function createReplayGuard(evictIntervalMs = 60_000): ReplayGuard {
  const entries = new Map<string, number>();
  let timer: ReturnType<typeof setInterval> | null = null;

  function evict(): number {
    const now = Date.now();
    let count = 0;
    for (const [sig, expiry] of entries) {
      if (expiry <= now) {
        entries.delete(sig);
        count++;
      }
    }
    return count;
  }

  // Start periodic eviction
  timer = setInterval(evict, evictIntervalMs);
  // Allow the timer to not block process exit
  if (timer && typeof timer === 'object' && 'unref' in timer) {
    timer.unref();
  }

  return {
    check(signature: string): boolean {
      const expiry = entries.get(signature);
      if (expiry === undefined) return false;
      // Auto-evict if expired
      if (expiry <= Date.now()) {
        entries.delete(signature);
        return false;
      }
      return true;
    },

    record(signature: string, ttlSeconds: number): void {
      entries.set(signature, Date.now() + ttlSeconds * 1000);
    },

    size(): number {
      return entries.size;
    },

    evict,

    destroy(): void {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      entries.clear();
    },
  };
}
