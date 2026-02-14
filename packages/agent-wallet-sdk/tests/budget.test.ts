import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Address } from '@solana/kit';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@solana/kit', async (importOriginal) => {
  const original = await importOriginal<typeof import('@solana/kit')>();
  return {
    ...original,
    createSolanaRpc: vi.fn(() => ({
      getLatestBlockhash: vi.fn(() => ({
        send: vi.fn().mockResolvedValue({
          value: {
            blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
            lastValidBlockHeight: 100n,
          },
        }),
      })),
    })),
  };
});

vi.mock('@solana-program/token', () => ({
  fetchToken: vi.fn(),
}));

import { createBudgetTracker } from '../src/budget.js';
import { DelegationError, DelegationErrorCode } from '../src/types.js';
import { fetchToken } from '@solana-program/token';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_ADDRESS = '11111111111111111111111111111111' as Address;
const VALID_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as Address;
const VALID_DEST = 'So11111111111111111111111111111111111111112' as Address;
const mockRpcConfig = { endpoint: 'https://api.devnet.solana.com' };

function setupFetchTokenMock(delegatedAmount: bigint, hasDelegate = true) {
  vi.mocked(fetchToken).mockResolvedValue({
    address: VALID_ADDRESS,
    data: {
      mint: VALID_MINT,
      owner: VALID_ADDRESS,
      amount: 100_000_000n,
      delegate: hasDelegate
        ? { __option: 'Some' as const, value: VALID_DEST }
        : { __option: 'None' as const },
      delegatedAmount,
      state: 1,
      isNative: { __option: 'None' as const },
      closeAuthority: { __option: 'None' as const },
    },
    executable: false,
    lamports: 2_039_280n,
    programAddress: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address,
  } as never);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createBudgetTracker', () => {
  it('should create a tracker with positive budget', () => {
    const tracker = createBudgetTracker(10_000_000n);
    expect(tracker.getInitialBudget()).toBe(10_000_000n);
    expect(tracker.getTotalSpent()).toBe(0n);
    expect(tracker.getSpendHistory()).toEqual([]);
  });

  it('should reject zero budget', () => {
    expect(() => createBudgetTracker(0n)).toThrow(DelegationError);
    expect(() => createBudgetTracker(0n)).toThrow(/must be positive/);
  });

  it('should reject negative budget', () => {
    expect(() => createBudgetTracker(-1n)).toThrow(DelegationError);
  });
});

describe('BudgetTracker.checkBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return full budget when nothing spent and on-chain matches', async () => {
    setupFetchTokenMock(10_000_000n);
    const tracker = createBudgetTracker(10_000_000n);

    const result = await tracker.checkBudget(VALID_ADDRESS, mockRpcConfig);

    expect(result.remainingOnChain).toBe(10_000_000n);
    expect(result.spent).toBe(0n);
    expect(result.available).toBe(10_000_000n);
  });

  it('should reflect local spends in available amount', async () => {
    setupFetchTokenMock(10_000_000n);
    const tracker = createBudgetTracker(10_000_000n);

    tracker.recordSpend(3_000_000n, 'sig1');
    const result = await tracker.checkBudget(VALID_ADDRESS, mockRpcConfig);

    expect(result.spent).toBe(3_000_000n);
    // available = min(10_000_000 on-chain, 10_000_000 - 3_000_000 local) = 7_000_000
    expect(result.available).toBe(7_000_000n);
  });

  it('should use on-chain amount when it is lower than local tracking', async () => {
    // On-chain shows only 2M remaining, but local tracking says 7M remaining
    setupFetchTokenMock(2_000_000n);
    const tracker = createBudgetTracker(10_000_000n);

    tracker.recordSpend(3_000_000n, 'sig1');
    const result = await tracker.checkBudget(VALID_ADDRESS, mockRpcConfig);

    // available = min(2_000_000 on-chain, 7_000_000 local) = 2_000_000
    expect(result.available).toBe(2_000_000n);
  });

  it('should return zero available when on-chain is zero', async () => {
    setupFetchTokenMock(0n, false);
    const tracker = createBudgetTracker(10_000_000n);

    const result = await tracker.checkBudget(VALID_ADDRESS, mockRpcConfig);

    expect(result.available).toBe(0n);
  });

  it('should return zero available when budget is fully spent locally', async () => {
    setupFetchTokenMock(10_000_000n);
    const tracker = createBudgetTracker(10_000_000n);

    tracker.recordSpend(10_000_000n, 'sig1');
    const result = await tracker.checkBudget(VALID_ADDRESS, mockRpcConfig);

    expect(result.spent).toBe(10_000_000n);
    expect(result.available).toBe(0n);
  });

  it('should reject concurrent budget checks', async () => {
    // Make fetchToken slow to simulate concurrent access
    vi.mocked(fetchToken).mockImplementation(
      () => new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            address: VALID_ADDRESS,
            data: {
              mint: VALID_MINT,
              owner: VALID_ADDRESS,
              amount: 100_000_000n,
              delegate: { __option: 'Some' as const, value: VALID_DEST },
              delegatedAmount: 10_000_000n,
              state: 1,
              isNative: { __option: 'None' as const },
              closeAuthority: { __option: 'None' as const },
            },
            executable: false,
            lamports: 2_039_280n,
            programAddress: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address,
          } as never);
        }, 50);
      }),
    );

    const tracker = createBudgetTracker(10_000_000n);

    // Start first check (will be in progress)
    const firstCheck = tracker.checkBudget(VALID_ADDRESS, mockRpcConfig);

    // Second concurrent check should queue (mutex) and resolve after first
    const secondCheck = tracker.checkBudget(VALID_ADDRESS, mockRpcConfig);

    // Both checks should complete successfully (serialized by mutex)
    const result = await firstCheck;
    expect(result.available).toBe(10_000_000n);

    const result2 = await secondCheck;
    expect(result2.available).toBe(10_000_000n);
  });

  it('should allow sequential budget checks', async () => {
    setupFetchTokenMock(10_000_000n);
    const tracker = createBudgetTracker(10_000_000n);

    const first = await tracker.checkBudget(VALID_ADDRESS, mockRpcConfig);
    const second = await tracker.checkBudget(VALID_ADDRESS, mockRpcConfig);

    expect(first.available).toBe(10_000_000n);
    expect(second.available).toBe(10_000_000n);
  });
});

describe('BudgetTracker.recordSpend', () => {
  it('should track cumulative spending', () => {
    const tracker = createBudgetTracker(10_000_000n);

    tracker.recordSpend(1_000_000n, 'sig1');
    tracker.recordSpend(2_000_000n, 'sig2');
    tracker.recordSpend(3_000_000n, 'sig3');

    expect(tracker.getTotalSpent()).toBe(6_000_000n);
  });

  it('should maintain spend history', () => {
    const tracker = createBudgetTracker(10_000_000n);

    tracker.recordSpend(1_000_000n, 'sig1');
    tracker.recordSpend(2_000_000n, 'sig2');

    const history = tracker.getSpendHistory();
    expect(history).toHaveLength(2);
    expect(history[0].amount).toBe(1_000_000n);
    expect(history[0].signature).toBe('sig1');
    expect(history[0].timestamp).toBeTruthy();
    expect(history[1].amount).toBe(2_000_000n);
    expect(history[1].signature).toBe('sig2');
  });

  it('should reject zero spend amount', () => {
    const tracker = createBudgetTracker(10_000_000n);

    expect(() => tracker.recordSpend(0n, 'sig1')).toThrow(/must be positive/);
  });

  it('should reject negative spend amount', () => {
    const tracker = createBudgetTracker(10_000_000n);

    expect(() => tracker.recordSpend(-1n, 'sig1')).toThrow(DelegationError);
  });

  it('should reject empty signature', () => {
    const tracker = createBudgetTracker(10_000_000n);

    expect(() => tracker.recordSpend(1_000_000n, '')).toThrow(/signature is required/);
  });

  it('should reject whitespace-only signature', () => {
    const tracker = createBudgetTracker(10_000_000n);

    expect(() => tracker.recordSpend(1_000_000n, '   ')).toThrow(/signature is required/);
  });

  it('should reject spend exceeding budget', () => {
    const tracker = createBudgetTracker(10_000_000n);

    tracker.recordSpend(8_000_000n, 'sig1');

    try {
      tracker.recordSpend(3_000_000n, 'sig2');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(DelegationError);
      expect((error as DelegationError).code).toBe(DelegationErrorCode.BUDGET_EXCEEDED);
    }
  });

  it('should allow spending exactly the full budget', () => {
    const tracker = createBudgetTracker(10_000_000n);

    tracker.recordSpend(10_000_000n, 'sig1');

    expect(tracker.getTotalSpent()).toBe(10_000_000n);
  });

  it('should return immutable spend history', () => {
    const tracker = createBudgetTracker(10_000_000n);

    tracker.recordSpend(1_000_000n, 'sig1');

    const history1 = tracker.getSpendHistory();
    const history2 = tracker.getSpendHistory();

    // Should be different array references (defensive copy)
    expect(history1).not.toBe(history2);
    expect(history1).toEqual(history2);
  });
});

describe('BudgetTracker.reset', () => {
  it('should clear spent amount and history', () => {
    const tracker = createBudgetTracker(10_000_000n);

    tracker.recordSpend(5_000_000n, 'sig1');
    tracker.recordSpend(3_000_000n, 'sig2');
    expect(tracker.getTotalSpent()).toBe(8_000_000n);

    tracker.reset();

    expect(tracker.getTotalSpent()).toBe(0n);
    expect(tracker.getSpendHistory()).toEqual([]);
    expect(tracker.getInitialBudget()).toBe(10_000_000n);
  });

  it('should allow new spends after reset', () => {
    const tracker = createBudgetTracker(10_000_000n);

    tracker.recordSpend(10_000_000n, 'sig1');
    tracker.reset();
    tracker.recordSpend(5_000_000n, 'sig2');

    expect(tracker.getTotalSpent()).toBe(5_000_000n);
  });
});

describe('BudgetTracker accuracy after multiple operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should track budget accurately through spend-check-spend-check cycle', async () => {
    const tracker = createBudgetTracker(10_000_000n);

    // First spend
    tracker.recordSpend(2_000_000n, 'sig1');

    // On-chain reflects the spend
    setupFetchTokenMock(8_000_000n);
    const check1 = await tracker.checkBudget(VALID_ADDRESS, mockRpcConfig);
    expect(check1.available).toBe(8_000_000n); // min(8M on-chain, 8M local)

    // Second spend
    tracker.recordSpend(3_000_000n, 'sig2');

    // On-chain reflects both spends
    setupFetchTokenMock(5_000_000n);
    const check2 = await tracker.checkBudget(VALID_ADDRESS, mockRpcConfig);
    expect(check2.available).toBe(5_000_000n); // min(5M on-chain, 5M local)
    expect(check2.spent).toBe(5_000_000n);
  });

  it('should handle on-chain being ahead of local tracking', async () => {
    const tracker = createBudgetTracker(10_000_000n);

    tracker.recordSpend(2_000_000n, 'sig1');

    // On-chain shows more was spent (maybe another delegate spent some)
    setupFetchTokenMock(3_000_000n);
    const check = await tracker.checkBudget(VALID_ADDRESS, mockRpcConfig);

    // available = min(3M on-chain, 8M local) = 3M
    expect(check.available).toBe(3_000_000n);
  });
});
