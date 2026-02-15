// ---------------------------------------------------------------------------
// Independent Budget Enforcement
// ---------------------------------------------------------------------------

export interface BudgetEnforcementResult {
  status: 'within_cap' | 'at_cap' | 'over_cap' | 'error';
  totalSpent: bigint;
  remainingBudget: bigint;
  paymentAmount: bigint;
  delegatedAmount: bigint;
}

export interface BudgetEnforcer {
  /** Check if a payment is within budget. Uses on-chain delegatedAmount as truth. */
  check(key: string, paymentAmount: bigint, delegatedAmount: bigint): BudgetEnforcementResult;
  /** Record a successful settlement. Only call AFTER confirmed settlement. */
  record(key: string, amount: bigint): void;
  /** Reset tracking for a key (e.g., after new delegation approval). */
  reset(key: string): void;
  /** Get total spent for a key. */
  totalSpent(key: string): bigint;
  /** Clear all tracking data. */
  destroy(): void;
}

/**
 * Creates a budget enforcer that tracks cumulative spend per delegate+account pair.
 *
 * Key format: `${delegateAddress}:${sourceTokenAccount}`
 *
 * The on-chain delegatedAmount is the source of truth. If the on-chain amount
 * is lower than expected (someone transferred outside this facilitator), the
 * on-chain value takes precedence.
 */
export function createBudgetEnforcer(): BudgetEnforcer {
  const spentMap = new Map<string, bigint>();

  return {
    check(key: string, paymentAmount: bigint, delegatedAmount: bigint): BudgetEnforcementResult {
      const spent = spentMap.get(key) ?? 0n;
      const remaining = delegatedAmount > spent ? delegatedAmount - spent : 0n;

      if (paymentAmount > remaining) {
        return {
          status: remaining === 0n ? 'at_cap' : 'over_cap',
          totalSpent: spent,
          remainingBudget: remaining,
          paymentAmount,
          delegatedAmount,
        };
      }

      if (paymentAmount === remaining) {
        return {
          status: 'at_cap',
          totalSpent: spent,
          remainingBudget: remaining,
          paymentAmount,
          delegatedAmount,
        };
      }

      return {
        status: 'within_cap',
        totalSpent: spent,
        remainingBudget: remaining,
        paymentAmount,
        delegatedAmount,
      };
    },

    record(key: string, amount: bigint): void {
      const current = spentMap.get(key) ?? 0n;
      spentMap.set(key, current + amount);
    },

    reset(key: string): void {
      spentMap.delete(key);
    },

    totalSpent(key: string): bigint {
      return spentMap.get(key) ?? 0n;
    },

    destroy(): void {
      spentMap.clear();
    },
  };
}
