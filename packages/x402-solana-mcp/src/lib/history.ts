import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single transaction record in the history log. */
export interface TransactionRecord {
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** On-chain transaction signature. */
  signature: string;
  /** Target URL that was paid for. */
  url: string;
  /** Amount paid in base units. */
  amount: string;
  /** Token mint/asset address. */
  asset: string;
  /** Recipient address. */
  payTo: string;
  /** Network (CAIP-2 format). */
  network: string;
  /** Which facilitator settled the payment. */
  facilitator: string;
  /** HTTP method used. */
  method: string;
}

/** Query filters for transaction history. */
export interface HistoryQuery {
  limit?: number;
  before?: string;
  afterDate?: string;
  url?: string;
}

// ---------------------------------------------------------------------------
// History Log
// ---------------------------------------------------------------------------

const DEFAULT_HISTORY_PATH = '.x402-history.json';

/**
 * Appends a transaction record to the history log file.
 * Creates the file and parent directories if they don't exist.
 */
export async function appendTransaction(
  record: TransactionRecord,
  historyPath: string = DEFAULT_HISTORY_PATH,
): Promise<void> {
  const records = await loadHistory(historyPath);
  records.push(record);
  await mkdir(dirname(historyPath), { recursive: true });
  await writeFile(historyPath, JSON.stringify(records, null, 2), { mode: 0o600 });
  // Ensure permissions on existing files (writeFile mode only applies on creation)
  await chmod(historyPath, 0o600);
}

/**
 * Queries transaction history with optional filters.
 */
export async function queryHistory(
  query: HistoryQuery = {},
  historyPath: string = DEFAULT_HISTORY_PATH,
): Promise<TransactionRecord[]> {
  let records = await loadHistory(historyPath);

  // Filter by URL
  if (query.url) {
    const urlFilter = query.url;
    records = records.filter((r) => r.url.includes(urlFilter));
  }

  // Filter by date (after)
  if (query.afterDate) {
    const afterDate = query.afterDate;
    records = records.filter((r) => r.timestamp >= afterDate);
  }

  // Filter: before cursor (find the record with matching signature, return everything before it)
  if (query.before) {
    const beforeSig = query.before;
    const idx = records.findIndex((r) => r.signature === beforeSig);
    if (idx > 0) {
      records = records.slice(0, idx);
    }
  }

  // Sort newest first
  records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Apply limit
  const limit = query.limit ?? 10;
  return records.slice(0, limit);
}

/**
 * Loads the full history from disk. Returns empty array if file doesn't exist.
 */
async function loadHistory(historyPath: string): Promise<TransactionRecord[]> {
  try {
    const content = await readFile(historyPath, 'utf-8');
    return JSON.parse(content) as TransactionRecord[];
  } catch {
    return [];
  }
}
