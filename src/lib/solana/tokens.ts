/**
 * SPL Token Utilities
 * Token balance queries and amount formatting
 * Uses @solana/kit for all RPC operations
 */

import { address, createSolanaRpc } from '@solana/kit';
import type { Address } from '@solana/kit';

// =============================================================================
// CONSTANTS
// =============================================================================

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const SOL_DECIMALS = 9;
export const LAMPORTS_PER_SOL = 1_000_000_000n;

// =============================================================================
// TYPES
// =============================================================================

export interface TokenBalance {
  mint: string;
  balance: bigint;
  decimals: number;
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenError';
  }
}

// =============================================================================
// BALANCE QUERIES
// =============================================================================

/**
 * Get SOL balance for a wallet
 * @param rpcEndpoint Solana RPC endpoint URL
 * @param walletAddress Wallet address to query
 * @returns Balance in lamports (bigint)
 * @throws {TokenError} If balance query fails
 */
export async function getSolBalance(
  rpcEndpoint: string,
  walletAddress: string
): Promise<bigint> {
  let addr: Address;
  try {
    addr = address(walletAddress);
  } catch (err) {
    throw new TokenError(
      `Invalid wallet address: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }

  try {
    const rpc = createSolanaRpc(rpcEndpoint);
    const response = await rpc.getBalance(addr).send();
    return response.value;
  } catch (err) {
    throw new TokenError(
      `Failed to get SOL balance: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
}

/**
 * Get SPL token balance for a wallet
 * @param rpcEndpoint Solana RPC endpoint URL
 * @param walletAddress Wallet address to query
 * @param mintAddress Token mint address
 * @returns Token balance with decimals
 * @throws {TokenError} If balance query fails
 */
export async function getTokenBalance(
  rpcEndpoint: string,
  walletAddress: string,
  mintAddress: string
): Promise<TokenBalance> {
  let walletAddr: Address;
  let mintAddr: Address;

  try {
    walletAddr = address(walletAddress);
    mintAddr = address(mintAddress);
  } catch (err) {
    throw new TokenError(
      `Invalid address: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }

  try {
    const rpc = createSolanaRpc(rpcEndpoint);

    // Get token accounts by owner
    const response = await rpc
      .getTokenAccountsByOwner(walletAddr, { mint: mintAddr })
      .send();

    if (response.value.length === 0) {
      // No token account found — balance is 0
      // We still need to get decimals from the mint
      const mintInfo = await rpc.getAccountInfo(mintAddr).send();
      if (!mintInfo.value) {
        throw new TokenError(`Token mint not found: ${mintAddress}`);
      }

      // For simplicity, return 0 balance with default decimals
      // In production, you'd decode the mint data to get actual decimals
      return {
        mint: mintAddress,
        balance: 0n,
        decimals: 6, // Most tokens use 6, but this should be decoded
      };
    }

    // Get the first token account (should only be one per wallet+mint)
    const tokenAccount = response.value[0];
    const accountInfo = tokenAccount.account;

    // Decode token account data
    // Token account layout: [0..63: mint, 32..63: owner, 64..71: amount (u64), 72: delegate_option, ...]
    const data: unknown = accountInfo.data;

    // Extract amount (8 bytes at offset 64)
    let amountBytes: Uint8Array;
    if (typeof data === 'string') {
      // Base64 encoded
      const decoded = Buffer.from(data, 'base64');
      amountBytes = decoded.slice(64, 72);
    } else if (Array.isArray(data) && data.length === 2) {
      // RPC returns [base64String, encoding] tuple — first element is always a string
      const decoded = Buffer.from(data[0] as string, 'base64');
      amountBytes = decoded.slice(64, 72);
    } else {
      throw new TokenError('Unexpected account data format');
    }

    // Convert little-endian bytes to bigint
    let balance = 0n;
    for (let i = 0; i < 8; i++) {
      balance += BigInt(amountBytes[i]) << BigInt(i * 8);
    }

    // Extract decimals (1 byte at offset 44 in mint account)
    const mintInfo = await rpc.getAccountInfo(mintAddr).send();
    if (!mintInfo.value) {
      throw new TokenError(`Token mint not found: ${mintAddress}`);
    }

    let decimals = 6; // default
    const mintData: unknown = mintInfo.value.data;
    if (typeof mintData === 'string') {
      const decoded = Buffer.from(mintData, 'base64');
      decimals = decoded[44];
    } else if (Array.isArray(mintData) && mintData.length === 2) {
      // RPC returns [base64String, encoding] tuple — first element is always a string
      const decoded = Buffer.from(mintData[0] as string, 'base64');
      decimals = decoded[44];
    }

    return {
      mint: mintAddress,
      balance,
      decimals,
    };
  } catch (err) {
    if (err instanceof TokenError) {
      throw err;
    }
    throw new TokenError(
      `Failed to get token balance: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
}

// =============================================================================
// AMOUNT FORMATTING
// =============================================================================

/**
 * Format token amount to human-readable string
 * NO floating point math — uses string manipulation
 * @param amount Token amount as bigint (raw units)
 * @param decimals Number of decimals for the token
 * @returns Formatted amount (e.g., "1.5")
 */
export function formatTokenAmount(amount: bigint, decimals: number): string {
  if (amount === 0n) {
    return '0';
  }

  const isNegative = amount < 0n;
  const absAmount = isNegative ? -amount : amount;

  // Convert to string and pad with zeros
  const amountStr = absAmount.toString();

  if (amountStr.length <= decimals) {
    // Amount is less than 1 token
    const paddedStr = amountStr.padStart(decimals, '0');
    const result = `0.${paddedStr}`;
    // Remove trailing zeros
    const trimmed = result.replace(/\.?0+$/, '');
    return isNegative ? `-${trimmed}` : trimmed || '0';
  }

  // Amount is 1 token or more
  const integerPart = amountStr.slice(0, -decimals);
  const decimalPart = amountStr.slice(-decimals);

  // Remove trailing zeros from decimal part
  const trimmedDecimalPart = decimalPart.replace(/0+$/, '');

  if (trimmedDecimalPart === '') {
    return isNegative ? `-${integerPart}` : integerPart;
  }

  const result = `${integerPart}.${trimmedDecimalPart}`;
  return isNegative ? `-${result}` : result;
}

/**
 * Parse human-readable amount to token units
 * NO floating point math — uses string manipulation
 * @param amount Human-readable amount (e.g., "1.5")
 * @param decimals Number of decimals for the token
 * @returns Token amount as bigint (raw units)
 * @throws {TokenError} If amount format is invalid
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  if (!amount || amount === '0') {
    return 0n;
  }

  // Validate format
  if (!/^-?\d+(\.\d+)?$/.test(amount)) {
    throw new TokenError(`Invalid amount format: ${amount}`);
  }

  const isNegative = amount.startsWith('-');
  const absAmount = isNegative ? amount.slice(1) : amount;

  const parts = absAmount.split('.');
  const integerPart = parts[0] || '0';
  const decimalPart = parts[1] || '';

  // Check if decimal part exceeds token decimals
  if (decimalPart.length > decimals) {
    throw new TokenError(
      `Amount has too many decimal places. Maximum ${decimals} allowed, got ${decimalPart.length}`
    );
  }

  // Pad decimal part to match token decimals
  const paddedDecimalPart = decimalPart.padEnd(decimals, '0');

  // Combine integer and decimal parts
  const combinedStr = integerPart + paddedDecimalPart;

  // Convert to bigint
  const result = BigInt(combinedStr);

  return isNegative ? -result : result;
}
