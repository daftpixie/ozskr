// ---------------------------------------------------------------------------
// OFAC SDN Screening
// ---------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';

/**
 * Pluggable screening provider interface.
 *
 * The facilitator accepts any implementation of this interface for address screening.
 * The default implementation (StaticSdnScreener) uses a local SDN blocklist file.
 *
 * Production operators SHOULD supplement with a real-time blockchain analytics service
 * (Chainalysis, Elliptic, or TRM Labs) by implementing this interface.
 *
 * OFAC operates under strict liability — no intent is required for violations.
 * Consult legal counsel for your compliance obligations.
 */
export interface ScreeningProvider {
  /** Screen an address. Returns screening result. */
  screenAddress(address: string): Promise<ScreeningResult>;
  /** Provider identifier for audit logging */
  providerName: string;
  /** When the screening data was last refreshed */
  lastRefreshed: Date;
}

export interface ScreeningResult {
  blocked: boolean;
  reason?: string;
  matchType?: 'exact' | 'fuzzy';
  source: string;  // 'static-sdn' | 'chainalysis' | 'trm-labs' | 'elliptic'
  checkedAt: Date;
}

export interface OfacScreeningResult {
  status: 'pass' | 'fail' | 'error' | 'skip';
  matchedAddress?: string;
  matchedList?: string;
  screenedAddresses: string[];
  errorDetail?: string;
}

export interface OfacScreener extends ScreeningProvider {
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

  // Define screen function to be reused by both interfaces
  async function screen(addresses: string[]): Promise<OfacScreeningResult> {
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
  }

  return {
    screen,

    async updateList(path: string): Promise<void> {
      await loadList(path);
    },

    lastUpdated(): Date | null {
      return lastUpdate;
    },

    listSize(): number {
      return blocklist.size;
    },

    // ScreeningProvider interface implementation
    async screenAddress(address: string): Promise<ScreeningResult> {
      const result = await screen([address]);

      return {
        blocked: result.status === 'fail',
        reason: result.status === 'fail'
          ? `Address matched ${result.matchedList} blocklist`
          : result.errorDetail,
        matchType: result.status === 'fail' ? 'exact' : undefined,
        source: 'static-sdn',
        checkedAt: new Date(),
      };
    },

    providerName: 'static-sdn',

    get lastRefreshed(): Date {
      return lastUpdate ?? new Date(0);
    },
  };
}
