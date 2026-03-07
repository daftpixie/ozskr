// ---------------------------------------------------------------------------
// x402 Facilitator Service Configuration
// ---------------------------------------------------------------------------
//
// The x402 facilitator bridge is built on Kora (Solana Foundation's gasless
// infrastructure) and is self-hosted as part of the ozskr.ai Next.js app.
//
// Route: /api/x402/* (mounted in src/lib/api/app.ts via koraFacilitatorRoutes)
//
// Key environment variables:
//   X402_FACILITATOR_URL — URL of the Kora facilitator bridge. Must point to
//     ozskr's own bridge endpoint (e.g., https://ozskr.ai/api/x402). Used by
//     HTTPFacilitatorClient in server-middleware.ts to call /verify and /settle.
//     In development: http://localhost:3000/api/x402
//   KORA_RPC_URL — Direct Kora RPC URL used by kora-client.ts for settlement.
//     Kora co-signs transactions as the gas fee payer via this endpoint.
//
// The facilitator enforces:
// - Token allowlist (USDC only)
// - Recipient allowlist (PLATFORM_TREASURY_ADDRESS if set)
// - Per-transaction amount cap (default 10 USDC)
// - Governance checks via @ozskr/x402-facilitator exports

import { z } from 'zod';

export const FacilitatorConfigSchema = z.object({
  /**
   * URL of the Kora facilitator bridge (ozskr's own x402 endpoint).
   * Must be set to the deployed bridge URL, e.g.:
   *   Production: https://ozskr.ai/api/x402
   *   Development: http://localhost:3000/api/x402
   *
   * Used by HTTPFacilitatorClient in server-middleware.ts.
   */
  endpoint: z
    .string()
    .url()
    .describe('Kora facilitator bridge URL (e.g., https://ozskr.ai/api/x402 or http://localhost:3000/api/x402)'),

  /** Fallback facilitator URL (legacy PayAI — used if bridge is unavailable). */
  fallbackEndpoint: z
    .string()
    .url()
    .optional()
    .describe('Fallback facilitator URL if primary bridge is unavailable'),

  /** Solana network. */
  network: z.enum(['devnet', 'mainnet-beta']).default('devnet'),

  /** Fee payer public key (Kora acts as the gas sponsor — this is informational). */
  feePayerAddress: z.string().optional(),

  /**
   * Direct Kora RPC URL — used by kora-client.ts for gasless transaction settlement.
   * Kora co-signs the transaction as the fee payer and submits to Solana.
   * Optional: if not set, kora-client.ts will report isKoraConfigured() = false.
   */
  koraRpcUrl: z
    .string()
    .url()
    .optional()
    .describe('Kora RPC endpoint for gasless settlement (e.g., https://kora.ozskr.ai)'),
});

export type FacilitatorConfig = z.infer<typeof FacilitatorConfigSchema>;

/**
 * Loads facilitator configuration from environment variables.
 *
 * Required: X402_FACILITATOR_URL (Kora bridge URL, e.g. https://ozskr.ai/api/x402)
 * Optional: X402_FACILITATOR_FALLBACK_URL, SOLANA_NETWORK, X402_FEE_PAYER_ADDRESS,
 *           KORA_RPC_URL (used by kora-client.ts for direct Kora gasless settlement)
 *
 * @throws ZodError if X402_FACILITATOR_URL is missing or invalid
 */
export function getFacilitatorConfig(): FacilitatorConfig {
  return FacilitatorConfigSchema.parse({
    endpoint: process.env.X402_FACILITATOR_URL,
    fallbackEndpoint: process.env.X402_FACILITATOR_FALLBACK_URL || undefined,
    network: process.env.NEXT_PUBLIC_SOLANA_NETWORK || process.env.SOLANA_NETWORK || undefined,
    feePayerAddress: process.env.X402_FEE_PAYER_ADDRESS || undefined,
    koraRpcUrl: process.env.KORA_RPC_URL || undefined,
  });
}

/**
 * Returns facilitator config if X402_FACILITATOR_URL is set, otherwise null.
 * Use this for optional integration — the platform works without a facilitator.
 */
export function getFacilitatorConfigOptional(): FacilitatorConfig | null {
  if (!process.env.X402_FACILITATOR_URL) return null;
  try {
    return getFacilitatorConfig();
  } catch {
    return null;
  }
}
