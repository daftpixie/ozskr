/**
 * Solana RPC Client Factory
 * Uses @solana/kit for all RPC operations
 */

import { createSolanaRpc } from '@solana/kit';

/**
 * Get the Solana RPC client configured with Helius endpoint.
 * @throws {Error} If NEXT_PUBLIC_HELIUS_RPC_URL is not set
 * @returns Solana RPC client instance
 */
export function getSolanaRpc() {
  const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  if (!rpcUrl) {
    throw new Error('Missing NEXT_PUBLIC_HELIUS_RPC_URL environment variable');
  }
  return createSolanaRpc(rpcUrl);
}

/**
 * Get the Solana devnet RPC client.
 * Fallback for development and testing.
 * @returns Solana RPC client instance for devnet
 */
export function getDevnetRpc() {
  return createSolanaRpc('https://api.devnet.solana.com');
}
