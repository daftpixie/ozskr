import { describe, it, expect, vi } from 'vitest';
import { GasManager, type GasRpc } from '../../src/settlement/gas-manager.js';

function createMockRpc(balanceLamports: bigint): GasRpc {
  return {
    getBalance: vi.fn().mockReturnValue({
      send: vi.fn().mockResolvedValue({ value: balanceLamports }),
    }),
  };
}

describe('GasManager', () => {
  it('reports healthy when balance above threshold', async () => {
    const rpc = createMockRpc(500_000_000n); // 0.5 SOL
    const manager = new GasManager(rpc, 'feePayer', 0.1);
    const status = await manager.checkBalance();
    expect(status.isHealthy).toBe(true);
    expect(status.balanceSol).toBeCloseTo(0.5, 1);
    expect(status.estimatedSettlementsRemaining).toBeGreaterThan(0);
  });

  it('reports unhealthy when balance below threshold', async () => {
    const rpc = createMockRpc(50_000_000n); // 0.05 SOL
    const manager = new GasManager(rpc, 'feePayer', 0.1);
    const status = await manager.checkBalance();
    expect(status.isHealthy).toBe(false);
  });

  it('canAffordSettlement returns true with sufficient balance', async () => {
    const rpc = createMockRpc(1_000_000n);
    const manager = new GasManager(rpc, 'feePayer', 0.1);
    expect(await manager.canAffordSettlement()).toBe(true);
  });

  it('canAffordSettlement returns false with zero balance', async () => {
    const rpc = createMockRpc(0n);
    const manager = new GasManager(rpc, 'feePayer', 0.1);
    expect(await manager.canAffordSettlement()).toBe(false);
  });

  it('canAffordSettlement returns true on RPC failure (fail-open)', async () => {
    const rpc: GasRpc = {
      getBalance: vi.fn().mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('RPC error')),
      }),
    };
    const manager = new GasManager(rpc, 'feePayer', 0.1);
    expect(await manager.canAffordSettlement()).toBe(true);
  });

  it('reports correct fee payer address', async () => {
    const rpc = createMockRpc(1_000_000_000n);
    const manager = new GasManager(rpc, 'myFeePayerAddr', 0.1);
    const status = await manager.checkBalance();
    expect(status.feePayerAddress).toBe('myFeePayerAddr');
    expect(status.alertThresholdSol).toBe(0.1);
  });
});
