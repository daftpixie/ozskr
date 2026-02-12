/**
 * Shared React Query cache timing constants
 * These staleTime values determine how long cached data is considered fresh
 * before React Query automatically refetches in the background.
 */
export const QUERY_STALE_TIMES = {
  /** Token balances — refresh frequently to ensure accurate trading data */
  TOKEN_BALANCES: 30_000, // 30s
  /** Character list — moderate refresh since characters change infrequently */
  CHARACTERS: 60_000, // 1min
  /** Analytics data — less frequent since it aggregates historical data */
  ANALYTICS: 120_000, // 2min
  /** Leaderboard — matches cache TTL, balances freshness with server load */
  LEADERBOARD: 300_000, // 5min
  /** Gamification stats — moderate refresh for tier progress and points */
  GAMIFICATION_STATS: 60_000, // 1min
  /** Achievements — rarely change after unlock */
  ACHIEVEMENTS: 120_000, // 2min
  /** Content schedules */
  SCHEDULES: 60_000, // 1min
  /** Social accounts and posts */
  SOCIAL: 120_000, // 2min
  /** Content generations */
  GENERATIONS: 60_000, // 1min
} as const;
