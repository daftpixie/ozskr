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
    .describe('x402 facilitator URL (auto-detected if omitted)'),

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
    logLevel: process.env.LOG_LEVEL || undefined,
  });
}
