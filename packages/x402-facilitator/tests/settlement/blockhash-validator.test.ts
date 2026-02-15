import { describe, it, expect, vi } from 'vitest';
import { validateBlockhashFreshness, type BlockhashRpc } from '../../src/settlement/blockhash-validator.js';

function createMockRpc(isValid: boolean): BlockhashRpc {
  return {
    isBlockhashValid: vi.fn().mockReturnValue({
      send: vi.fn().mockResolvedValue({ value: isValid }),
    }),
  };
}

describe('validateBlockhashFreshness', () => {
  it('returns valid for fresh blockhash', async () => {
    const rpc = createMockRpc(true);
    const result = await validateBlockhashFreshness(rpc, 'abc123');
    expect(result.isValid).toBe(true);
    expect(result.maxAge).toBe(60);
  });

  it('returns invalid for expired blockhash', async () => {
    const rpc = createMockRpc(false);
    const result = await validateBlockhashFreshness(rpc, 'expired_hash');
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('expired');
    expect(result.reason).toContain('rebuild');
  });

  it('returns valid on RPC failure (fail-open)', async () => {
    const rpc: BlockhashRpc = {
      isBlockhashValid: vi.fn().mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('RPC timeout')),
      }),
    };
    const result = await validateBlockhashFreshness(rpc, 'some_hash');
    expect(result.isValid).toBe(true);
    expect(result.reason).toContain('fail-open');
  });

  it('uses custom maxAgeSeconds', async () => {
    const rpc = createMockRpc(false);
    const result = await validateBlockhashFreshness(rpc, 'hash', 30);
    expect(result.maxAge).toBe(30);
  });

  it('calls RPC with correct parameters', async () => {
    const mockSend = vi.fn().mockResolvedValue({ value: true });
    const rpc: BlockhashRpc = {
      isBlockhashValid: vi.fn().mockReturnValue({ send: mockSend }),
    };
    await validateBlockhashFreshness(rpc, 'test_hash');
    expect(rpc.isBlockhashValid).toHaveBeenCalledWith('test_hash', { commitment: 'processed' });
  });
});
