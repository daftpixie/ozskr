/**
 * Trading Zod Schemas
 * Request/response validation for trading endpoints
 */

import { z } from 'zod';
import { SwapStatus } from './database';
import { WalletAddressSchema, UuidSchema, TimestampSchema } from './schemas';

// =============================================================================
// ENUMS
// =============================================================================

export const SwapStatusSchema = z.nativeEnum(SwapStatus);

// =============================================================================
// SWAP QUOTE SCHEMAS
// =============================================================================

/**
 * Request schema for getting a swap quote from Jupiter Ultra
 */
export const SwapQuoteRequestSchema = z.object({
  inputMint: z.string().min(32).max(44), // Solana token mint address
  outputMint: z.string().min(32).max(44), // Solana token mint address
  amount: z.string().regex(/^\d+$/, 'Amount must be a stringified bigint'), // Stringified bigint
  slippageBps: z.coerce.number().int().min(1).max(300).default(50), // 1-300 bps (0.01%-3%) - coerce from string query param
});

export type SwapQuoteRequest = z.infer<typeof SwapQuoteRequestSchema>;

/**
 * Response schema for swap quote
 */
export const SwapQuoteResponseSchema = z.object({
  inputMint: z.string(),
  outputMint: z.string(),
  inputAmount: z.string(),
  outputAmount: z.string(),
  priceImpact: z.number().optional(),
  route: z.array(z.string()).optional(),
  expiresAt: TimestampSchema.optional(),
});

export type SwapQuoteResponse = z.infer<typeof SwapQuoteResponseSchema>;

// =============================================================================
// SWAP EXECUTION SCHEMAS
// =============================================================================

/**
 * Request schema for executing a swap
 */
export const SwapExecuteRequestSchema = z.object({
  quoteId: z.string().optional(), // Optional quote ID for tracking
  inputMint: z.string().min(32).max(44),
  outputMint: z.string().min(32).max(44),
  inputAmount: z.string().regex(/^\d+$/, 'Amount must be a stringified bigint'),
  slippageBps: z.number().int().min(1).max(300).default(50),
  priorityFeeLamports: z.string().regex(/^\d+$/, 'Priority fee must be a stringified bigint').default('0'),
});

export type SwapExecuteRequest = z.infer<typeof SwapExecuteRequestSchema>;

/**
 * Response schema for swap execution (initial pending response)
 */
export const SwapExecuteResponseSchema = z.object({
  swapId: UuidSchema,
  status: z.literal('pending'),
  message: z.string().optional(),
});

export type SwapExecuteResponse = z.infer<typeof SwapExecuteResponseSchema>;

// =============================================================================
// SWAP HISTORY SCHEMAS
// =============================================================================

/**
 * Response schema for swap history record
 */
export const SwapHistoryResponseSchema = z.object({
  id: UuidSchema,
  walletAddress: WalletAddressSchema,
  inputMint: z.string(),
  outputMint: z.string(),
  inputAmount: z.string(),
  outputAmount: z.string().nullable(),
  slippageBps: z.number(),
  priorityFeeLamports: z.string(),
  jupiterOrderId: z.string().nullable(),
  transactionSignature: z.string().nullable(),
  status: SwapStatusSchema,
  errorMessage: z.string().nullable(),
  simulationResult: z.record(z.string(), z.unknown()).nullable(),
  createdAt: TimestampSchema,
  confirmedAt: TimestampSchema.nullable(),
});

export type SwapHistoryResponse = z.infer<typeof SwapHistoryResponseSchema>;

/**
 * Paginated swap history query params
 */
export const SwapHistoryQuerySchema = z.object({
  page: z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
});

export type SwapHistoryQuery = z.infer<typeof SwapHistoryQuerySchema>;

// =============================================================================
// WATCHLIST SCHEMAS
// =============================================================================

/**
 * Request schema for adding a token to watchlist
 */
export const WatchlistItemSchema = z.object({
  tokenMint: z.string().min(32).max(44),
  tokenSymbol: z.string().min(1).max(20),
  tokenName: z.string().min(1).max(100),
});

export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;

/**
 * Response schema for watchlist item
 */
export const WatchlistResponseSchema = z.object({
  id: UuidSchema,
  walletAddress: WalletAddressSchema,
  tokenMint: z.string(),
  tokenSymbol: z.string(),
  tokenName: z.string(),
  addedAt: TimestampSchema,
});

export type WatchlistResponse = z.infer<typeof WatchlistResponseSchema>;

// =============================================================================
// TOKEN BALANCE SCHEMAS
// =============================================================================

/**
 * Token balance schema
 */
export const TokenBalanceSchema = z.object({
  tokenMint: z.string(),
  balance: z.string(), // Stringified bigint
  decimals: z.number().int().min(0).max(18),
  usdValue: z.string().nullable(), // Decimal string
});

export type TokenBalance = z.infer<typeof TokenBalanceSchema>;

/**
 * Response schema for token balances (array)
 */
export const TokenBalancesResponseSchema = z.object({
  balances: z.array(TokenBalanceSchema),
  cacheAge: z.number().int().min(0).optional(), // Seconds since last update
  isStale: z.boolean().default(false),
});

export type TokenBalancesResponse = z.infer<typeof TokenBalancesResponseSchema>;
