import { describe, it, expect, vi } from 'vitest';
import { checkDelegation, type DelegationRpc } from '../../src/governance/delegation-check.js';

function createMockRpc(responseValue: unknown): DelegationRpc {
  return {
    getAccountInfo: vi.fn().mockReturnValue({
      send: vi.fn().mockResolvedValue({ value: responseValue }),
    }),
  };
}

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

describe('checkDelegation', () => {
  it('returns active for valid Token Program delegation', async () => {
    const rpc = createMockRpc({
      owner: TOKEN_PROGRAM_ID,
      data: {
        program: 'spl-token',
        parsed: {
          type: 'account',
          info: {
            delegate: 'agent123',
            delegatedAmount: { amount: '5000000', decimals: 6 },
            mint: 'USDC_MINT',
            owner: 'owner123',
            state: 'initialized',
          },
        },
      },
    });

    const result = await checkDelegation(rpc, 'agent123', 'tokenAcct', 1000000n, 'USDC_MINT');
    expect(result.status).toBe('active');
    expect(result.delegate).toBe('agent123');
    expect(result.delegatedAmount).toBe(5000000n);
    expect(result.programId).toBe(TOKEN_PROGRAM_ID);
  });

  it('returns active for valid Token-2022 delegation', async () => {
    const rpc = createMockRpc({
      owner: TOKEN_2022_PROGRAM_ID,
      data: {
        program: 'spl-token-2022',
        parsed: {
          type: 'account',
          info: {
            delegate: 'agent456',
            delegatedAmount: { amount: '3000000', decimals: 6 },
            mint: 'USDC_2022',
            owner: 'owner456',
            state: 'initialized',
          },
        },
      },
    });

    const result = await checkDelegation(rpc, 'agent456', 'tokenAcct', 1000000n, 'USDC_2022');
    expect(result.status).toBe('active');
    expect(result.programId).toBe(TOKEN_2022_PROGRAM_ID);
  });

  it('returns not_delegated when no delegate field', async () => {
    const rpc = createMockRpc({
      owner: TOKEN_PROGRAM_ID,
      data: {
        program: 'spl-token',
        parsed: {
          type: 'account',
          info: {
            mint: 'USDC_MINT',
            owner: 'owner123',
            state: 'initialized',
          },
        },
      },
    });

    const result = await checkDelegation(rpc, 'agent123', 'tokenAcct', 1000000n, 'USDC_MINT');
    expect(result.status).toBe('not_delegated');
  });

  it('returns not_delegated when delegate does not match payer', async () => {
    const rpc = createMockRpc({
      owner: TOKEN_PROGRAM_ID,
      data: {
        program: 'spl-token',
        parsed: {
          type: 'account',
          info: {
            delegate: 'different_agent',
            delegatedAmount: { amount: '5000000', decimals: 6 },
            mint: 'USDC_MINT',
            owner: 'owner123',
            state: 'initialized',
          },
        },
      },
    });

    const result = await checkDelegation(rpc, 'agent123', 'tokenAcct', 1000000n, 'USDC_MINT');
    expect(result.status).toBe('not_delegated');
    expect(result.errorDetail).toContain('does not match payer');
  });

  it('returns insufficient when delegatedAmount < paymentAmount', async () => {
    const rpc = createMockRpc({
      owner: TOKEN_PROGRAM_ID,
      data: {
        program: 'spl-token',
        parsed: {
          type: 'account',
          info: {
            delegate: 'agent123',
            delegatedAmount: { amount: '500000', decimals: 6 },
            mint: 'USDC_MINT',
            owner: 'owner123',
            state: 'initialized',
          },
        },
      },
    });

    const result = await checkDelegation(rpc, 'agent123', 'tokenAcct', 1000000n, 'USDC_MINT');
    expect(result.status).toBe('insufficient');
    expect(result.delegatedAmount).toBe(500000n);
    expect(result.requiredAmount).toBe(1000000n);
  });

  it('returns error when account not found', async () => {
    const rpc = createMockRpc(null);
    const result = await checkDelegation(rpc, 'agent123', 'tokenAcct', 1000000n, 'USDC_MINT');
    expect(result.status).toBe('error');
    expect(result.errorDetail).toContain('not found');
  });

  it('returns error when RPC fails', async () => {
    const rpc: DelegationRpc = {
      getAccountInfo: vi.fn().mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('RPC timeout')),
      }),
    };
    const result = await checkDelegation(rpc, 'agent123', 'tokenAcct', 1000000n, 'USDC_MINT');
    expect(result.status).toBe('error');
    expect(result.errorDetail).toContain('RPC timeout');
  });

  it('returns error for mint mismatch', async () => {
    const rpc = createMockRpc({
      owner: TOKEN_PROGRAM_ID,
      data: {
        program: 'spl-token',
        parsed: {
          type: 'account',
          info: {
            delegate: 'agent123',
            delegatedAmount: { amount: '5000000', decimals: 6 },
            mint: 'WRONG_MINT',
            owner: 'owner123',
          },
        },
      },
    });

    const result = await checkDelegation(rpc, 'agent123', 'tokenAcct', 1000000n, 'USDC_MINT');
    expect(result.status).toBe('error');
    expect(result.errorDetail).toContain('mint mismatch');
  });

  it('returns inactive for frozen account', async () => {
    const rpc = createMockRpc({
      owner: TOKEN_PROGRAM_ID,
      data: {
        program: 'spl-token',
        parsed: {
          type: 'account',
          info: {
            delegate: 'agent123',
            delegatedAmount: { amount: '5000000', decimals: 6 },
            mint: 'USDC_MINT',
            owner: 'owner123',
            state: 'frozen',
          },
        },
      },
    });

    const result = await checkDelegation(rpc, 'agent123', 'tokenAcct', 1000000n, 'USDC_MINT');
    expect(result.status).toBe('inactive');
    expect(result.errorDetail).toContain('frozen');
  });
});
