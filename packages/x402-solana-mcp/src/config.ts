import { z } from 'zod';

// ---------------------------------------------------------------------------
// Configuration Schema
// ---------------------------------------------------------------------------

/**
 * Zod schema for x402-solana-mcp server configuration.
 *
 * All fields map to environment variables:
 * - SOLANA_RPC_URL → solanaRpcUrl
 * - AGENT_KEYPAIR_PATH → agentKeypairPath
 * - SOLANA_NETWORK → solanaNetwork
 * - X402_FACILITATOR_URL → x402FacilitatorUrl
 * - OZSKR_SCRYPT_PARAMS → scryptMode ("fast" | "production", default "fast")
 * - LOG_LEVEL → logLevel
 */
export const ConfigSchema = z.object({
  solanaRpcUrl: z
    .string()
    .url('SOLANA_RPC_URL must be a valid URL')
    .describe('Solana RPC endpoint URL'),

  agentKeypairPath: z
    .string()
    .min(1, 'AGENT_KEYPAIR_PATH is required')
    .describe('Path to agent keypair JSON file'),

  solanaNetwork: z
    .enum(['devnet', 'mainnet-beta', 'testnet'])
    .default('devnet')
    .describe('Solana network identifier'),

  x402FacilitatorUrl: z
    .string()
    .url('X402_FACILITATOR_URL must be a valid URL')
    .optional()
    .describe('Primary x402 facilitator URL (defaults to CDP facilitator)'),

  x402FacilitatorFallbackUrl: z
    .string()
    .url('X402_FACILITATOR_FALLBACK_URL must be a valid URL')
    .optional()
    .describe('Fallback x402 facilitator URL (defaults to PayAI facilitator)'),

  scryptMode: z
    .enum(['fast', 'production'])
    .default('fast')
    .describe('Scrypt KDF mode for keypair encryption (fast=N^14 for dev, production=N^20)'),

  logLevel: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info')
    .describe('Log verbosity level'),
});

export type Config = z.infer<typeof ConfigSchema>;

// ---------------------------------------------------------------------------
// Environment Loader
// ---------------------------------------------------------------------------

/**
 * Loads and validates server configuration from environment variables.
 *
 * @returns Validated Config object
 * @throws ZodError if required env vars are missing or invalid
 */
export function loadConfigFromEnv(): Config {
  return ConfigSchema.parse({
    solanaRpcUrl: process.env.SOLANA_RPC_URL,
    agentKeypairPath: process.env.AGENT_KEYPAIR_PATH,
    solanaNetwork: process.env.SOLANA_NETWORK || undefined,
    x402FacilitatorUrl: process.env.X402_FACILITATOR_URL || undefined,
    x402FacilitatorFallbackUrl: process.env.X402_FACILITATOR_FALLBACK_URL || undefined,
    scryptMode: process.env.OZSKR_SCRYPT_PARAMS || undefined,
    logLevel: process.env.LOG_LEVEL || undefined,
  });
}
