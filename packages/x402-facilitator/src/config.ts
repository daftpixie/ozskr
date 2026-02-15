import { z } from 'zod';

// ---------------------------------------------------------------------------
// Governance Schema
// ---------------------------------------------------------------------------

export const GovernanceSchema = z.object({
  maxSettlementAmount: z
    .string()
    .optional()
    .describe('Maximum settlement amount in base units (e.g. 10000000 = 10 USDC)'),

  allowedTokens: z
    .array(z.string())
    .optional()
    .describe('Token mint addresses allowed for settlement (undefined = allow all)'),

  allowedRecipients: z
    .array(z.string())
    .optional()
    .describe('Recipient addresses allowed for settlement (undefined = allow all)'),

  rateLimitPerMinute: z
    .number()
    .int()
    .positive()
    .default(60)
    .describe('Maximum settlements per minute'),
});

export type GovernanceConfig = z.infer<typeof GovernanceSchema>;

// ---------------------------------------------------------------------------
// Configuration Schema
// ---------------------------------------------------------------------------

export const ConfigSchema = z.object({
  solanaRpcUrl: z
    .string()
    .url('SOLANA_RPC_URL must be a valid URL')
    .describe('Solana RPC endpoint URL'),

  facilitatorKeypairPath: z
    .string()
    .min(1, 'FACILITATOR_KEYPAIR_PATH is required')
    .describe('Path to encrypted facilitator keypair JSON file'),

  facilitatorPassphrase: z
    .string()
    .min(12, 'FACILITATOR_PASSPHRASE must be at least 12 characters')
    .describe('Passphrase to decrypt the facilitator keypair'),

  solanaNetwork: z
    .enum(['devnet', 'mainnet-beta', 'testnet'])
    .default('devnet')
    .describe('Solana network identifier'),

  scryptMode: z
    .enum(['fast', 'production'])
    .default('fast')
    .describe('Scrypt KDF mode for keypair decryption'),

  host: z
    .string()
    .default('0.0.0.0')
    .describe('Server bind address'),

  port: z
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(4020)
    .describe('Server port'),

  logLevel: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info')
    .describe('Log verbosity level'),

  governance: GovernanceSchema.default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

// ---------------------------------------------------------------------------
// Environment Loader
// ---------------------------------------------------------------------------

export function loadConfigFromEnv(): Config {
  return ConfigSchema.parse({
    solanaRpcUrl: process.env.SOLANA_RPC_URL,
    facilitatorKeypairPath: process.env.FACILITATOR_KEYPAIR_PATH,
    facilitatorPassphrase: process.env.FACILITATOR_PASSPHRASE,
    solanaNetwork: process.env.SOLANA_NETWORK || undefined,
    scryptMode: process.env.OZSKR_SCRYPT_PARAMS || undefined,
    host: process.env.HOST || undefined,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
    logLevel: process.env.LOG_LEVEL || undefined,
    governance: {
      maxSettlementAmount: process.env.MAX_SETTLEMENT_AMOUNT || undefined,
      allowedTokens: process.env.ALLOWED_TOKENS
        ? process.env.ALLOWED_TOKENS.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      allowedRecipients: process.env.ALLOWED_RECIPIENTS
        ? process.env.ALLOWED_RECIPIENTS.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      rateLimitPerMinute: process.env.RATE_LIMIT_PER_MINUTE
        ? parseInt(process.env.RATE_LIMIT_PER_MINUTE, 10)
        : undefined,
    },
  });
}
