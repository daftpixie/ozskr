import { z } from 'zod';

// ---------------------------------------------------------------------------
// Circuit Breaker Schema
// ---------------------------------------------------------------------------

export const CircuitBreakerSchema = z.object({
  maxSettlementsPerHour: z
    .number().int().positive().default(100)
    .describe('Max settlements per agent per hour'),

  maxSettlementsPerDay: z
    .number().int().positive().default(500)
    .describe('Max settlements per agent per day'),

  maxValuePerHourBaseUnits: z
    .string().default('10000000')
    .describe('Max settled value per agent per hour in base units (default 10 USDC)'),

  maxSameRecipientPerMinute: z
    .number().int().positive().default(5)
    .describe('Max settlements to same recipient per minute (prompt injection defense)'),

  maxSameRecipientPerHour: z
    .number().int().positive().default(20)
    .describe('Max settlements to same recipient per hour'),

  maxGlobalSettlementsPerMinute: z
    .number().int().positive().default(30)
    .describe('Max settlements globally per minute'),
});

export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerSchema>;

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

  // Day 5: On-chain governance feature flags
  delegationCheckEnabled: z
    .boolean()
    .default(false)
    .describe('Enable on-chain delegation validation'),

  budgetEnforceEnabled: z
    .boolean()
    .default(false)
    .describe('Enable cumulative budget enforcement'),

  // Day 6: Compliance + adversarial defense
  ofacEnabled: z
    .boolean()
    .default(false)
    .describe('Enable OFAC SDN screening'),

  ofacFailClosed: z
    .boolean()
    .default(true)
    .describe('If OFAC service unavailable: true = block, false = allow with warning'),

  ofacBlocklistPath: z
    .string()
    .optional()
    .describe('Path to OFAC blocklist JSON file'),

  circuitBreakerEnabled: z
    .boolean()
    .default(false)
    .describe('Enable circuit breaker with velocity tracking'),

  circuitBreaker: CircuitBreakerSchema.default({}),

  blockhashValidationEnabled: z
    .boolean()
    .default(false)
    .describe('Enable blockhash freshness validation before settlement'),

  blockhashMaxAgeSeconds: z
    .number()
    .int()
    .positive()
    .default(60)
    .describe('Max blockhash age in seconds'),

  // Day 7: Settlement pipeline
  simulateBeforeSubmit: z
    .boolean()
    .default(false)
    .describe('Enable simulate-before-submit for settlements'),

  gasAlertThresholdSol: z
    .number()
    .positive()
    .default(0.1)
    .describe('SOL balance threshold for gas alerts'),
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
      delegationCheckEnabled: process.env.DELEGATION_CHECK_ENABLED === 'true' || undefined,
      budgetEnforceEnabled: process.env.BUDGET_ENFORCE_ENABLED === 'true' || undefined,
      ofacEnabled: process.env.OFAC_ENABLED === 'true' || undefined,
      ofacFailClosed: process.env.OFAC_FAIL_CLOSED !== 'false' || undefined,
      ofacBlocklistPath: process.env.OFAC_BLOCKLIST_PATH || undefined,
      circuitBreakerEnabled: process.env.CIRCUIT_BREAKER_ENABLED === 'true' || undefined,
      blockhashValidationEnabled: process.env.BLOCKHASH_VALIDATION_ENABLED === 'true' || undefined,
      simulateBeforeSubmit: process.env.SIMULATE_BEFORE_SUBMIT === 'true' || undefined,
      gasAlertThresholdSol: process.env.GAS_ALERT_THRESHOLD_SOL
        ? parseFloat(process.env.GAS_ALERT_THRESHOLD_SOL)
        : undefined,
    },
  });
}
