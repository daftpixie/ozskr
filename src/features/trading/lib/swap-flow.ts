/**
 * Swap Flow Orchestrator
 * Full end-to-end swap execution flow for the frontend
 * Coordinates quote, simulation, signing, submission, confirmation, and recording
 */

import { z } from 'zod';
import { address } from '@solana/kit';
import { getQuote, JupiterError } from '@/lib/solana/jupiter';
import type { JupiterQuoteResult, JupiterQuoteParams } from '@/lib/solana/jupiter';
import { buildSwapTransaction, simulateTransaction } from '@/lib/solana/transactions';
import type { SimulationResult } from '@/lib/solana/transactions';
import { getPriorityFeeEstimate } from '@/lib/solana/priority-fees';
import type { TransactionCostEstimate } from '@/lib/solana/priority-fees';
import { pollTransactionConfirmation } from '@/lib/solana/confirmation';
import type { ConfirmationResult } from '@/lib/solana/confirmation';
import { getTokenByMint } from '@/lib/solana/token-list';
import type { TokenInfo } from '@/lib/solana/token-list';
import { formatTokenAmount } from '@/lib/solana/tokens';

// =============================================================================
// TYPES
// =============================================================================

export interface QuotePreview {
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  inputAmount: string; // formatted display
  outputAmount: string; // formatted display
  exchangeRate: string; // "1 SOL = X USDC"
  priceImpact: string;
  minimumReceived: string; // after slippage
  networkFee: TransactionCostEstimate;
  expiresAt: string;
  rawQuote: JupiterQuoteResult; // for execution
}

export interface SwapResult {
  success: boolean;
  transactionSignature?: string;
  explorerUrl?: string;
  error?: string;
  swapId?: string;
}

export type SwapStage =
  | 'validating'
  | 'quoting'
  | 'previewing'
  | 'simulating'
  | 'signing'
  | 'submitting'
  | 'confirming'
  | 'recording'
  | 'complete'
  | 'error';

export type SwapProgressCallback = (stage: SwapStage, message: string) => void;

export interface WalletSignerAdapter {
  signTransaction: (transaction: Uint8Array) => Promise<Uint8Array>;
  publicKey: string;
}

export interface GetSwapQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string; // stringified bigint
  slippageBps: number;
  taker: string; // wallet address
}

export interface ExecuteSwapParams {
  quote: QuotePreview;
  walletAdapter: WalletSignerAdapter;
  onProgress?: SwapProgressCallback;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SOLSCAN_EXPLORER_URL = 'https://solscan.io/tx';

// =============================================================================
// ERROR HANDLING
// =============================================================================

export class SwapFlowError extends Error {
  constructor(
    message: string,
    public code: string = 'SWAP_FLOW_ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = 'SwapFlowError';
  }
}

// =============================================================================
// QUOTE PREVIEW
// =============================================================================

/**
 * Get swap quote and build preview for user
 * @param params Quote parameters
 * @returns Quote preview with all display data
 * @throws {SwapFlowError} If quote fails
 */
export async function getSwapQuote(params: GetSwapQuoteParams): Promise<QuotePreview> {
  // Validate addresses
  try {
    address(params.inputMint);
    address(params.outputMint);
    address(params.taker);
  } catch (err) {
    throw new SwapFlowError(
      `Invalid address: ${err instanceof Error ? err.message : 'Unknown error'}`,
      'INVALID_ADDRESS'
    );
  }

  // Get token info
  const inputToken = getTokenByMint(params.inputMint);
  const outputToken = getTokenByMint(params.outputMint);

  if (!inputToken) {
    throw new SwapFlowError(
      `Unknown input token: ${params.inputMint}`,
      'UNKNOWN_TOKEN'
    );
  }

  if (!outputToken) {
    throw new SwapFlowError(
      `Unknown output token: ${params.outputMint}`,
      'UNKNOWN_TOKEN'
    );
  }

  // Fetch quote from Jupiter Ultra
  let quote: JupiterQuoteResult;
  try {
    const quoteParams: JupiterQuoteParams = {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      amount: params.amount,
      slippageBps: params.slippageBps,
      taker: params.taker,
    };
    quote = await getQuote(quoteParams);
  } catch (err) {
    if (err instanceof JupiterError) {
      throw new SwapFlowError(
        err.message,
        'QUOTE_ERROR',
        { jupiterCode: err.code }
      );
    }
    throw new SwapFlowError(
      `Failed to get quote: ${err instanceof Error ? err.message : 'Unknown error'}`,
      'QUOTE_ERROR',
      err
    );
  }

  // Get RPC endpoint
  const rpcEndpoint = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  if (!rpcEndpoint) {
    throw new SwapFlowError(
      'Missing NEXT_PUBLIC_HELIUS_RPC_URL environment variable',
      'MISSING_RPC_ENDPOINT'
    );
  }

  // Estimate network fees
  let networkFee: TransactionCostEstimate;
  try {
    const accountKeys = [params.inputMint, params.outputMint, params.taker];
    networkFee = await getPriorityFeeEstimate(accountKeys, rpcEndpoint);
  } catch (err) {
    throw new SwapFlowError(
      `Failed to estimate network fee: ${err instanceof Error ? err.message : 'Unknown error'}`,
      'FEE_ESTIMATION_ERROR',
      err
    );
  }

  // Format amounts for display
  const inputAmountRaw = BigInt(quote.inputAmount);
  const outputAmountRaw = BigInt(quote.outputAmount);
  const inputAmount = formatTokenAmount(inputAmountRaw, inputToken.decimals);
  const outputAmount = formatTokenAmount(outputAmountRaw, outputToken.decimals);

  // Calculate exchange rate using BigInt — multiply output by 10^6 for 6 decimal precision
  const RATE_PRECISION = 1_000_000n;
  const exchangeRateScaled = inputAmountRaw > 0n
    ? (outputAmountRaw * RATE_PRECISION) / inputAmountRaw
    : 0n;
  const exchangeRateStr = formatTokenAmount(exchangeRateScaled, 6);
  const exchangeRate = `1 ${inputToken.symbol} = ${exchangeRateStr} ${outputToken.symbol}`;

  // Price impact — already a string from Jupiter, just format for display
  const priceImpact = quote.priceImpact;

  // Calculate minimum received after slippage using BigInt
  // minimumReceived = outputAmount * (10000 - slippageBps) / 10000
  const slippageBps = BigInt(params.slippageBps);
  const minimumReceivedRaw = (outputAmountRaw * (10_000n - slippageBps)) / 10_000n;
  const minimumReceived = `${formatTokenAmount(minimumReceivedRaw, outputToken.decimals)} ${outputToken.symbol}`;

  return {
    inputToken,
    outputToken,
    inputAmount,
    outputAmount,
    exchangeRate,
    priceImpact,
    minimumReceived,
    networkFee,
    expiresAt: quote.expiresAt,
    rawQuote: quote,
  };
}

// =============================================================================
// SWAP EXECUTION
// =============================================================================

/**
 * Execute swap with full orchestration flow
 * @param params Execution parameters
 * @returns Swap result with transaction signature and explorer URL
 * @throws {SwapFlowError} If execution fails
 */
export async function executeSwap(params: ExecuteSwapParams): Promise<SwapResult> {
  const { quote, walletAdapter, onProgress } = params;

  // Get RPC endpoint
  const rpcEndpoint = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  if (!rpcEndpoint) {
    throw new SwapFlowError(
      'Missing NEXT_PUBLIC_HELIUS_RPC_URL environment variable',
      'MISSING_RPC_ENDPOINT'
    );
  }

  try {
    // Step 1: Build transaction from quote
    onProgress?.('validating', 'Building swap transaction...');
    let transaction: Uint8Array;
    try {
      transaction = buildSwapTransaction(quote.rawQuote);
    } catch (err) {
      onProgress?.('error', 'Failed to build transaction');
      throw new SwapFlowError(
        `Failed to build transaction: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'BUILD_ERROR',
        err
      );
    }

    // Step 2: Simulate transaction (ABORT if fails)
    onProgress?.('simulating', 'Simulating transaction...');
    let simulationResult: SimulationResult;
    try {
      simulationResult = await simulateTransaction(transaction, rpcEndpoint);
    } catch (err) {
      onProgress?.('error', 'Simulation failed');
      throw new SwapFlowError(
        `Simulation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'SIMULATION_ERROR',
        err
      );
    }

    if (!simulationResult.success) {
      onProgress?.('error', simulationResult.error || 'Simulation failed');
      throw new SwapFlowError(
        simulationResult.error || 'Transaction simulation failed',
        'SIMULATION_FAILED',
        { logs: simulationResult.logs }
      );
    }

    // Step 3: Sign transaction via wallet adapter (client-side)
    onProgress?.('signing', 'Waiting for wallet signature...');
    let signedTransaction: Uint8Array;
    try {
      signedTransaction = await walletAdapter.signTransaction(transaction);
    } catch (err) {
      onProgress?.('error', 'User rejected signature');
      throw new SwapFlowError(
        'User rejected transaction signature',
        'USER_REJECTED',
        err
      );
    }

    // Step 4: Submit signed transaction to RPC
    onProgress?.('submitting', 'Submitting transaction...');
    let signature: string;
    try {
      signature = await submitTransaction(signedTransaction, rpcEndpoint);
    } catch (err) {
      onProgress?.('error', 'Failed to submit transaction');
      throw new SwapFlowError(
        `Failed to submit transaction: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'SUBMIT_ERROR',
        err
      );
    }

    // Step 5: Poll for confirmation
    onProgress?.('confirming', `Confirming transaction (${signature.slice(0, 8)}...)...`);
    let confirmationResult: ConfirmationResult;
    try {
      confirmationResult = await pollTransactionConfirmation(signature, rpcEndpoint);
    } catch (err) {
      onProgress?.('error', 'Confirmation polling failed');
      throw new SwapFlowError(
        `Confirmation polling failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'CONFIRMATION_ERROR',
        err
      );
    }

    if (confirmationResult.status === 'failed') {
      onProgress?.('error', 'Transaction failed on-chain');
      return {
        success: false,
        transactionSignature: signature,
        explorerUrl: `${SOLSCAN_EXPLORER_URL}/${signature}`,
        error: confirmationResult.error || 'Transaction failed on-chain',
      };
    }

    if (confirmationResult.status === 'timed_out') {
      onProgress?.('error', 'Transaction confirmation timed out');
      return {
        success: false,
        transactionSignature: signature,
        explorerUrl: `${SOLSCAN_EXPLORER_URL}/${signature}`,
        error: 'Transaction confirmation timed out. Check explorer for status.',
      };
    }

    // Step 6: Record result to API (POST /trading/swap)
    onProgress?.('recording', 'Recording swap to history...');
    let swapId: string | undefined;
    try {
      swapId = await recordSwap({
        walletAddress: walletAdapter.publicKey,
        inputMint: quote.inputToken.mint,
        outputMint: quote.outputToken.mint,
        inputAmount: quote.rawQuote.inputAmount,
        outputAmount: quote.rawQuote.outputAmount,
        transactionSignature: signature,
      });
    } catch {
      // Recording failure is non-fatal — continue without swap ID
      swapId = undefined;
    }

    // Step 7: Complete
    onProgress?.('complete', 'Swap complete!');
    return {
      success: true,
      transactionSignature: signature,
      explorerUrl: `${SOLSCAN_EXPLORER_URL}/${signature}`,
      swapId,
    };
  } catch (err) {
    if (err instanceof SwapFlowError) {
      throw err;
    }
    throw new SwapFlowError(
      `Swap execution failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      'EXECUTION_ERROR',
      err
    );
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Submit signed transaction to RPC
 * @param signedTransaction Signed transaction bytes
 * @param rpcEndpoint Solana RPC endpoint URL
 * @returns Transaction signature
 */
async function submitTransaction(
  signedTransaction: Uint8Array,
  rpcEndpoint: string
): Promise<string> {
  const requestBody = {
    jsonrpc: '2.0',
    id: '1',
    method: 'sendTransaction',
    params: [
      Buffer.from(signedTransaction).toString('base64'),
      {
        encoding: 'base64',
        preflightCommitment: 'confirmed',
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
    throw new Error(`RPC request failed (HTTP ${response.status})`);
  }

  const SendTransactionResponseSchema = z.object({
    jsonrpc: z.string(),
    id: z.union([z.string(), z.number()]),
    result: z.string().optional(),
    error: z.object({
      code: z.number(),
      message: z.string(),
    }).optional(),
  });

  const responseBody = await response.json();
  const parseResult = SendTransactionResponseSchema.safeParse(responseBody);

  if (!parseResult.success) {
    throw new Error(`Invalid RPC response: ${parseResult.error.message}`);
  }

  const data = parseResult.data;

  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }

  if (!data.result) {
    throw new Error('No transaction signature in response');
  }

  return data.result;
}

/**
 * Record swap to history via API
 * @param _params Swap record parameters
 * @returns Swap ID from database
 */
async function recordSwap(_params: {
  walletAddress: string;
  inputMint: string;
  outputMint: string;
  inputAmount: string;
  outputAmount: string;
  transactionSignature: string;
}): Promise<string> {
  // Stub — will be wired to POST /api/trading/swap in Sprint 3.3
  // For now, this is a no-op and returns a placeholder ID
  return 'placeholder-swap-id';
}
