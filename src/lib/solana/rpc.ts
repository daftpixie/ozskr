/**
 * Solana RPC Client Factory
 * Uses @solana/kit for all RPC operations
 */

import { createSolanaRpc } from '@solana/kit';
import { getNetworkConfig } from '@/lib/solana/network-config';

/**
 * Resolve the Helius RPC URL for the active network.
 *
 * NEXT_PUBLIC_HELIUS_RPC_URL is treated as a template: if it contains a
 * Helius hostname with a network subdomain (devnet / mainnet) that does NOT
 * match NEXT_PUBLIC_SOLANA_NETWORK, we swap the subdomain automatically so
 * the API key carries over without needing a separate env var per network.
 *
 * Examples:
 *   NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
 *   NEXT_PUBLIC_HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=abc
 *   → returns https://mainnet.helius-rpc.com/?api-key=abc
 *
 *   NEXT_PUBLIC_SOLANA_NETWORK=devnet
 *   NEXT_PUBLIC_HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=abc
 *   → returns https://devnet.helius-rpc.com/?api-key=abc
 */
export function resolveHeliusRpcUrl(): string | null {
  const rawUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  if (!rawUrl) return null;

  const { network } = getNetworkConfig();
  const targetSubdomain = network === 'mainnet-beta' ? 'mainnet' : 'devnet';

  // Swap Helius subdomain when present and mismatched
  return rawUrl
    .replace('devnet.helius-rpc.com', `${targetSubdomain}.helius-rpc.com`)
    .replace('mainnet.helius-rpc.com', `${targetSubdomain}.helius-rpc.com`);
}

/**
 * Get the Solana RPC client configured with Helius endpoint.
 * The endpoint is automatically aligned to NEXT_PUBLIC_SOLANA_NETWORK.
 * @throws {Error} If NEXT_PUBLIC_HELIUS_RPC_URL is not set
 * @returns Solana RPC client instance
 */
export function getSolanaRpc() {
  const rpcUrl = resolveHeliusRpcUrl();
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
