/**
 * Turnkey Solana Policy Engine configuration spec.
 *
 * These policies execute INSIDE the AWS Nitro Enclave — our code cannot bypass them.
 * They provide defense-in-depth beyond the client-side budget tracking in budget.ts.
 *
 * Configure via Turnkey dashboard or Policy API after wallet creation.
 * This file documents the intended policy configuration for agent wallets.
 */

/**
 * Allowed Solana programs for agent transactions.
 * Turnkey will reject any transaction that invokes a program not in this list.
 */
export const ALLOWED_PROGRAMS = {
  /** SPL Token program — required for TransferChecked */
  TOKEN_PROGRAM: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  /** Associated Token Account program — required for ATA creation */
  ATA_PROGRAM: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  /** System Program — required for fee payment only */
  SYSTEM_PROGRAM: '11111111111111111111111111111111',
} as const;

/**
 * Allowed token mints for agent transactions.
 * Agents can only transact with these specific tokens.
 */
export const ALLOWED_TOKEN_MINTS = {
  /** Devnet USDC (Circle faucet) */
  DEVNET_USDC: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  /** Mainnet USDC */
  MAINNET_USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  // $HOPE mint TBD — will be added after token creation
} as const;

/**
 * Full Turnkey policy specification for agent wallets.
 *
 * This is a documentation/reference object — actual policy enforcement
 * happens inside Turnkey's TEE via their Policy Engine.
 *
 * To apply these policies:
 * 1. Create the wallet via createTurnkeyWallet()
 * 2. Use Turnkey dashboard or Policy API to attach these rules
 * 3. Policies are enforced at the enclave level — our code cannot bypass them
 */
export const TURNKEY_POLICY_SPEC = {
  description: 'ozskr.ai agent wallet policy — restricts signing to SPL token transfers only',

  rules: [
    {
      name: 'allowed-programs',
      description: 'Only allow transactions to known Solana programs',
      programs: Object.values(ALLOWED_PROGRAMS),
      action: 'DENY_ALL_OTHERS',
    },
    {
      name: 'allowed-instructions',
      description: 'Only allow TransferChecked (12) and CreateAtaIdempotent (1)',
      instructions: [
        { program: ALLOWED_PROGRAMS.TOKEN_PROGRAM, discriminator: 12 },
        { program: ALLOWED_PROGRAMS.ATA_PROGRAM, discriminator: 1 },
      ],
      action: 'DENY_ALL_OTHERS',
    },
    {
      name: 'spending-limits',
      description: 'Per-agent spending limits (configurable per wallet)',
      defaults: {
        maxSingleTransactionUsd: 100,
        maxDailyUsd: 1000,
      },
    },
    {
      name: 'allowed-tokens',
      description: 'Only allow transfers of approved token mints',
      mints: Object.values(ALLOWED_TOKEN_MINTS),
      action: 'DENY_ALL_OTHERS',
    },
    {
      name: 'no-approval',
      description: 'Prevent agents from approving delegation to other addresses',
      blockedInstructions: [
        { program: ALLOWED_PROGRAMS.TOKEN_PROGRAM, discriminator: 13 }, // ApproveChecked
        { program: ALLOWED_PROGRAMS.TOKEN_PROGRAM, discriminator: 4 },  // Approve
      ],
    },
  ],
} as const;
