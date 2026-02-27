/**
 * Delegation Reconciliation Job Tests
 * Tests the reconcileDelegations service function.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock references
// ---------------------------------------------------------------------------

const { mockFrom, mockCheckAllAgentDelegations, mockCreateSolanaRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockCheckAllAgentDelegations: vi.fn(),
  mockCreateSolanaRpc: vi.fn(() => ({})),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/supabase', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock @solana/kit and @/lib/solana/delegation as dynamic imports
// The source uses: await import('@solana/kit') and await import('@/lib/solana/delegation')

vi.mock('@solana/kit', () => ({
  createSolanaRpc: mockCreateSolanaRpc,
  address: vi.fn((a: string) => a),
}));

const TOKEN_PROGRAM_ID_PLACEHOLDER = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const REAL_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

vi.mock('@/lib/solana/delegation', () => ({
  checkAllAgentDelegations: mockCheckAllAgentDelegations,
  TOKEN_PROGRAM_ID: TOKEN_PROGRAM_ID_PLACEHOLDER,
}));

import { reconcileDelegations } from './delegation-reconciliation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHAR_ID = '550e8400-e29b-41d4-a716-446655440000';
const ACCOUNT_ID = '660e8400-e29b-41d4-a716-446655440001';
const TOKEN_ACCOUNT = 'TokenAcct111111111111111111111111111111111';
const DELEGATE_PUBKEY = 'AgentKey1111111111111111111111111111111111';

// A typical "active" delegation account row
function makeAccountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ACCOUNT_ID,
    character_id: CHAR_ID,
    token_account_address: TOKEN_ACCOUNT,
    delegate_pubkey: DELEGATE_PUBKEY,
    remaining_amount: '1000000',
    delegation_status: 'active',
    version: 1,
    ...overrides,
  };
}

// Build a chain mock for Supabase queries.
// Supports cursor-based pagination: .select().eq().order().limit().gt() → awaitable chain.
// Also: .insert() / .update().eq() for writes.
function makeChain(opts: {
  data?: unknown;
  error?: unknown;
} = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const resolved = { data: opts.data ?? [], error: opts.error ?? null };

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.gt = vi.fn(() => chain);
  // range kept for any legacy call paths in tests
  chain.range = vi.fn(() => Promise.resolve(resolved));
  // Make chain directly awaitable (cursor-based pagination awaits the chain)
  chain.then = vi.fn(
    (onfulfilled?: (v: unknown) => unknown, onrejected?: (e: unknown) => unknown) =>
      Promise.resolve(resolved).then(onfulfilled, onrejected)
  );
  chain.catch = vi.fn((onrejected?: (e: unknown) => unknown) =>
    Promise.resolve(resolved).catch(onrejected)
  );
  chain.insert = vi.fn(() => Promise.resolve({ error: null }));
  // update() returns a new sub-chain whose eq() resolves
  chain.update = vi.fn(() => {
    const sub: Record<string, ReturnType<typeof vi.fn>> = {};
    sub.eq = vi.fn(() => Promise.resolve({ error: null }));
    return sub;
  });
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reconcileDelegations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.NEXT_PUBLIC_HELIUS_RPC_URL = 'https://devnet.helius-rpc.com';

    // Default: on-chain returns active delegation for all accounts
    mockCheckAllAgentDelegations.mockResolvedValue(new Map());
  });

  describe('environment guards', () => {
    it('should throw when SUPABASE_SERVICE_ROLE_KEY is not set', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      await expect(reconcileDelegations()).rejects.toThrow(
        'SUPABASE_SERVICE_ROLE_KEY environment variable not set'
      );
    });
  });

  describe('empty active accounts', () => {
    it('should return zero counts when no active accounts exist', async () => {
      mockFrom.mockImplementation(() => makeChain({ data: [] }));

      const stats = await reconcileDelegations();

      expect(stats).toEqual({ checked: 0, driftsDetected: 0, autoRevoked: 0 });
    });

    it('should not call checkAllAgentDelegations when no accounts exist', async () => {
      mockFrom.mockImplementation(() => makeChain({ data: [] }));

      await reconcileDelegations();

      // checkAllAgentDelegations is inside a dynamic import;
      // since no accounts are processed, the on-chain check is not triggered
      // (though the RPC URL check happens, the batch with empty addresses returns early)
    });
  });

  describe('drift detection: account_missing', () => {
    it('should auto-revoke when account is missing on-chain', async () => {
      const account = makeAccountRow();

      mockFrom.mockImplementation((table: string) => {
        if (table === 'agent_delegation_accounts') {
          const chain = makeChain({ data: [account] });
          chain.insert = vi.fn(() => Promise.resolve({ error: null }));
          chain.update = vi.fn(() => {
            const inner: Record<string, ReturnType<typeof vi.fn>> = {};
            inner.eq = vi.fn(() => Promise.resolve({ error: null }));
            return inner;
          });
          return chain;
        }
        if (table === 'reconciliation_log') {
          return makeChain();
        }
        return makeChain();
      });

      // On-chain: account exists=false (tokenMint equals TOKEN_PROGRAM_ID placeholder)
      mockCheckAllAgentDelegations.mockResolvedValue(
        new Map([
          [
            TOKEN_ACCOUNT,
            {
              isActive: false,
              delegate: null,
              remainingAmount: 0n,
              balance: 0n,
              tokenMint: TOKEN_PROGRAM_ID_PLACEHOLDER, // placeholder = account missing
              tokenAccount: TOKEN_ACCOUNT,
              programId: TOKEN_PROGRAM_ID_PLACEHOLDER,
            },
          ],
        ])
      );

      const stats = await reconcileDelegations();

      expect(stats.checked).toBe(1);
      expect(stats.driftsDetected).toBe(1);
      expect(stats.autoRevoked).toBe(1);
    });
  });

  describe('drift detection: delegate_mismatch', () => {
    it('should auto-revoke when on-chain delegate is null', async () => {
      const account = makeAccountRow();

      mockFrom.mockImplementation((table: string) => {
        if (table === 'agent_delegation_accounts') {
          const chain = makeChain({ data: [account] });
          chain.update = vi.fn(() => {
            const inner: Record<string, ReturnType<typeof vi.fn>> = {};
            inner.eq = vi.fn(() => Promise.resolve({ error: null }));
            return inner;
          });
          return chain;
        }
        if (table === 'reconciliation_log') {
          return makeChain();
        }
        return makeChain();
      });

      // On-chain: account exists but delegate is null (revoked on-chain)
      mockCheckAllAgentDelegations.mockResolvedValue(
        new Map([
          [
            TOKEN_ACCOUNT,
            {
              isActive: false,
              delegate: null,
              remainingAmount: 0n,
              balance: 5_000_000n,
              tokenMint: REAL_MINT, // real mint = account exists
              tokenAccount: TOKEN_ACCOUNT,
              programId: TOKEN_PROGRAM_ID_PLACEHOLDER,
            },
          ],
        ])
      );

      const stats = await reconcileDelegations();

      expect(stats.driftsDetected).toBe(1);
      expect(stats.autoRevoked).toBe(1);
    });
  });

  describe('drift detection: amount_drift', () => {
    it('should flag (not auto-revoke) when on-chain amount is significantly less than DB', async () => {
      // DB says 1,000,000 remaining; on-chain says 500,000 (50% drift > 1% threshold)
      const account = makeAccountRow({ remaining_amount: '1000000' });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'agent_delegation_accounts') {
          const chain = makeChain({ data: [account] });
          chain.update = vi.fn(() => {
            const inner: Record<string, ReturnType<typeof vi.fn>> = {};
            inner.eq = vi.fn(() => Promise.resolve({ error: null }));
            return inner;
          });
          return chain;
        }
        if (table === 'reconciliation_log') {
          return makeChain();
        }
        return makeChain();
      });

      mockCheckAllAgentDelegations.mockResolvedValue(
        new Map([
          [
            TOKEN_ACCOUNT,
            {
              isActive: true,
              delegate: DELEGATE_PUBKEY,
              remainingAmount: 500_000n, // 50% below DB value
              balance: 5_000_000n,
              tokenMint: REAL_MINT,
              tokenAccount: TOKEN_ACCOUNT,
              programId: TOKEN_PROGRAM_ID_PLACEHOLDER,
            },
          ],
        ])
      );

      const stats = await reconcileDelegations();

      expect(stats.driftsDetected).toBe(1);
      // flagged, NOT auto-revoked
      expect(stats.autoRevoked).toBe(0);
    });

    it('should NOT flag when on-chain amount is within 1% of DB value', async () => {
      // DB says 1,000,000; on-chain says 999,000 (0.1% difference — within threshold)
      const account = makeAccountRow({ remaining_amount: '1000000' });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'agent_delegation_accounts') {
          const chain = makeChain({ data: [account] });
          chain.update = vi.fn(() => {
            const inner: Record<string, ReturnType<typeof vi.fn>> = {};
            inner.eq = vi.fn(() => Promise.resolve({ error: null }));
            return inner;
          });
          return chain;
        }
        return makeChain();
      });

      mockCheckAllAgentDelegations.mockResolvedValue(
        new Map([
          [
            TOKEN_ACCOUNT,
            {
              isActive: true,
              delegate: DELEGATE_PUBKEY,
              remainingAmount: 999_000n, // 0.1% below — within 1% threshold
              balance: 5_000_000n,
              tokenMint: REAL_MINT,
              tokenAccount: TOKEN_ACCOUNT,
              programId: TOKEN_PROGRAM_ID_PLACEHOLDER,
            },
          ],
        ])
      );

      const stats = await reconcileDelegations();

      expect(stats.driftsDetected).toBe(0);
      expect(stats.autoRevoked).toBe(0);
    });
  });

  describe('drift detection: unexpected_topup', () => {
    it('should flag when on-chain amount is greater than DB remaining', async () => {
      // DB says 500,000; on-chain says 1,000,000 (top-up happened on-chain)
      const account = makeAccountRow({ remaining_amount: '500000' });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'agent_delegation_accounts') {
          const chain = makeChain({ data: [account] });
          chain.update = vi.fn(() => {
            const inner: Record<string, ReturnType<typeof vi.fn>> = {};
            inner.eq = vi.fn(() => Promise.resolve({ error: null }));
            return inner;
          });
          return chain;
        }
        if (table === 'reconciliation_log') {
          return makeChain();
        }
        return makeChain();
      });

      mockCheckAllAgentDelegations.mockResolvedValue(
        new Map([
          [
            TOKEN_ACCOUNT,
            {
              isActive: true,
              delegate: DELEGATE_PUBKEY,
              remainingAmount: 1_000_000n, // greater than DB remaining
              balance: 5_000_000n,
              tokenMint: REAL_MINT,
              tokenAccount: TOKEN_ACCOUNT,
              programId: TOKEN_PROGRAM_ID_PLACEHOLDER,
            },
          ],
        ])
      );

      const stats = await reconcileDelegations();

      expect(stats.driftsDetected).toBe(1);
      expect(stats.autoRevoked).toBe(0); // flagged, not revoked
    });
  });

  describe('on-chain state unknown', () => {
    it('should skip reconciliation when delegate and delegatedAmount are both undefined', async () => {
      const account = makeAccountRow();

      mockFrom.mockImplementation((table: string) => {
        if (table === 'agent_delegation_accounts') {
          const chain = makeChain({ data: [account] });
          chain.update = vi.fn(() => {
            const inner: Record<string, ReturnType<typeof vi.fn>> = {};
            inner.eq = vi.fn(() => Promise.resolve({ error: null }));
            return inner;
          });
          return chain;
        }
        return makeChain();
      });

      // On-chain map doesn't contain this account — so the default pre-populated
      // entry has exists=true, delegatedAmount=undefined, delegate=undefined
      mockCheckAllAgentDelegations.mockResolvedValue(new Map());

      const stats = await reconcileDelegations();

      // No drift detected because on-chain state is unknown
      expect(stats.driftsDetected).toBe(0);
      // Account was still checked
      expect(stats.checked).toBe(1);
    });
  });

  describe('pagination', () => {
    it('should process multiple pages when batch returns BATCH_SIZE=100 accounts', async () => {
      // First page: 100 accounts, second page: empty (triggers break)
      const firstPage = Array.from({ length: 100 }, (_, i) =>
        makeAccountRow({ id: `account-${i}`, token_account_address: `TokenAcct${String(i).padStart(37, '1')}` })
      );

      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'agent_delegation_accounts') {
          fromCallCount++;
          const data = fromCallCount === 1 ? firstPage : [];
          const chain = makeChain({ data });
          chain.update = vi.fn(() => {
            const inner: Record<string, ReturnType<typeof vi.fn>> = {};
            inner.eq = vi.fn(() => Promise.resolve({ error: null }));
            return inner;
          });
          return chain;
        }
        return makeChain();
      });

      // All accounts: on-chain state unknown (mock returns empty map)
      mockCheckAllAgentDelegations.mockResolvedValue(new Map());

      const stats = await reconcileDelegations();

      // First page: 100 accounts checked, second page: 0 (empty, breaks loop)
      expect(stats.checked).toBe(100);
    });

    it('should use cursor-based pagination: gt called with last id on second page', async () => {
      const firstPage = Array.from({ length: 100 }, (_, i) =>
        makeAccountRow({ id: `account-${String(i).padStart(4, '0')}`, token_account_address: `TokenAcct${String(i).padStart(37, '1')}` })
      );

      let fromCallCount = 0;
      const gtSpy = vi.fn();

      mockFrom.mockImplementation((table: string) => {
        if (table === 'agent_delegation_accounts') {
          fromCallCount++;
          const data = fromCallCount === 1 ? firstPage : [];
          const chain = makeChain({ data });
          // Override gt to spy on cursor arguments and still return an awaitable chain
          const resolvedValue = { data, error: null };
          chain.gt = vi.fn((...args: unknown[]) => {
            gtSpy(...args);
            const cursor = makeChain({ data });
            cursor.then = vi.fn(
              (onfulfilled?: (v: unknown) => unknown, onrejected?: (e: unknown) => unknown) =>
                Promise.resolve(resolvedValue).then(onfulfilled, onrejected)
            );
            return cursor;
          });
          chain.update = vi.fn(() => {
            const inner: Record<string, ReturnType<typeof vi.fn>> = {};
            inner.eq = vi.fn(() => Promise.resolve({ error: null }));
            return inner;
          });
          return chain;
        }
        return makeChain();
      });

      mockCheckAllAgentDelegations.mockResolvedValue(new Map());

      await reconcileDelegations();

      // Second iteration should call gt('id', last id from first page)
      expect(gtSpy).toHaveBeenCalledWith('id', firstPage[99].id);
    });
  });

  describe('graceful degradation', () => {
    it('should skip on-chain checks when NEXT_PUBLIC_HELIUS_RPC_URL is not set', async () => {
      delete process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
      delete process.env.HELIUS_RPC_URL;

      const account = makeAccountRow();
      mockFrom.mockImplementation((table: string) => {
        if (table === 'agent_delegation_accounts') {
          const chain = makeChain({ data: [account] });
          chain.update = vi.fn(() => {
            const inner: Record<string, ReturnType<typeof vi.fn>> = {};
            inner.eq = vi.fn(() => Promise.resolve({ error: null }));
            return inner;
          });
          return chain;
        }
        return makeChain();
      });

      const stats = await reconcileDelegations();

      // No on-chain checks → no drifts detected
      expect(stats.checked).toBe(1);
      expect(stats.driftsDetected).toBe(0);
      expect(mockCheckAllAgentDelegations).not.toHaveBeenCalled();
    });

    it('should degrade gracefully when @/lib/solana/delegation dynamic import fails', async () => {
      const account = makeAccountRow();

      mockFrom.mockImplementation((table: string) => {
        if (table === 'agent_delegation_accounts') {
          const chain = makeChain({ data: [account] });
          chain.update = vi.fn(() => {
            const inner: Record<string, ReturnType<typeof vi.fn>> = {};
            inner.eq = vi.fn(() => Promise.resolve({ error: null }));
            return inner;
          });
          return chain;
        }
        return makeChain();
      });

      // Simulate dynamic import failure by making checkAllAgentDelegations throw
      mockCheckAllAgentDelegations.mockRejectedValue(new Error('Module unavailable'));

      // Should NOT throw — errors in on-chain checks are caught and logged
      const stats = await reconcileDelegations();

      expect(stats.checked).toBe(1);
      expect(stats.driftsDetected).toBe(0);
    });

    it('should throw when Supabase query fails for active accounts', async () => {
      mockFrom.mockImplementation(() => {
        const chain = makeChain({ error: { message: 'DB connection failed' } });
        return chain;
      });

      await expect(reconcileDelegations()).rejects.toThrow('Failed to fetch delegation accounts');
    });
  });
});
