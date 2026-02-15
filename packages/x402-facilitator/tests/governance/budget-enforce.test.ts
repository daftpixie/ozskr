import { describe, it, expect, afterEach } from 'vitest';
import { createBudgetEnforcer, type BudgetEnforcer } from '../../src/governance/budget-enforce.js';

describe('BudgetEnforcer', () => {
  let enforcer: BudgetEnforcer;

  afterEach(() => {
    enforcer?.destroy();
  });

  it('first payment within cap returns within_cap', () => {
    enforcer = createBudgetEnforcer();
    const result = enforcer.check('agent:acct', 1000000n, 5000000n);
    expect(result.status).toBe('within_cap');
    expect(result.totalSpent).toBe(0n);
    expect(result.remainingBudget).toBe(5000000n);
  });

  it('cumulative payments tracked correctly', () => {
    enforcer = createBudgetEnforcer();
    enforcer.record('agent:acct', 1000000n);
    enforcer.record('agent:acct', 2000000n);

    const result = enforcer.check('agent:acct', 1000000n, 5000000n);
    expect(result.status).toBe('within_cap');
    expect(result.totalSpent).toBe(3000000n);
    expect(result.remainingBudget).toBe(2000000n);
  });

  it('returns at_cap when payment equals remaining', () => {
    enforcer = createBudgetEnforcer();
    enforcer.record('agent:acct', 4000000n);

    const result = enforcer.check('agent:acct', 1000000n, 5000000n);
    expect(result.status).toBe('at_cap');
  });

  it('returns over_cap when cumulative exceeds delegation', () => {
    enforcer = createBudgetEnforcer();
    enforcer.record('agent:acct', 4000000n);

    const result = enforcer.check('agent:acct', 2000000n, 5000000n);
    expect(result.status).toBe('over_cap');
    expect(result.remainingBudget).toBe(1000000n);
  });

  it('on-chain delegatedAmount takes precedence over tracker', () => {
    enforcer = createBudgetEnforcer();
    enforcer.record('agent:acct', 2000000n);

    // On-chain shows only 1000000 remaining (someone spent outside facilitator)
    const result = enforcer.check('agent:acct', 500000n, 3000000n);
    expect(result.status).toBe('within_cap');
    expect(result.remainingBudget).toBe(1000000n);
  });

  it('reset clears counter for key', () => {
    enforcer = createBudgetEnforcer();
    enforcer.record('agent:acct', 4000000n);
    enforcer.reset('agent:acct');

    const result = enforcer.check('agent:acct', 1000000n, 5000000n);
    expect(result.status).toBe('within_cap');
    expect(result.totalSpent).toBe(0n);
  });

  it('tracks separate keys independently', () => {
    enforcer = createBudgetEnforcer();
    enforcer.record('agent1:acct1', 4000000n);
    enforcer.record('agent2:acct2', 1000000n);

    expect(enforcer.totalSpent('agent1:acct1')).toBe(4000000n);
    expect(enforcer.totalSpent('agent2:acct2')).toBe(1000000n);
  });

  it('destroy clears all data', () => {
    enforcer = createBudgetEnforcer();
    enforcer.record('agent:acct', 1000000n);
    enforcer.destroy();
    expect(enforcer.totalSpent('agent:acct')).toBe(0n);
  });
});
