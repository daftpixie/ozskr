import type { x402Facilitator } from '@x402/core/facilitator';
import type { GovernanceConfig } from './config.js';
import type { ReplayGuard } from './replay.js';
import type { OfacScreener } from './governance/ofac-screening.js';
import type { CircuitBreaker } from './governance/circuit-breaker.js';
import type { BudgetEnforcer } from './governance/budget-enforce.js';
import type { DelegationRpc } from './governance/delegation-check.js';
import { checkDelegation } from './governance/delegation-check.js';
import type { AuditLogger, AuditLogEntry } from './audit/logger.js';

// ---------------------------------------------------------------------------
// Governance Check Result
// ---------------------------------------------------------------------------

export type GovernanceCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string };

// ---------------------------------------------------------------------------
// Pure Check Functions (existing — unchanged API)
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
// Hook Wiring (Enhanced — Days 5-7)
// ---------------------------------------------------------------------------

export interface GovernanceResources {
  replayGuard: ReplayGuard;
  rateCounter: RateCounter;
  ofacScreener?: OfacScreener;
  circuitBreaker?: CircuitBreaker;
  budgetEnforcer?: BudgetEnforcer;
  auditLogger?: AuditLogger;
  destroy: () => void;
}

export interface GovernanceHookDeps {
  ofacScreener?: OfacScreener;
  circuitBreaker?: CircuitBreaker;
  budgetEnforcer?: BudgetEnforcer;
  delegationRpc?: DelegationRpc;
  auditLogger?: AuditLogger;
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
  deps: GovernanceHookDeps = {},
): GovernanceResources {
  const rateCounter = createRateCounter();
  const { ofacScreener, circuitBreaker, budgetEnforcer, delegationRpc, auditLogger } = deps;

  facilitator.onBeforeVerify(async (context) => {
    const startTime = Date.now();
    const { requirements } = context;
    const govResults: AuditLogEntry['governanceResult'] = {
      ofac: 'skip', delegation: 'skip', budget: 'skip', circuitBreaker: 'skip',
    };

    // 1. Fast local checks
    const result = runGovernanceChecks(requirements, governance);
    if (!result.allowed) {
      if (auditLogger) {
        auditLogger.log({
          timestamp: new Date().toISOString(),
          action: 'verify',
          status: 'rejected',
          payerAddress: (context.paymentPayload?.payload?.payer as string) ?? 'unknown',
          recipientAddress: requirements.payTo,
          amount: requirements.amount,
          tokenMint: requirements.asset,
          network: requirements.network ?? 'unknown',
          governanceResult: govResults,
          latencyMs: Date.now() - startTime,
          errorReason: result.reason,
        });
      }
      return { abort: true, reason: result.reason };
    }

    // 2. OFAC screening
    if (governance.ofacEnabled && ofacScreener) {
      const payer = (context.paymentPayload?.payload?.payer as string) ?? '';
      const addresses = [payer, requirements.payTo].filter(Boolean);
      const ofacResult = await ofacScreener.screen(addresses);
      govResults.ofac = ofacResult.status;

      if (ofacResult.status === 'fail') {
        const reason = `OFAC: sanctioned address ${ofacResult.matchedAddress}`;
        if (auditLogger) {
          auditLogger.log({
            timestamp: new Date().toISOString(),
            action: 'verify',
            status: 'rejected',
            payerAddress: payer,
            recipientAddress: requirements.payTo,
            amount: requirements.amount,
            tokenMint: requirements.asset,
            network: requirements.network ?? 'unknown',
            governanceResult: govResults,
            latencyMs: Date.now() - startTime,
            errorReason: reason,
          });
        }
        return { abort: true, reason };
      }
      if (ofacResult.status === 'error') {
        const reason = `OFAC: screening unavailable — ${ofacResult.errorDetail}`;
        if (auditLogger) {
          auditLogger.log({
            timestamp: new Date().toISOString(),
            action: 'verify',
            status: 'rejected',
            payerAddress: payer,
            recipientAddress: requirements.payTo,
            amount: requirements.amount,
            tokenMint: requirements.asset,
            network: requirements.network ?? 'unknown',
            governanceResult: govResults,
            latencyMs: Date.now() - startTime,
            errorReason: reason,
          });
        }
        return { abort: true, reason };
      }
    }
  });

  facilitator.onBeforeSettle(async (context) => {
    const startTime = Date.now();
    const { requirements, paymentPayload } = context;
    const govResults: AuditLogEntry['governanceResult'] = {
      ofac: 'skip', delegation: 'skip', budget: 'skip', circuitBreaker: 'skip',
    };

    // Defense-in-depth: re-run all local governance checks
    const result = runGovernanceChecks(requirements, governance);
    if (!result.allowed) {
      return { abort: true, reason: result.reason };
    }

    // Rate limit check
    const rateResult = checkRateLimit(rateCounter.count(), governance.rateLimitPerMinute);
    if (!rateResult.allowed) {
      return { abort: true, reason: rateResult.reason };
    }

    // Replay check
    const signature = paymentPayload.payload?.transaction as string | undefined;
    if (signature && replayGuard.check(signature)) {
      return { abort: true, reason: `Replay detected for signature ${signature}` };
    }

    // OFAC screening (defense-in-depth)
    if (governance.ofacEnabled && ofacScreener) {
      const payer = (paymentPayload.payload?.payer as string) ?? '';
      const addresses = [payer, requirements.payTo].filter(Boolean);
      const ofacResult = await ofacScreener.screen(addresses);
      govResults.ofac = ofacResult.status;

      if (ofacResult.status === 'fail') {
        return { abort: true, reason: `OFAC: sanctioned address ${ofacResult.matchedAddress}` };
      }
      if (ofacResult.status === 'error') {
        return { abort: true, reason: `OFAC: screening unavailable — ${ofacResult.errorDetail}` };
      }
    }

    // Circuit breaker
    if (governance.circuitBreakerEnabled && circuitBreaker) {
      const agent = (paymentPayload.payload?.payer as string) ?? 'unknown';
      const cbResult = circuitBreaker.check(agent, requirements.payTo, BigInt(requirements.amount));
      govResults.circuitBreaker = cbResult.status;

      if (cbResult.status === 'tripped') {
        if (auditLogger) {
          auditLogger.log({
            timestamp: new Date().toISOString(),
            action: 'settle',
            status: 'rejected',
            payerAddress: agent,
            recipientAddress: requirements.payTo,
            amount: requirements.amount,
            tokenMint: requirements.asset,
            network: requirements.network ?? 'unknown',
            governanceResult: govResults,
            latencyMs: Date.now() - startTime,
            errorReason: cbResult.reason,
          });
        }
        return { abort: true, reason: cbResult.reason ?? 'Circuit breaker tripped' };
      }
    }

    // Delegation check
    if (governance.delegationCheckEnabled && delegationRpc) {
      const payer = (paymentPayload.payload?.payer as string) ?? '';
      const sourceAccount = (paymentPayload.payload?.sourceTokenAccount as string) ?? '';
      if (payer && sourceAccount) {
        const delResult = await checkDelegation(
          delegationRpc, payer, sourceAccount,
          BigInt(requirements.amount), requirements.asset,
        );
        govResults.delegation = delResult.status;

        if (delResult.status !== 'active') {
          const reason = `Delegation check: ${delResult.status}${delResult.errorDetail ? ` — ${delResult.errorDetail}` : ''}`;
          return { abort: true, reason };
        }

        // Budget enforcement
        if (governance.budgetEnforceEnabled && budgetEnforcer && delResult.delegatedAmount !== undefined) {
          const budgetKey = `${payer}:${sourceAccount}`;
          const budgetResult = budgetEnforcer.check(
            budgetKey, BigInt(requirements.amount), delResult.delegatedAmount,
          );
          govResults.budget = budgetResult.status;

          if (budgetResult.status === 'over_cap' || budgetResult.status === 'at_cap') {
            return { abort: true, reason: `Budget exceeded: spent ${budgetResult.totalSpent}, remaining ${budgetResult.remainingBudget}` };
          }
        }
      }
    }
  });

  facilitator.onAfterSettle(async (context) => {
    const { requirements, paymentPayload } = context;

    // Record in replay guard
    const ttl = (requirements.maxTimeoutSeconds ?? 300) + 60;
    const txSig = context.result.transaction;
    if (txSig) {
      replayGuard.record(txSig, ttl);
    }
    rateCounter.increment();

    // Record in circuit breaker
    if (governance.circuitBreakerEnabled && circuitBreaker) {
      const agent = (paymentPayload.payload?.payer as string) ?? 'unknown';
      circuitBreaker.record(agent, requirements.payTo, BigInt(requirements.amount));
    }

    // Record in budget enforcer
    if (governance.budgetEnforceEnabled && budgetEnforcer) {
      const payer = (paymentPayload.payload?.payer as string) ?? '';
      const sourceAccount = (paymentPayload.payload?.sourceTokenAccount as string) ?? '';
      if (payer && sourceAccount) {
        budgetEnforcer.record(`${payer}:${sourceAccount}`, BigInt(requirements.amount));
      }
    }

    // Audit log
    if (auditLogger) {
      auditLogger.log({
        timestamp: new Date().toISOString(),
        action: 'settle',
        status: 'success',
        payerAddress: (paymentPayload.payload?.payer as string) ?? 'unknown',
        recipientAddress: requirements.payTo,
        amount: requirements.amount,
        tokenMint: requirements.asset,
        network: requirements.network ?? context.result.network ?? 'unknown',
        governanceResult: { ofac: 'pass', delegation: 'pass', budget: 'pass', circuitBreaker: 'open' },
        txSignature: txSig,
        latencyMs: 0,
      });
    }
  });

  facilitator.onSettleFailure(async (context) => {
    // Do NOT record in replay guard — failed settlements should be retryable
    if (auditLogger) {
      auditLogger.log({
        timestamp: new Date().toISOString(),
        action: 'settle',
        status: 'failed',
        payerAddress: (context.paymentPayload.payload?.payer as string) ?? 'unknown',
        recipientAddress: context.requirements.payTo,
        amount: context.requirements.amount,
        tokenMint: context.requirements.asset,
        network: context.requirements.network ?? 'unknown',
        governanceResult: { ofac: 'skip', delegation: 'skip', budget: 'skip', circuitBreaker: 'skip' },
        latencyMs: 0,
        errorReason: context.error.message,
      });
    }
  });

  return {
    replayGuard,
    rateCounter,
    ofacScreener,
    circuitBreaker,
    budgetEnforcer,
    auditLogger,
    destroy() {
      rateCounter.destroy();
      circuitBreaker?.destroy();
      budgetEnforcer?.destroy();
    },
  };
}
