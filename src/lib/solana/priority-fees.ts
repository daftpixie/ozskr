/**
 * Helius Priority Fee Estimation
 * Dynamic priority fee estimation via Helius RPC
 * Uses @solana/kit address validation patterns
 */

import { z } from 'zod';
import { address } from '@solana/kit';
import type { Address } from '@solana/kit';

// =============================================================================
// CONSTANTS
// =============================================================================

const FALLBACK_PRIORITY_FEE = 50_000n; // 50k microlamports
const BASE_FEE_LAMPORTS = 5_000n; // 5k lamports base fee

// =============================================================================
// TYPES
// =============================================================================

export interface TransactionCostEstimate {
  baseFee: bigint; // 5000 lamports
  priorityFee: bigint; // estimated priority fee
  totalEstimate: bigint; // baseFee + priorityFee
  displayAmount: string; // human-readable SOL amount
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const HeliusPriorityFeeResponseSchema = z.object({
  jsonrpc: z.string(),
  id: z.union([z.string(), z.number()]),
  result: z.object({
    priorityFeeEstimate: z.number().optional(),
  }).optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
  }).optional(),
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

export class PriorityFeeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PriorityFeeError';
  }
}

// =============================================================================
// API CLIENT
// =============================================================================

/**
 * Get priority fee estimate from Helius RPC
 * Falls back to default fee if estimation fails
 * @param accountKeys Account keys involved in the transaction
 * @param rpcEndpoint Optional RPC endpoint (defaults to NEXT_PUBLIC_HELIUS_RPC_URL)
 * @returns Transaction cost estimate
 */
export async function getPriorityFeeEstimate(
  accountKeys: string[],
  rpcEndpoint?: string
): Promise<TransactionCostEstimate> {
  // Validate all account keys before making RPC call
  const validatedKeys: Address[] = [];
  for (const key of accountKeys) {
    try {
      validatedKeys.push(address(key));
    } catch (err) {
      throw new PriorityFeeError(
        `Invalid account key: ${key} - ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }

  // Get RPC endpoint
  const endpoint = rpcEndpoint || process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  if (!endpoint) {
    throw new PriorityFeeError('Missing NEXT_PUBLIC_HELIUS_RPC_URL environment variable');
  }

  let priorityFeeMicrolamports = FALLBACK_PRIORITY_FEE;

  try {
    const requestBody = {
      jsonrpc: '2.0',
      id: '1',
      method: 'getPriorityFeeEstimate',
      params: [
        {
          accountKeys: validatedKeys,
          options: { recommended: true },
        },
      ],
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn(`Helius priority fee estimation failed (HTTP ${response.status}), using fallback`);
    } else {
      const responseBody = await response.json();
      const parseResult = HeliusPriorityFeeResponseSchema.safeParse(responseBody);

      if (parseResult.success) {
        const data = parseResult.data;

        if (data.error) {
          console.warn(
            `Helius priority fee estimation error: ${data.error.message}, using fallback`
          );
        } else if (data.result?.priorityFeeEstimate !== undefined) {
          // Convert to bigint (microlamports)
          priorityFeeMicrolamports = BigInt(Math.ceil(data.result.priorityFeeEstimate));
        } else {
          console.warn('No priority fee estimate in response, using fallback');
        }
      } else {
        console.warn(
          `Invalid Helius response format: ${parseResult.error.message}, using fallback`
        );
      }
    }
  } catch (err) {
    console.warn(
      `Priority fee estimation failed: ${err instanceof Error ? err.message : 'Unknown error'}, using fallback`
    );
  }

  // Convert microlamports to lamports (1 lamport = 1,000,000 microlamports)
  const priorityFeeLamports = priorityFeeMicrolamports / 1_000_000n;

  const totalEstimate = BASE_FEE_LAMPORTS + priorityFeeLamports;
  const displayAmount = formatLamportsToSol(totalEstimate);

  return {
    baseFee: BASE_FEE_LAMPORTS,
    priorityFee: priorityFeeLamports,
    totalEstimate,
    displayAmount,
  };
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Format lamports to human-readable SOL amount
 * NO floating point math — uses string manipulation
 * @param lamports Amount in lamports (bigint)
 * @returns Formatted SOL amount (e.g., "0.005")
 */
export function formatLamportsToSol(lamports: bigint): string {
  if (lamports === 0n) {
    return '0';
  }

  const isNegative = lamports < 0n;
  const absLamports = isNegative ? -lamports : lamports;

  // Convert to string and pad with zeros
  const lamportsStr = absLamports.toString();
  const decimals = 9; // SOL has 9 decimals

  if (lamportsStr.length <= decimals) {
    // Amount is less than 1 SOL
    const paddedStr = lamportsStr.padStart(decimals, '0');
    const result = `0.${paddedStr}`;
    // Remove trailing zeros
    const trimmed = result.replace(/\.?0+$/, '');
    return isNegative ? `-${trimmed}` : trimmed;
  }

  // Amount is 1 SOL or more
  const integerPart = lamportsStr.slice(0, -decimals);
  const decimalPart = lamportsStr.slice(-decimals);

  // Remove trailing zeros from decimal part
  const trimmedDecimalPart = decimalPart.replace(/0+$/, '');

  if (trimmedDecimalPart === '') {
    return isNegative ? `-${integerPart}` : integerPart;
  }

  const result = `${integerPart}.${trimmedDecimalPart}`;
  return isNegative ? `-${result}` : result;
}
