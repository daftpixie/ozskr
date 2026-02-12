/**
 * Jupiter Ultra API Client
 * Handles swap quote fetching from Jupiter Ultra v1
 * Uses @solana/kit address validation patterns
 */

import { z } from 'zod';
import { address } from '@solana/kit';
import type { Address } from '@solana/kit';

// =============================================================================
// CONSTANTS
// =============================================================================

const JUPITER_API_URL = 'https://lite.jup.ag/ultra/v1/order';

// =============================================================================
// TYPES
// =============================================================================

export interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string; // stringified bigint
  slippageBps?: number; // default 50
  taker: string; // wallet address
}

export interface JupiterQuoteResult {
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  priceImpact: string;
  orderData: unknown; // opaque order data for execution
  transaction: string; // base64-encoded transaction
  expiresAt: string;
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const JupiterQuoteResponseSchema = z.object({
  inputMint: z.string(),
  outputMint: z.string(),
  inputAmount: z.string(),
  outputAmount: z.string(),
  priceImpact: z.string(),
  orderData: z.unknown(),
  transaction: z.string(),
  expiresAt: z.string().optional().default(() => {
    // Default expiry: 60 seconds from now
    return new Date(Date.now() + 60_000).toISOString();
  }),
});

const JupiterErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  message: z.string().optional(),
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

export enum JupiterErrorCode {
  NO_ROUTE = 'NO_ROUTE',
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_PAIR = 'INVALID_PAIR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export class JupiterError extends Error {
  constructor(
    public code: JupiterErrorCode,
    message: string,
    public retryAfterMs?: number
  ) {
    super(message);
    this.name = 'JupiterError';
  }
}

// =============================================================================
// API CLIENT
// =============================================================================

/**
 * Get a swap quote from Jupiter Ultra API
 * @throws {JupiterError} If quote request fails
 */
export async function getQuote(params: JupiterQuoteParams): Promise<JupiterQuoteResult> {
  // Validate addresses before making API call
  let inputMintAddr: Address;
  let outputMintAddr: Address;
  let takerAddr: Address;

  try {
    inputMintAddr = address(params.inputMint);
    outputMintAddr = address(params.outputMint);
    takerAddr = address(params.taker);
  } catch (err) {
    throw new JupiterError(
      JupiterErrorCode.VALIDATION_ERROR,
      `Invalid address: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }

  // Validate amount is a valid bigint string
  if (!/^\d+$/.test(params.amount)) {
    throw new JupiterError(
      JupiterErrorCode.VALIDATION_ERROR,
      'Amount must be a stringified bigint (e.g., "1000000")'
    );
  }

  // Validate slippage is within acceptable range
  const slippageBps = params.slippageBps ?? 50;
  if (slippageBps < 1 || slippageBps > 300) {
    throw new JupiterError(
      JupiterErrorCode.VALIDATION_ERROR,
      'Slippage must be between 1 and 300 bps (0.01%-3%)'
    );
  }

  const requestBody = {
    inputMint: inputMintAddr,
    outputMint: outputMintAddr,
    amount: params.amount,
    slippageBps,
    taker: takerAddr,
  };

  let response: Response;
  try {
    response = await fetch(JUPITER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    throw new JupiterError(
      JupiterErrorCode.NETWORK_ERROR,
      `Network request failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }

  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60_000;
    throw new JupiterError(
      JupiterErrorCode.RATE_LIMITED,
      `Rate limited. Retry after ${retryAfterMs}ms`,
      retryAfterMs
    );
  }

  // Parse response body
  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch (err) {
    throw new JupiterError(
      JupiterErrorCode.UNKNOWN,
      `Failed to parse response: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }

  // Handle error responses
  if (!response.ok) {
    const errorResult = JupiterErrorResponseSchema.safeParse(responseBody);
    if (errorResult.success) {
      const errorData = errorResult.data;
      const errorMessage = errorData.message || errorData.error;

      // Detect specific error types
      if (errorMessage.toLowerCase().includes('no route')) {
        throw new JupiterError(
          JupiterErrorCode.NO_ROUTE,
          `No swap route available for ${params.inputMint} → ${params.outputMint}`
        );
      }

      if (errorMessage.toLowerCase().includes('invalid') || errorMessage.toLowerCase().includes('unsupported')) {
        throw new JupiterError(
          JupiterErrorCode.INVALID_PAIR,
          `Invalid token pair: ${errorMessage}`
        );
      }

      throw new JupiterError(JupiterErrorCode.UNKNOWN, errorMessage);
    }

    throw new JupiterError(
      JupiterErrorCode.UNKNOWN,
      `Jupiter API error (HTTP ${response.status})`
    );
  }

  // Validate success response
  const parseResult = JupiterQuoteResponseSchema.safeParse(responseBody);
  if (!parseResult.success) {
    throw new JupiterError(
      JupiterErrorCode.VALIDATION_ERROR,
      `Invalid response from Jupiter API: ${parseResult.error.message}`
    );
  }

  return parseResult.data;
}
