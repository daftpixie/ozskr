import type { x402Facilitator } from '@x402/core/facilitator';
import type { GovernanceConfig } from './config.js';
import type { ReplayGuard } from './replay.js';

// ---------------------------------------------------------------------------
// Governance Check Result
// ---------------------------------------------------------------------------

export type GovernanceCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string };

// ---------------------------------------------------------------------------
// Pure Check Functions
// ---------------------------------------------------------------------------

export function checkTokenAllowlist(
  asset: string,
  allowed?: string[],
): GovernanceCheckResult {
  if (!allowed || allowed.length === 0) return { allowed: true };
  if (allowed.includes(asset)) return { allowed: true };
  return { allowed: false, reason: `Token ${asset} is not in the allowlist` };
}

export function checkRecipientAllowlist(
  payTo: string,
  allowed?: string[],
): GovernanceCheckResult {
  if (!allowed || allowed.length === 0) return { allowed: true };
  if (allowed.includes(payTo)) return { allowed: true };
  return { allowed: false, reason: `Recipient ${payTo} is not in the allowlist` };
}

export function checkAmountCap(
  amount: string,
  max?: string,
): GovernanceCheckResult {
  if (!max) return { allowed: true };
  if (BigInt(amount) <= BigInt(max)) return { allowed: true };
  return { allowed: false, reason: `Amount ${amount} exceeds cap ${max}` };
}

export function checkRateLimit(
  count: number,
  max: number,
): GovernanceCheckResult {
  if (count < max) return { allowed: true };
  return { allowed: false, reason: `Rate limit exceeded: ${count}/${max} per minute` };
}

// ---------------------------------------------------------------------------
// Rate Counter
// ---------------------------------------------------------------------------

interface RateCounter {
  increment(): void;
  count(): number;
  destroy(): void;
}

function createRateCounter(): RateCounter {
  let current = 0;
  const timer = setInterval(() => { current = 0; }, 60_000);
  if (timer && typeof timer === 'object' && 'unref' in timer) {
    timer.unref();
  }

  return {
    increment() { current++; },
    count() { return current; },
    destroy() { clearInterval(timer); current = 0; },
  };
}

// ---------------------------------------------------------------------------
// Hook Wiring
// ---------------------------------------------------------------------------

export interface GovernanceResources {
  replayGuard: ReplayGuard;
  rateCounter: RateCounter;
  destroy: () => void;
}

function runGovernanceChecks(
  requirements: { asset: string; payTo: string; amount: string },
  governance: GovernanceConfig,
): GovernanceCheckResult {
  const tokenCheck = checkTokenAllowlist(requirements.asset, governance.allowedTokens);
  if (!tokenCheck.allowed) return tokenCheck;

  const recipientCheck = checkRecipientAllowlist(requirements.payTo, governance.allowedRecipients);
  if (!recipientCheck.allowed) return recipientCheck;

  const amountCheck = checkAmountCap(requirements.amount, governance.maxSettlementAmount);
  if (!amountCheck.allowed) return amountCheck;

  return { allowed: true };
}

export function wireGovernanceHooks(
  facilitator: x402Facilitator,
  governance: GovernanceConfig,
  replayGuard: ReplayGuard,
): GovernanceResources {
  const rateCounter = createRateCounter();

  facilitator.onBeforeVerify(async (context) => {
    const { requirements } = context;
    const result = runGovernanceChecks(requirements, governance);
    if (!result.allowed) {
      return { abort: true, reason: result.reason };
    }
  });

  facilitator.onBeforeSettle(async (context) => {
    const { requirements, paymentPayload } = context;

    // Defense-in-depth: re-run all governance checks
    const result = runGovernanceChecks(requirements, governance);
    if (!result.allowed) {
      return { abort: true, reason: result.reason };
    }

    // Rate limit check
    const rateResult = checkRateLimit(rateCounter.count(), governance.rateLimitPerMinute);
    if (!rateResult.allowed) {
      return { abort: true, reason: rateResult.reason };
    }

    // Replay check — use transaction signature from payload if available
    const signature = paymentPayload.payload?.transaction as string | undefined;
    if (signature && replayGuard.check(signature)) {
      return { abort: true, reason: `Replay detected for signature ${signature}` };
    }
  });

  facilitator.onAfterSettle(async (context) => {
    // Record in replay guard with TTL based on maxTimeoutSeconds + safety margin
    const ttl = (context.requirements.maxTimeoutSeconds ?? 300) + 60;
    const txSig = context.result.transaction;
    if (txSig) {
      replayGuard.record(txSig, ttl);
    }
    rateCounter.increment();
  });

  facilitator.onSettleFailure(async () => {
    // Do NOT record in replay guard — failed settlements should be retryable
  });

  return {
    replayGuard,
    rateCounter,
    destroy() {
      rateCounter.destroy();
    },
  };
}
