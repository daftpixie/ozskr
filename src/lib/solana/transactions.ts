/**
 * Transaction Builder for Swaps
 * Combines Jupiter Ultra quotes, priority fees, and simulation
 * Uses @solana/kit for all transaction operations
 */

import { z } from 'zod';
import { address } from '@solana/kit';
import { getQuote, JupiterError } from './jupiter';
import type { JupiterQuoteParams, JupiterQuoteResult } from './jupiter';
import { getPriorityFeeEstimate } from './priority-fees';
import type { TransactionCostEstimate } from './priority-fees';

// =============================================================================
// TYPES
// =============================================================================

export interface PreparedSwapTransaction {
  transaction: Uint8Array; // serialized transaction ready for signing
  simulationResult: SimulationResult;
  costEstimate: TransactionCostEstimate;
  expiresAt: string;
}

export interface SimulationResult {
  success: boolean;
  unitsConsumed: number;
  logs: string[];
  error?: string;
}

export interface PrepareSwapParams {
  inputMint: string;
  outputMint: string;
  amount: string; // stringified bigint
  slippageBps?: number;
  taker: string; // wallet address
  rpcEndpoint?: string;
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const SimulationResponseSchema = z.object({
  jsonrpc: z.string(),
  id: z.union([z.string(), z.number()]),
  result: z.object({
    value: z.object({
      err: z.union([z.null(), z.unknown()]),
      logs: z.array(z.string()).optional(),
      unitsConsumed: z.number().optional(),
    }),
  }).optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
  }).optional(),
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

export class SwapError extends Error {
  constructor(
    message: string,
    public code: string = 'SWAP_ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = 'SwapError';
  }
}

// =============================================================================
// TRANSACTION BUILDING
// =============================================================================

/**
 * Build swap transaction from Jupiter Ultra quote
 * Decodes base64 transaction into Uint8Array ready for signing
 * @param quoteResult Jupiter Ultra quote result
 * @returns Serialized transaction bytes
 * @throws {SwapError} If transaction decoding fails
 */
export function buildSwapTransaction(quoteResult: JupiterQuoteResult): Uint8Array {
  try {
    // Decode base64 transaction
    const transactionBuffer = Buffer.from(quoteResult.transaction, 'base64');
    return new Uint8Array(transactionBuffer);
  } catch (err) {
    throw new SwapError(
      'Failed to decode transaction from Jupiter quote',
      'TRANSACTION_DECODE_ERROR',
      err
    );
  }
}

// =============================================================================
// TRANSACTION SIMULATION
// =============================================================================

/**
 * Simulate transaction before execution
 * MUST succeed before any execution proceeds
 * @param transaction Serialized transaction bytes
 * @param rpcEndpoint Solana RPC endpoint URL
 * @returns Simulation result with logs and compute units
 * @throws {SwapError} If simulation fails
 */
export async function simulateTransaction(
  transaction: Uint8Array,
  rpcEndpoint: string
): Promise<SimulationResult> {
  try {
    // Encode transaction to base64 for RPC call
    const transactionBase64 = Buffer.from(transaction).toString('base64');

    const requestBody = {
      jsonrpc: '2.0',
      id: '1',
      method: 'simulateTransaction',
      params: [
        transactionBase64,
        {
          encoding: 'base64',
          commitment: 'processed',
        },
      ],
    };

    const response = await fetch(rpcEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new SwapError(
        `Simulation RPC request failed (HTTP ${response.status})`,
        'SIMULATION_RPC_ERROR'
      );
    }

    const responseBody = await response.json();
    const parseResult = SimulationResponseSchema.safeParse(responseBody);

    if (!parseResult.success) {
      throw new SwapError(
        `Invalid simulation response: ${parseResult.error.message}`,
        'SIMULATION_PARSE_ERROR'
      );
    }

    const data = parseResult.data;

    if (data.error) {
      throw new SwapError(
        `Simulation RPC error: ${data.error.message}`,
        'SIMULATION_RPC_ERROR',
        data.error
      );
    }

    if (!data.result) {
      throw new SwapError(
        'No simulation result in response',
        'SIMULATION_NO_RESULT'
      );
    }

    const simulationValue = data.result.value;
    const hasError = simulationValue.err !== null;
    const logs = simulationValue.logs || [];
    const unitsConsumed = simulationValue.unitsConsumed || 0;

    if (hasError) {
      // Parse error from logs or err object
      const errorMessage = parseSimulationError(simulationValue.err, logs);
      return {
        success: false,
        unitsConsumed,
        logs,
        error: errorMessage,
      };
    }

    return {
      success: true,
      unitsConsumed,
      logs,
    };
  } catch (err) {
    if (err instanceof SwapError) {
      throw err;
    }
    throw new SwapError(
      `Transaction simulation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      'SIMULATION_ERROR',
      err
    );
  }
}

/**
 * Parse simulation error into user-friendly message
 * @param err Error object from simulation
 * @param logs Transaction logs
 * @returns User-friendly error message
 */
function parseSimulationError(err: unknown, logs: string[]): string {
  // Check common error patterns in logs
  const combinedLogs = logs.join(' ');

  if (combinedLogs.includes('insufficient funds')) {
    return 'Insufficient funds to complete this swap';
  }

  if (combinedLogs.includes('slippage tolerance exceeded')) {
    return 'Price moved beyond slippage tolerance. Try increasing slippage or refreshing quote';
  }

  if (combinedLogs.includes('invalid account')) {
    return 'Invalid token account. The token may not be supported';
  }

  if (combinedLogs.includes('custom program error')) {
    const match = combinedLogs.match(/custom program error: (0x[0-9a-f]+)/i);
    if (match) {
      return `Program error: ${match[1]}`;
    }
  }

  // Try to extract meaningful error from err object
  if (typeof err === 'object' && err !== null) {
    if ('InstructionError' in err) {
      // Solana RPC error shape: { InstructionError: [index, errorKind] }
      const instructionError = (err as { InstructionError: unknown[] }).InstructionError;
      if (Array.isArray(instructionError) && instructionError.length >= 2) {
        return `Transaction failed at instruction ${instructionError[0]}: ${JSON.stringify(instructionError[1])}`;
      }
    }
  }

  // Fallback to generic error
  return 'Transaction simulation failed. Please check your inputs and try again';
}

// =============================================================================
// FULL SWAP PREPARATION
// =============================================================================

/**
 * Prepare a swap transaction for wallet signing
 * Full flow: quote → build → simulate → estimate fees
 * DOES NOT sign server-side — returns unsigned transaction
 * @param params Swap parameters
 * @returns Prepared transaction ready for wallet signing
 * @throws {SwapError} If any step fails
 * @throws {JupiterError} If quote fails
 */
export async function prepareSwap(
  params: PrepareSwapParams
): Promise<PreparedSwapTransaction> {
  // Validate addresses
  try {
    address(params.inputMint);
    address(params.outputMint);
    address(params.taker);
  } catch (err) {
    throw new SwapError(
      `Invalid address: ${err instanceof Error ? err.message : 'Unknown error'}`,
      'INVALID_ADDRESS'
    );
  }

  // Get RPC endpoint
  const rpcEndpoint = params.rpcEndpoint || process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  if (!rpcEndpoint) {
    throw new SwapError(
      'Missing NEXT_PUBLIC_HELIUS_RPC_URL environment variable',
      'MISSING_RPC_ENDPOINT'
    );
  }

  // Step 1: Fetch quote from Jupiter Ultra
  let quoteResult: JupiterQuoteResult;
  try {
    const quoteParams: JupiterQuoteParams = {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      slippageBps: params.slippageBps,
      taker: params.taker,
    };
    quoteResult = await getQuote(quoteParams);
  } catch (err) {
    if (err instanceof JupiterError) {
      // Re-throw Jupiter errors with additional context
      throw new SwapError(
        `Failed to get swap quote: ${err.message}`,
        'QUOTE_ERROR',
        { jupiterError: err.code }
      );
    }
    throw err;
  }

  // Step 2: Build transaction from quote
  let transaction: Uint8Array;
  try {
    transaction = buildSwapTransaction(quoteResult);
  } catch (err) {
    if (err instanceof SwapError) {
      throw err;
    }
    throw new SwapError(
      `Failed to build transaction: ${err instanceof Error ? err.message : 'Unknown error'}`,
      'BUILD_ERROR',
      err
    );
  }

  // Step 3: Simulate transaction (MUST pass)
  let simulationResult: SimulationResult;
  try {
    simulationResult = await simulateTransaction(transaction, rpcEndpoint);
  } catch (err) {
    if (err instanceof SwapError) {
      throw err;
    }
    throw new SwapError(
      `Transaction simulation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      'SIMULATION_ERROR',
      err
    );
  }

  if (!simulationResult.success) {
    throw new SwapError(
      simulationResult.error || 'Transaction simulation failed',
      'SIMULATION_FAILED',
      { logs: simulationResult.logs }
    );
  }

  // Step 4: Estimate priority fee
  let costEstimate: TransactionCostEstimate;
  try {
    // Extract relevant account keys from quote for fee estimation
    const accountKeys = [params.inputMint, params.outputMint, params.taker];
    costEstimate = await getPriorityFeeEstimate(accountKeys, rpcEndpoint);
  } catch (err) {
    throw new SwapError(
      `Failed to estimate priority fee: ${err instanceof Error ? err.message : 'Unknown error'}`,
      'FEE_ESTIMATION_ERROR',
      err
    );
  }

  // Return prepared transaction (unsigned)
  return {
    transaction,
    simulationResult,
    costEstimate,
    expiresAt: quoteResult.expiresAt,
  };
}
