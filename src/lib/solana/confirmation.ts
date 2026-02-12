/**
 * Transaction Confirmation Poller
 * Polls Solana RPC for transaction confirmation with exponential backoff
 * Uses @solana/kit patterns
 */

import { z } from 'zod';

// =============================================================================
// TYPES
// =============================================================================

export interface ConfirmationResult {
  status: 'confirmed' | 'failed' | 'timed_out';
  signature: string;
  slot?: number;
  error?: string;
  confirmationTimeMs: number;
}

export interface PollOptions {
  timeoutMs?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const SignatureStatusSchema = z.object({
  slot: z.number(),
  confirmations: z.union([z.number(), z.null()]),
  err: z.union([z.null(), z.unknown()]),
  confirmationStatus: z
    .enum(['processed', 'confirmed', 'finalized'])
    .optional(),
});

const SignatureStatusesResponseSchema = z.object({
  jsonrpc: z.string(),
  id: z.union([z.string(), z.number()]),
  result: z.object({
    context: z.object({
      slot: z.number(),
    }),
    value: z.array(z.union([SignatureStatusSchema, z.null()])),
  }).optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
  }).optional(),
});

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds
const DEFAULT_INITIAL_DELAY_MS = 500; // 500ms
const DEFAULT_MAX_DELAY_MS = 4_000; // 4 seconds

// =============================================================================
// CONFIRMATION POLLER
// =============================================================================

/**
 * Poll RPC for transaction confirmation with exponential backoff
 * @param signature Transaction signature
 * @param rpcEndpoint Solana RPC endpoint URL
 * @param options Polling options
 * @returns Confirmation result
 */
export async function pollTransactionConfirmation(
  signature: string,
  rpcEndpoint: string,
  options?: PollOptions
): Promise<ConfirmationResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const initialDelayMs = options?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  const startTime = Date.now();
  let currentDelay = initialDelayMs;

  while (true) {
    const elapsed = Date.now() - startTime;

    // Check timeout
    if (elapsed >= timeoutMs) {
      return {
        status: 'timed_out',
        signature,
        error: `Transaction confirmation timed out after ${timeoutMs}ms`,
        confirmationTimeMs: elapsed,
      };
    }

    try {
      // Poll signature status
      const status = await getSignatureStatus(signature, rpcEndpoint);

      if (status) {
        // Transaction found
        if (status.err) {
          // Transaction failed
          return {
            status: 'failed',
            signature,
            slot: status.slot,
            error: parseTransactionError(status.err),
            confirmationTimeMs: elapsed,
          };
        }

        // Check confirmation status
        if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
          // Transaction confirmed
          return {
            status: 'confirmed',
            signature,
            slot: status.slot,
            confirmationTimeMs: elapsed,
          };
        }
      }

      // Not confirmed yet — wait before next poll
      await sleep(currentDelay);

      // Exponential backoff (2x increase, capped at maxDelayMs)
      currentDelay = Math.min(currentDelay * 2, maxDelayMs);
    } catch {
      // Network error or RPC error — retry after current delay
      await sleep(currentDelay);
      currentDelay = Math.min(currentDelay * 2, maxDelayMs);
    }
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get signature status from RPC
 * @param signature Transaction signature
 * @param rpcEndpoint Solana RPC endpoint URL
 * @returns Signature status or null if not found
 */
async function getSignatureStatus(
  signature: string,
  rpcEndpoint: string
): Promise<z.infer<typeof SignatureStatusSchema> | null> {
  const requestBody = {
    jsonrpc: '2.0',
    id: '1',
    method: 'getSignatureStatuses',
    params: [[signature], { searchTransactionHistory: true }],
  };

  const response = await fetch(rpcEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`RPC request failed (HTTP ${response.status})`);
  }

  const responseBody = await response.json();
  const parseResult = SignatureStatusesResponseSchema.safeParse(responseBody);

  if (!parseResult.success) {
    throw new Error(`Invalid RPC response: ${parseResult.error.message}`);
  }

  const data = parseResult.data;

  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }

  if (!data.result) {
    throw new Error('No result in RPC response');
  }

  // Get first status (we only requested one signature)
  const status = data.result.value[0];

  return status;
}

/**
 * Parse transaction error into user-friendly message
 * @param err Error object from signature status
 * @returns User-friendly error message
 */
function parseTransactionError(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    if ('InstructionError' in err) {
      // Narrowed via `in` check — Solana RPC error shape: { InstructionError: [index, errorKind] }
      const instructionError = (err as Record<string, unknown>)['InstructionError'];
      if (Array.isArray(instructionError) && instructionError.length >= 2) {
        return `Transaction failed at instruction ${instructionError[0]}: ${JSON.stringify(instructionError[1])}`;
      }
    }

    // Try to stringify the error
    try {
      return `Transaction failed: ${JSON.stringify(err)}`;
    } catch {
      return 'Transaction failed with unknown error';
    }
  }

  return 'Transaction failed';
}

/**
 * Sleep for specified milliseconds
 * @param ms Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
