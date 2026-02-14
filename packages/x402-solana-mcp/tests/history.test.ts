import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendTransaction,
  queryHistory,
  type TransactionRecord,
} from '../src/lib/history.js';

// ---------------------------------------------------------------------------
// Temp directory
// ---------------------------------------------------------------------------

let tempDir: string;
let historyPath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'history-test-'));
  historyPath = join(tempDir, 'history.json');
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<TransactionRecord> = {}): TransactionRecord {
  return {
    timestamp: new Date().toISOString(),
    signature: `sig-${Math.random().toString(36).slice(2)}`,
    url: 'https://api.example.com/data',
    amount: '1000000',
    asset: 'USDC-mint',
    payTo: 'RecipientAddress',
    network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
    facilitator: 'cdp',
    method: 'GET',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// appendTransaction
// ---------------------------------------------------------------------------

describe('appendTransaction', () => {
  it('should create history file if it does not exist', async () => {
    await appendTransaction(makeRecord(), historyPath);

    const records = await queryHistory({}, historyPath);
    expect(records).toHaveLength(1);
  });

  it('should append multiple records', async () => {
    await appendTransaction(makeRecord({ signature: 'sig-1' }), historyPath);
    await appendTransaction(makeRecord({ signature: 'sig-2' }), historyPath);
    await appendTransaction(makeRecord({ signature: 'sig-3' }), historyPath);

    const records = await queryHistory({ limit: 100 }, historyPath);
    expect(records).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// queryHistory
// ---------------------------------------------------------------------------

describe('queryHistory', () => {
  it('should return empty array for nonexistent file', async () => {
    const records = await queryHistory({}, join(tempDir, 'nonexistent.json'));
    expect(records).toHaveLength(0);
  });

  it('should respect limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await appendTransaction(makeRecord({ signature: `sig-${i}` }), historyPath);
    }

    const records = await queryHistory({ limit: 3 }, historyPath);
    expect(records).toHaveLength(3);
  });

  it('should filter by URL (partial match)', async () => {
    await appendTransaction(makeRecord({ url: 'https://api.example.com/data' }), historyPath);
    await appendTransaction(makeRecord({ url: 'https://api.other.com/resource' }), historyPath);
    await appendTransaction(makeRecord({ url: 'https://api.example.com/other' }), historyPath);

    const records = await queryHistory({ url: 'example.com', limit: 100 }, historyPath);
    expect(records).toHaveLength(2);
  });

  it('should filter by afterDate', async () => {
    await appendTransaction(
      makeRecord({ timestamp: '2025-01-01T00:00:00.000Z', signature: 'old' }),
      historyPath,
    );
    await appendTransaction(
      makeRecord({ timestamp: '2026-01-01T00:00:00.000Z', signature: 'new' }),
      historyPath,
    );

    const records = await queryHistory({ afterDate: '2025-06-01T00:00:00.000Z', limit: 100 }, historyPath);
    expect(records).toHaveLength(1);
    expect(records[0].signature).toBe('new');
  });

  it('should sort newest first', async () => {
    await appendTransaction(
      makeRecord({ timestamp: '2026-01-01T00:00:00.000Z', signature: 'first' }),
      historyPath,
    );
    await appendTransaction(
      makeRecord({ timestamp: '2026-03-01T00:00:00.000Z', signature: 'third' }),
      historyPath,
    );
    await appendTransaction(
      makeRecord({ timestamp: '2026-02-01T00:00:00.000Z', signature: 'second' }),
      historyPath,
    );

    const records = await queryHistory({ limit: 100 }, historyPath);
    expect(records[0].signature).toBe('third');
    expect(records[1].signature).toBe('second');
    expect(records[2].signature).toBe('first');
  });

  it('should paginate with before cursor', async () => {
    await appendTransaction(makeRecord({ signature: 'sig-a', timestamp: '2026-01-01T00:00:00Z' }), historyPath);
    await appendTransaction(makeRecord({ signature: 'sig-b', timestamp: '2026-02-01T00:00:00Z' }), historyPath);
    await appendTransaction(makeRecord({ signature: 'sig-c', timestamp: '2026-03-01T00:00:00Z' }), historyPath);

    const records = await queryHistory({ before: 'sig-c', limit: 100 }, historyPath);
    expect(records).toHaveLength(2);
    // Should contain sig-a and sig-b (everything before sig-c)
    const sigs = records.map((r) => r.signature);
    expect(sigs).toContain('sig-a');
    expect(sigs).toContain('sig-b');
  });
});
