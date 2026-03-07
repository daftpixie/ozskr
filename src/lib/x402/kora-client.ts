// ---------------------------------------------------------------------------
// Kora RPC Client — singleton wrapper around @solana/kora's KoraClient
// ---------------------------------------------------------------------------
//
// Kora (Solana Foundation's gasless transaction infrastructure) sponsors gas
// fees so agents don't need SOL for transaction fees. This module exposes a
// process-level singleton that is lazy-initialized on first use.
//
// Environment variables (server-side only — never NEXT_PUBLIC_*):
//   KORA_RPC_URL      — required; Kora server endpoint
//   KORA_API_KEY      — optional; for authenticated Kora deployments
//   KORA_HMAC_SECRET  — optional; for HMAC-authenticated Kora deployments
//
// Usage:
//   import { isKoraConfigured, koraSignAndSend } from '@/lib/x402/kora-client';
//   if (!isKoraConfigured()) { /* skip gasless path */ }
//   const { signature } = await koraSignAndSend(base64Tx);

import { KoraClient } from '@solana/kora';
import type { Config } from '@solana/kora';

import { logger } from '@/lib/utils/logger';

// Re-export Config so callers can type koraGetConfig() responses without
// reaching into the third-party package directly.
export type { Config };

// ---------------------------------------------------------------------------
// Singleton management
// ---------------------------------------------------------------------------

let _client: KoraClient | null = null;

/**
 * Lazily initialise the singleton KoraClient.
 * Throws a descriptive error if KORA_RPC_URL is not set.
 */
function getClient(): KoraClient {
  if (_client) return _client;

  const rpcUrl = process.env.KORA_RPC_URL;
  if (!rpcUrl) {
    throw new Error(
      'Kora is not configured: KORA_RPC_URL environment variable is not set. ' +
        'Set KORA_RPC_URL to your Kora server endpoint to enable gasless transactions.',
    );
  }

  const apiKey = process.env.KORA_API_KEY ?? undefined;
  const hmacSecret = process.env.KORA_HMAC_SECRET ?? undefined;

  _client = new KoraClient({ rpcUrl, apiKey, hmacSecret });
  return _client;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if KORA_RPC_URL is configured in the environment.
 * Use this guard before calling any Kora method to avoid hard errors in
 * environments where Kora is not deployed (e.g., local dev without a Kora node).
 */
export function isKoraConfigured(): boolean {
  const configured = Boolean(process.env.KORA_RPC_URL);
  if (!configured) {
    logger.warn('Kora is not configured: KORA_RPC_URL is not set', {
      hint: 'Set KORA_RPC_URL to enable gasless Solana transactions via Kora',
    });
  }
  return configured;
}

/**
 * Sign the transaction as fee payer AND broadcast it to Solana.
 *
 * Kora's fee payer covers the SOL gas cost so the agent wallet needs no SOL.
 * The returned `signature` value is the base64-encoded signed transaction
 * returned by the Kora server (the SDK does not expose the raw tx signature
 * separately in v0.1.3 — callers that need the on-chain signature should
 * decode this value or wait for the RPC confirmation callback).
 *
 * @param transaction - Base64-encoded transaction to sign and send
 * @param options.signerKey - Optional signer address override
 * @returns Object containing the signed transaction bytes as `signature`
 * @throws Descriptive error if Kora is unconfigured or the RPC call fails
 */
export async function koraSignAndSend(
  transaction: string,
  options?: { signerKey?: string },
): Promise<{ signature: string }> {
  try {
    const client = getClient();
    const result = await client.signAndSendTransaction({
      transaction,
      signer_key: options?.signerKey,
    });
    // The SDK returns `signed_transaction` (base64 wire tx). We surface it as
    // `signature` to match the expected interface. Callers needing the
    // confirmed on-chain tx signature should use rpc.getSignatureStatuses().
    return { signature: result.signed_transaction };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Kora signAndSendTransaction failed: ${message}`);
  }
}

/**
 * Sign the transaction as fee payer WITHOUT broadcasting it.
 *
 * Use this when you want Kora to cover the fee payer slot but still control
 * the submission yourself (e.g., to add additional signatures first).
 *
 * @param transaction - Base64-encoded transaction to sign
 * @param options.signerKey - Optional signer address override
 * @returns Object containing the base64-encoded signed transaction
 * @throws Descriptive error if Kora is unconfigured or the RPC call fails
 */
export async function koraSignOnly(
  transaction: string,
  options?: { signerKey?: string },
): Promise<{ signedTransaction: string }> {
  try {
    const client = getClient();
    const result = await client.signTransaction({
      transaction,
      signer_key: options?.signerKey,
    });
    return { signedTransaction: result.signed_transaction };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Kora signTransaction failed: ${message}`);
  }
}

/**
 * Retrieve the list of token mint addresses that this Kora server accepts
 * as fee-payment tokens.
 *
 * @returns Array of base58 mint address strings
 * @throws Descriptive error if Kora is unconfigured or the RPC call fails
 */
export async function koraGetSupportedTokens(): Promise<string[]> {
  try {
    const client = getClient();
    const result = await client.getSupportedTokens();
    return result.tokens;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Kora getSupportedTokens failed: ${message}`);
  }
}

/**
 * Retrieve the Kora server's runtime configuration.
 *
 * Includes fee_payers (signer pool), validation_config (allowed programs,
 * token allowlists, max lamports, fee model), and enabled_methods.
 *
 * @returns Kora server Config object (re-exported type from @solana/kora)
 * @throws Descriptive error if Kora is unconfigured or the RPC call fails
 */
export async function koraGetConfig(): Promise<Config> {
  try {
    const client = getClient();
    return await client.getConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Kora getConfig failed: ${message}`);
  }
}
