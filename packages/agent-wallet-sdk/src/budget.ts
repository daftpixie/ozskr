import type { Address } from '@solana/kit';
import { checkDelegation } from './delegate.js';
import type {
  BudgetCheckResult,
  SpendRecord,
  RpcConfig,
} from './types.js';
import { DelegationError, DelegationErrorCode } from './types.js';

/**
 * Client-side budget tracker for SPL token delegation.
 *
 * Provides defense-in-depth spending validation by combining:
 * 1. **On-chain state**: Actual remaining delegation from RPC query
 * 2. **Local tracking**: In-memory record of spends since initialization
 *
 * The available budget is always `min(remainingOnChain, initialBudget - localSpent)`,
 * ensuring that even if local tracking drifts from on-chain state, the agent
 * cannot exceed the actual delegation.
 *
 * **Thread safety**: Uses a simple lock to prevent concurrent budget checks
 * from causing race conditions during rapid spend sequences.
 *
 * @example
 * ```ts
 * const tracker = createBudgetTracker(10_000_000n);
 * const check = await tracker.checkBudget(
 *   address('...'),
 *   { endpoint: 'https://api.devnet.solana.com' },
 * );
 * if (check.available >= paymentAmount) {
 *   // proceed with payment
 *   tracker.recordSpend(paymentAmount, txSignature);
 * }
 * ```
 */
export interface BudgetTracker {
  /**
   * Checks the current budget by querying on-chain delegation state and
   * combining it with local spend tracking.
   *
   * @param tokenAccount - The owner's SPL token account with delegation
   * @param rpcConfig - RPC endpoint configuration
   * @returns Budget check result with on-chain remaining, local spent, and available
   */
  checkBudget(tokenAccount: Address, rpcConfig: RpcConfig): Promise<BudgetCheckResult>;

  /**
   * Records a successful spend against the local budget tracker.
   * Call this AFTER a transaction has been confirmed on-chain.
   *
   * @param amount - Amount spent in base units
   * @param signature - On-chain transaction signature for audit trail
   */
  recordSpend(amount: bigint, signature: string): void;

  /**
   * Resets the local spend tracker. Useful when a new delegation is created
   * or when re-syncing with on-chain state.
   */
  reset(): void;

  /** Returns all recorded spend events for audit/logging. */
  getSpendHistory(): ReadonlyArray<SpendRecord>;

  /** Returns the total amount spent according to local tracking. */
  getTotalSpent(): bigint;

  /** Returns the initial budget cap this tracker was created with. */
  getInitialBudget(): bigint;
}

/**
 * Creates a new BudgetTracker instance with the specified initial budget cap.
 *
 * @param initialBudget - The maximum spending cap in base units (should match
 *   the on-chain delegation amount). Must be positive.
 * @returns A new BudgetTracker instance
 *
 * @throws DelegationError with INVALID_AMOUNT code if initialBudget <= 0
 */
export function createBudgetTracker(initialBudget: bigint): BudgetTracker {
  if (initialBudget <= 0n) {
    throw new DelegationError(
      DelegationErrorCode.INVALID_AMOUNT,
      `Initial budget must be positive, got ${initialBudget}`,
    );
  }

  let spent = 0n;
  let spendHistory: SpendRecord[] = [];

  // Async mutex for budget check-and-spend atomicity.
  // Prevents concurrent callers from reading the same budget state before
  // either has recorded its spend, which could result in double-spending
  // up to the delegation cap.
  let locked = false;
  const waitQueue: Array<() => void> = [];

  function acquireLock(): Promise<void> {
    if (!locked) {
      locked = true;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => waitQueue.push(resolve));
  }

  function releaseLock(): void {
    const next = waitQueue.shift();
    if (next) {
      next(); // Transfer lock to next waiter
    } else {
      locked = false;
    }
  }

  return {
    async checkBudget(
      tokenAccount: Address,
      rpcConfig: RpcConfig,
    ): Promise<BudgetCheckResult> {
      await acquireLock();
      try {
        const status = await checkDelegation(tokenAccount, rpcConfig);
        const remainingOnChain = status.remainingAmount;
        const localRemaining = initialBudget - spent;

        // Available is the minimum of on-chain remaining and local tracking
        // This ensures we never exceed either limit
        const available = remainingOnChain < localRemaining
          ? remainingOnChain
          : localRemaining;

        return {
          remainingOnChain,
          spent,
          available: available > 0n ? available : 0n,
        };
      } finally {
        releaseLock();
      }
    },

    recordSpend(amount: bigint, signature: string): void {
      if (amount <= 0n) {
        throw new DelegationError(
          DelegationErrorCode.INVALID_AMOUNT,
          `Spend amount must be positive, got ${amount}`,
        );
      }

      if (!signature || signature.trim().length === 0) {
        throw new DelegationError(
          DelegationErrorCode.INVALID_ADDRESS,
          'Transaction signature is required for spend recording',
        );
      }

      const newSpent = spent + amount;
      if (newSpent > initialBudget) {
        throw new DelegationError(
          DelegationErrorCode.BUDGET_EXCEEDED,
          `Recording spend of ${amount} would exceed budget: spent ${spent} + ${amount} > budget ${initialBudget}`,
        );
      }

      spent = newSpent;
      spendHistory.push({
        amount,
        signature,
        timestamp: new Date().toISOString(),
      });
    },

    reset(): void {
      spent = 0n;
      spendHistory = [];
    },

    getSpendHistory(): ReadonlyArray<SpendRecord> {
      return [...spendHistory];
    },

    getTotalSpent(): bigint {
      return spent;
    },

    getInitialBudget(): bigint {
      return initialBudget;
    },
  };
}
