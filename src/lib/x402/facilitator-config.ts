// ---------------------------------------------------------------------------
// x402 Facilitator Service Configuration
// ---------------------------------------------------------------------------
//
// Production: facilitator runs as a separate service (Docker / Cloudflare Worker).
// Development: facilitator runs locally or points to a local instance.
//
// The facilitator is the governance checkpoint between the MCP server's
// payment intent and on-chain settlement. It enforces:
// - OFAC/SDN screening
// - SPL delegation validation
// - Budget enforcement
// - Simulate-before-submit (Bug 7 fix)

import { z } from 'zod';

export const FacilitatorConfigSchema = z.object({
  /** Primary facilitator service URL (ozskr's own). */
  endpoint: z
    .string()
    .url()
    .describe('Facilitator service URL (e.g., http://localhost:4020 or https://facilitator.ozskr.ai)'),

  /** Fallback facilitator URL (CDP or PayAI). */
  fallbackEndpoint: z
    .string()
    .url()
    .optional()
    .describe('Fallback facilitator URL if primary is unavailable'),

  /** Solana network. */
  network: z.enum(['devnet', 'mainnet-beta']).default('devnet'),

  /** Fee payer public key (facilitator gas sponsor wallet). */
  feePayerAddress: z.string().optional(),
});

export type FacilitatorConfig = z.infer<typeof FacilitatorConfigSchema>;

/**
 * Loads facilitator configuration from environment variables.
 *
 * Required: X402_FACILITATOR_URL
 * Optional: X402_FACILITATOR_FALLBACK_URL, SOLANA_NETWORK, X402_FEE_PAYER_ADDRESS
 *
 * @throws ZodError if X402_FACILITATOR_URL is missing or invalid
 */
export function getFacilitatorConfig(): FacilitatorConfig {
  return FacilitatorConfigSchema.parse({
    endpoint: process.env.X402_FACILITATOR_URL,
    fallbackEndpoint: process.env.X402_FACILITATOR_FALLBACK_URL || undefined,
    network: process.env.NEXT_PUBLIC_SOLANA_NETWORK || process.env.SOLANA_NETWORK || undefined,
    feePayerAddress: process.env.X402_FEE_PAYER_ADDRESS || undefined,
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
