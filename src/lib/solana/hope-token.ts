/**
 * $HOPE Token Utilities
 * Utilities for interacting with the $HOPE platform token
 * Uses @solana/kit for all RPC operations
 */

import { address } from '@solana/kit';
import { getTokenBalance, formatTokenAmount } from './tokens';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * $HOPE token mint address (devnet placeholder)
 * TODO: Replace with actual devnet mint address when deployed
 */
export const HOPE_MINT = 'HoPExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

/**
 * $HOPE token decimals (standard SPL token precision)
 */
export const HOPE_DECIMALS = 6;

// =============================================================================
// BALANCE QUERIES
// =============================================================================

/**
 * Get $HOPE token balance for a wallet
 * @param walletAddress Wallet address to query
 * @returns Balance as a number (human-readable format)
 * @throws {Error} If balance query fails
 */
export async function getHopeBalance(walletAddress: string): Promise<number> {
  try {
    // Validate wallet address
    address(walletAddress);
  } catch (err) {
    throw new Error(
      `Invalid wallet address: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }

  try {
    const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
    if (!rpcUrl) {
      throw new Error('Missing NEXT_PUBLIC_HELIUS_RPC_URL environment variable');
    }

    const tokenBalance = await getTokenBalance(rpcUrl, walletAddress, HOPE_MINT);

    // Convert bigint balance to human-readable number
    // NO floating point math — use string conversion
    const formattedBalance = formatTokenAmount(tokenBalance.balance, HOPE_DECIMALS);
    return parseFloat(formattedBalance);
  } catch (err) {
    // If token account doesn't exist, balance is 0
    if (err instanceof Error && err.message.includes('not found')) {
      return 0;
    }
    throw new Error(
      `Failed to get $HOPE balance: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if a wallet holds any $HOPE tokens (feature gating)
 * @param walletAddress Wallet address to check
 * @returns True if wallet has $HOPE balance > 0
 */
export async function isHopeHolder(walletAddress: string): Promise<boolean> {
  try {
    const balance = await getHopeBalance(walletAddress);
    return balance > 0;
  } catch {
    // On error, assume not a holder
    return false;
  }
}

// =============================================================================
// AMOUNT FORMATTING
// =============================================================================

/**
 * Format $HOPE amount to display string with proper decimals and symbol
 * @param amount $HOPE amount as number (human-readable format)
 * @returns Formatted string (e.g., "1,234.56 $HOPE")
 */
export function formatHopeAmount(amount: number): string {
  if (amount === 0) {
    return '0 $HOPE';
  }

  // Format with thousands separators and up to 2 decimal places
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${formatted} $HOPE`;
}
