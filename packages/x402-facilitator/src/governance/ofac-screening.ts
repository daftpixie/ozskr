// ---------------------------------------------------------------------------
// OFAC SDN Screening
// ---------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';

export interface OfacScreeningResult {
  status: 'pass' | 'fail' | 'error' | 'skip';
  matchedAddress?: string;
  matchedList?: string;
  screenedAddresses: string[];
  errorDetail?: string;
}

export interface OfacScreener {
  screen(addresses: string[]): Promise<OfacScreeningResult>;
  updateList(path: string): Promise<void>;
  lastUpdated(): Date | null;
  listSize(): number;
}

/**
 * Creates an OFAC screener that checks addresses against a static SDN blocklist.
 *
 * The blocklist is a JSON file containing an array of base58 Solana addresses.
 * For MVP, this is a curated subset of known sanctioned blockchain addresses.
 *
 * @param initialBlocklistPath - Path to JSON blocklist file (optional, can load later)
 * @param failClosed - If true (default), unavailable list blocks settlement
 */
export async function createOfacScreener(
  initialBlocklistPath?: string,
  failClosed = true,
): Promise<OfacScreener> {
  const blocklist = new Set<string>();
  let lastUpdate: Date | null = null;

  async function loadList(path: string): Promise<void> {
    const content = await readFile(path, 'utf-8');
    const addresses: unknown = JSON.parse(content);
    if (!Array.isArray(addresses)) {
      throw new Error('OFAC blocklist must be a JSON array of addresses');
    }
    blocklist.clear();
    for (const addr of addresses) {
      if (typeof addr === 'string' && addr.length > 0) {
        blocklist.add(addr);
      }
    }
    lastUpdate = new Date();
  }

  // Load initial list if provided
  if (initialBlocklistPath) {
    try {
      await loadList(initialBlocklistPath);
    } catch (error) {
      if (failClosed) {
        throw new Error(
          `OFAC fail-closed: cannot load blocklist from ${initialBlocklistPath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      // fail-open: continue without list, log warning
    }
  }

  return {
    async screen(addresses: string[]): Promise<OfacScreeningResult> {
      if (blocklist.size === 0 && !lastUpdate) {
        // List was never loaded
        if (failClosed) {
          return {
            status: 'error',
            screenedAddresses: addresses,
            errorDetail: 'OFAC blocklist not loaded (fail-closed mode)',
          };
        }
        return {
          status: 'skip',
          screenedAddresses: addresses,
          errorDetail: 'OFAC blocklist not loaded (fail-open mode)',
        };
      }

      for (const addr of addresses) {
        if (blocklist.has(addr)) {
          return {
            status: 'fail',
            matchedAddress: addr,
            matchedList: 'SDN',
            screenedAddresses: addresses,
          };
        }
      }

      return {
        status: 'pass',
        screenedAddresses: addresses,
      };
    },

    async updateList(path: string): Promise<void> {
      await loadList(path);
    },

    lastUpdated(): Date | null {
      return lastUpdate;
    },

    listSize(): number {
      return blocklist.size;
    },
  };
}
