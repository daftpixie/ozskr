/**
 * Solana RPC Client Factory
 * Uses @solana/kit for all RPC operations
 */

import { createSolanaRpc } from '@solana/kit';
import { getNetworkConfig } from '@/lib/solana/network-config';

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
 * Get the fallback Solana RPC client.
 * Uses the public RPC endpoint for the configured network.
 * @returns Solana RPC client instance
 */
export function getFallbackRpc() {
  return createSolanaRpc(getNetworkConfig().defaultRpcFallback);
}
