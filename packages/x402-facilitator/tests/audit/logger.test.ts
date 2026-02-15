import { describe, it, expect, vi } from 'vitest';
import { ConsoleAuditLogger, InMemoryAuditLogger, type AuditLogEntry } from '../../src/audit/logger.js';

function createTestEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    timestamp: new Date().toISOString(),
    action: 'settle',
    status: 'success',
    payerAddress: 'payer123',
    recipientAddress: 'recipient456',
    amount: '1000000',
    tokenMint: 'USDC_MINT',
    network: 'solana:devnet',
    governanceResult: {
      ofac: 'pass',
      delegation: 'pass',
      budget: 'pass',
      circuitBreaker: 'open',
    },
    latencyMs: 42,
    ...overrides,
  };
}

describe('InMemoryAuditLogger', () => {
  it('captures log entries', () => {
    const logger = new InMemoryAuditLogger();
    const entry = createTestEntry();
    logger.log(entry);
    expect(logger.entries).toHaveLength(1);
    expect(logger.entries[0]).toEqual(entry);
  });

  it('captures multiple entries', () => {
    const logger = new InMemoryAuditLogger();
    logger.log(createTestEntry({ action: 'verify' }));
    logger.log(createTestEntry({ action: 'settle' }));
    expect(logger.entries).toHaveLength(2);
  });

  it('clear removes all entries', () => {
    const logger = new InMemoryAuditLogger();
    logger.log(createTestEntry());
    logger.log(createTestEntry());
    logger.clear();
    expect(logger.entries).toHaveLength(0);
  });

  it('successful settlement has txSignature', () => {
    const logger = new InMemoryAuditLogger();
    logger.log(createTestEntry({ txSignature: 'tx_abc123' }));
    expect(logger.entries[0].txSignature).toBe('tx_abc123');
  });

  it('rejected payment has errorReason', () => {
    const logger = new InMemoryAuditLogger();
    logger.log(createTestEntry({
      status: 'rejected',
      errorReason: 'OFAC: sanctioned address',
      governanceResult: { ofac: 'fail', delegation: 'skip', budget: 'skip', circuitBreaker: 'skip' },
    }));
    expect(logger.entries[0].status).toBe('rejected');
    expect(logger.entries[0].errorReason).toContain('OFAC');
    expect(logger.entries[0].governanceResult.ofac).toBe('fail');
  });

  it('entries have valid ISO 8601 timestamp', () => {
    const logger = new InMemoryAuditLogger();
    logger.log(createTestEntry());
    const ts = logger.entries[0].timestamp;
    expect(new Date(ts).toISOString()).toBe(ts);
  });

  it('entries have positive latencyMs', () => {
    const logger = new InMemoryAuditLogger();
    logger.log(createTestEntry({ latencyMs: 150 }));
    expect(logger.entries[0].latencyMs).toBeGreaterThan(0);
  });
});

describe('ConsoleAuditLogger', () => {
  it('writes structured JSON to stdout', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const logger = new ConsoleAuditLogger();
    const entry = createTestEntry();
    logger.log(entry);

    expect(writeSpy).toHaveBeenCalledOnce();
    const output = writeSpy.mock.calls[0][0] as string;
    expect(output.endsWith('\n')).toBe(true);

    const parsed = JSON.parse(output.trim());
    expect(parsed.action).toBe('settle');
    expect(parsed.payerAddress).toBe('payer123');

    writeSpy.mockRestore();
  });
});
