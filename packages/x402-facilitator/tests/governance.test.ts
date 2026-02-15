import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkTokenAllowlist,
  checkRecipientAllowlist,
  checkAmountCap,
  checkRateLimit,
  wireGovernanceHooks,
} from '../src/governance.js';
import { createReplayGuard } from '../src/replay.js';
import type { GovernanceConfig } from '../src/config.js';

// ---------------------------------------------------------------------------
// Pure check functions
// ---------------------------------------------------------------------------

describe('checkTokenAllowlist', () => {
  it('allows any token when allowlist is undefined', () => {
    const result = checkTokenAllowlist('any-token');
    expect(result.allowed).toBe(true);
  });

  it('allows any token when allowlist is empty', () => {
    const result = checkTokenAllowlist('any-token', []);
    expect(result.allowed).toBe(true);
  });

  it('allows token in the allowlist', () => {
    const result = checkTokenAllowlist('USDC', ['USDC', 'USDT']);
    expect(result.allowed).toBe(true);
  });

  it('rejects token not in allowlist', () => {
    const result = checkTokenAllowlist('BONK', ['USDC', 'USDT']);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain('BONK');
      expect(result.reason).toContain('allowlist');
    }
  });
});

describe('checkRecipientAllowlist', () => {
  it('allows any recipient when allowlist is undefined', () => {
    const result = checkRecipientAllowlist('some-address');
    expect(result.allowed).toBe(true);
  });

  it('allows any recipient when allowlist is empty', () => {
    const result = checkRecipientAllowlist('some-address', []);
    expect(result.allowed).toBe(true);
  });

  it('allows recipient in the allowlist', () => {
    const result = checkRecipientAllowlist('addr1', ['addr1', 'addr2']);
    expect(result.allowed).toBe(true);
  });

  it('rejects recipient not in allowlist', () => {
    const result = checkRecipientAllowlist('addr3', ['addr1', 'addr2']);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain('addr3');
    }
  });
});

describe('checkAmountCap', () => {
  it('allows any amount when max is undefined', () => {
    const result = checkAmountCap('99999999999');
    expect(result.allowed).toBe(true);
  });

  it('allows amount under cap', () => {
    const result = checkAmountCap('5000000', '10000000');
    expect(result.allowed).toBe(true);
  });

  it('allows amount equal to cap', () => {
    const result = checkAmountCap('10000000', '10000000');
    expect(result.allowed).toBe(true);
  });

  it('rejects amount over cap', () => {
    const result = checkAmountCap('10000001', '10000000');
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain('10000001');
      expect(result.reason).toContain('10000000');
    }
  });
});

describe('checkRateLimit', () => {
  it('allows under limit', () => {
    const result = checkRateLimit(5, 60);
    expect(result.allowed).toBe(true);
  });

  it('rejects at limit', () => {
    const result = checkRateLimit(60, 60);
    expect(result.allowed).toBe(false);
  });

  it('rejects over limit', () => {
    const result = checkRateLimit(61, 60);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain('Rate limit');
    }
  });
});

// ---------------------------------------------------------------------------
// Hook wiring
// ---------------------------------------------------------------------------

describe('wireGovernanceHooks', () => {
  let mockFacilitator: {
    onBeforeVerify: ReturnType<typeof vi.fn>;
    onAfterVerify: ReturnType<typeof vi.fn>;
    onBeforeSettle: ReturnType<typeof vi.fn>;
    onAfterSettle: ReturnType<typeof vi.fn>;
    onSettleFailure: ReturnType<typeof vi.fn>;
  };
  let replayGuard: ReturnType<typeof createReplayGuard>;

  beforeEach(() => {
    mockFacilitator = {
      onBeforeVerify: vi.fn().mockReturnThis(),
      onAfterVerify: vi.fn().mockReturnThis(),
      onBeforeSettle: vi.fn().mockReturnThis(),
      onAfterSettle: vi.fn().mockReturnThis(),
      onSettleFailure: vi.fn().mockReturnThis(),
    };
    replayGuard = createReplayGuard();
  });

  afterEach(() => {
    replayGuard.destroy();
  });

  const governance: GovernanceConfig = {
    allowedTokens: ['USDC'],
    allowedRecipients: ['recipient1'],
    maxSettlementAmount: '10000000',
    rateLimitPerMinute: 60,
  };

  it('registers all four hooks', () => {
    const resources = wireGovernanceHooks(
      mockFacilitator as unknown as Parameters<typeof wireGovernanceHooks>[0],
      governance,
      replayGuard,
    );

    expect(mockFacilitator.onBeforeVerify).toHaveBeenCalledOnce();
    expect(mockFacilitator.onBeforeSettle).toHaveBeenCalledOnce();
    expect(mockFacilitator.onAfterSettle).toHaveBeenCalledOnce();
    expect(mockFacilitator.onSettleFailure).toHaveBeenCalledOnce();

    resources.destroy();
  });

  it('beforeVerify aborts on disallowed token', async () => {
    wireGovernanceHooks(
      mockFacilitator as unknown as Parameters<typeof wireGovernanceHooks>[0],
      governance,
      replayGuard,
    );

    const hook = mockFacilitator.onBeforeVerify.mock.calls[0][0];
    const result = await hook({
      paymentPayload: {},
      requirements: { asset: 'BONK', payTo: 'recipient1', amount: '1000' },
    });

    expect(result).toEqual({ abort: true, reason: expect.stringContaining('BONK') });
  });

  it('beforeVerify allows valid token', async () => {
    wireGovernanceHooks(
      mockFacilitator as unknown as Parameters<typeof wireGovernanceHooks>[0],
      governance,
      replayGuard,
    );

    const hook = mockFacilitator.onBeforeVerify.mock.calls[0][0];
    const result = await hook({
      paymentPayload: {},
      requirements: { asset: 'USDC', payTo: 'recipient1', amount: '1000' },
    });

    expect(result).toBeUndefined();
  });

  it('beforeSettle aborts on replay', async () => {
    wireGovernanceHooks(
      mockFacilitator as unknown as Parameters<typeof wireGovernanceHooks>[0],
      governance,
      replayGuard,
    );

    // Record a signature in the replay guard
    replayGuard.record('tx_sig_abc', 300);

    const hook = mockFacilitator.onBeforeSettle.mock.calls[0][0];
    const result = await hook({
      paymentPayload: { payload: { transaction: 'tx_sig_abc' } },
      requirements: { asset: 'USDC', payTo: 'recipient1', amount: '1000' },
    });

    expect(result).toEqual({ abort: true, reason: expect.stringContaining('Replay') });
  });

  it('afterSettle records signature in replay guard', async () => {
    wireGovernanceHooks(
      mockFacilitator as unknown as Parameters<typeof wireGovernanceHooks>[0],
      governance,
      replayGuard,
    );

    const hook = mockFacilitator.onAfterSettle.mock.calls[0][0];
    await hook({
      paymentPayload: {},
      requirements: { maxTimeoutSeconds: 60 },
      result: { transaction: 'tx_settled_123' },
    });

    expect(replayGuard.check('tx_settled_123')).toBe(true);
  });

  it('afterSettle increments rate counter', async () => {
    const resources = wireGovernanceHooks(
      mockFacilitator as unknown as Parameters<typeof wireGovernanceHooks>[0],
      { ...governance, rateLimitPerMinute: 2 },
      replayGuard,
    );

    const afterHook = mockFacilitator.onAfterSettle.mock.calls[0][0];
    const beforeHook = mockFacilitator.onBeforeSettle.mock.calls[0][0];

    // Settle twice
    await afterHook({
      paymentPayload: {},
      requirements: { maxTimeoutSeconds: 60 },
      result: { transaction: 'tx_1' },
    });
    await afterHook({
      paymentPayload: {},
      requirements: { maxTimeoutSeconds: 60 },
      result: { transaction: 'tx_2' },
    });

    // Third settle should be rate limited
    const result = await beforeHook({
      paymentPayload: { payload: {} },
      requirements: { asset: 'USDC', payTo: 'recipient1', amount: '1000' },
    });
    expect(result).toEqual({ abort: true, reason: expect.stringContaining('Rate limit') });

    resources.destroy();
  });
});
