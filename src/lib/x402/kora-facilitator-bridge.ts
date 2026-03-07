// ---------------------------------------------------------------------------
// Kora Facilitator Bridge — Hono Router
// ---------------------------------------------------------------------------
//
// Implements the x402 facilitator protocol over Kora (Solana Foundation's
// gasless infrastructure). This bridge replaces the Coinbase CDP facilitator
// as the settlement backend for ozskr.ai x402 payments.
//
// Routes:
//   GET  /x402/supported  — Return supported payment schemes to x402ResourceServer
//   POST /x402/verify     — Run governance checks on a payment payload
//   POST /x402/settle     — Run governance checks + Kora gasless settlement
//
// SECURITY:
//   - Governance checks run on BOTH /verify and /settle (defense in depth)
//   - Token mint must be USDC (mainnet or devnet)
//   - Recipient must match PLATFORM_TREASURY_ADDRESS if set
//   - Amount must not exceed max cap (default 10 USDC)
//   - All Solana transactions are settled server-side via Kora — no user keys
//
// Architecture note:
//   kora-client.ts is created by a parallel agent — this file imports from it.
//   packages/x402-facilitator/ is locked — imported as a library only.

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { koraSignAndSend, koraGetSupportedTokens, isKoraConfigured } from './kora-client';
import { logger } from '@/lib/utils/logger';

// ---------------------------------------------------------------------------
// Governance check types and pure functions
// ---------------------------------------------------------------------------
//
// These are inlined from @ozskr/x402-facilitator/governance to avoid a build
// dependency on the unlinked workspace package. The logic is identical to the
// source in packages/x402-facilitator/src/governance.ts.
//
// If @ozskr/x402-facilitator is ever linked into node_modules (pnpm install
// after workspace setup), this can be replaced with:
//   import { checkTokenAllowlist, checkRecipientAllowlist, checkAmountCap }
//     from '@ozskr/x402-facilitator';

type GovernanceCheckResult = { allowed: true } | { allowed: false; reason: string };

function checkTokenAllowlist(asset: string, allowed?: string[]): GovernanceCheckResult {
  if (!allowed || allowed.length === 0) return { allowed: true };
  if (allowed.includes(asset)) return { allowed: true };
  return { allowed: false, reason: `Token ${asset} is not in the allowlist` };
}

function checkRecipientAllowlist(payTo: string, allowed?: string[]): GovernanceCheckResult {
  if (!allowed || allowed.length === 0) return { allowed: true };
  if (allowed.includes(payTo)) return { allowed: true };
  return { allowed: false, reason: `Recipient ${payTo} is not in the allowlist` };
}

function checkAmountCap(amount: string, max?: string): GovernanceCheckResult {
  if (!max) return { allowed: true };
  if (BigInt(amount) <= BigInt(max)) return { allowed: true };
  return { allowed: false, reason: `Amount ${amount} exceeds cap ${max}` };
}

// ---------------------------------------------------------------------------
// Network constants
// ---------------------------------------------------------------------------

/** CAIP-2 chain ID for Solana mainnet */
const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

/** CAIP-2 chain ID for Solana devnet */
const SOLANA_DEVNET_CAIP2 = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

/** USDC mint on Solana mainnet */
const USDC_MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/** USDC mint on Solana devnet */
const USDC_DEVNET_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

/** Default max amount per transaction: 10 USDC in micro-USDC (6 decimals) */
const DEFAULT_MAX_AMOUNT = '10000000';

// ---------------------------------------------------------------------------
// Network resolution
// ---------------------------------------------------------------------------

function isMainnet(): boolean {
  const network =
    process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? process.env.SOLANA_NETWORK ?? 'devnet';
  return network === 'mainnet-beta';
}

function resolveChainId(): string {
  return isMainnet() ? SOLANA_MAINNET_CAIP2 : SOLANA_DEVNET_CAIP2;
}

function resolveUsdcMint(): string {
  return isMainnet() ? USDC_MAINNET_MINT : USDC_DEVNET_MINT;
}

// ---------------------------------------------------------------------------
// Governance config (derived from environment at request time)
// ---------------------------------------------------------------------------

interface BridgeGovernanceConfig {
  allowedMints: string[];
  allowedRecipients: string[] | undefined;
  maxAmountPerTx: string;
}

function buildGovernanceConfig(): BridgeGovernanceConfig {
  const usdcMint = resolveUsdcMint();
  const treasuryAddress = process.env.PLATFORM_TREASURY_ADDRESS;

  return {
    allowedMints: [usdcMint],
    allowedRecipients: treasuryAddress ? [treasuryAddress] : undefined,
    maxAmountPerTx: DEFAULT_MAX_AMOUNT,
  };
}

// ---------------------------------------------------------------------------
// Governance check helper — runs the three required checks
// ---------------------------------------------------------------------------

interface GovernanceCheckInput {
  mint: string;
  recipient: string;
  amount: string;
}

function runBridgeGovernanceChecks(
  input: GovernanceCheckInput,
  config: BridgeGovernanceConfig
): GovernanceCheckResult {
  const tokenCheck = checkTokenAllowlist(input.mint, config.allowedMints);
  if (!tokenCheck.allowed) return tokenCheck;

  const recipientCheck = checkRecipientAllowlist(input.recipient, config.allowedRecipients);
  if (!recipientCheck.allowed) return recipientCheck;

  const amountCheck = checkAmountCap(input.amount, config.maxAmountPerTx);
  if (!amountCheck.allowed) return amountCheck;

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Zod schemas for request validation
// ---------------------------------------------------------------------------

/** Minimal PaymentPayload shape — payload field holds scheme-specific data */
const PaymentPayloadSchema = z
  .object({
    x402Version: z.number().optional(),
    resource: z.record(z.string(), z.unknown()).optional(),
    accepted: z.record(z.string(), z.unknown()).optional(),
    payload: z.record(z.string(), z.unknown()),
  })
  .passthrough();

/** Minimal PaymentRequirements shape */
const PaymentRequirementsSchema = z
  .object({
    scheme: z.string(),
    network: z.string(),
    asset: z.string(),
    amount: z.string(),
    payTo: z.string(),
    maxTimeoutSeconds: z.number().optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const VerifyBodySchema = z.object({
  paymentPayload: PaymentPayloadSchema,
  paymentRequirements: PaymentRequirementsSchema,
});

const SettleBodySchema = z.object({
  paymentPayload: PaymentPayloadSchema,
  paymentRequirements: PaymentRequirementsSchema,
});

// ---------------------------------------------------------------------------
// Helper: extract base64-encoded signed transaction from payload
//
// The x402 exact-svm scheme places the transaction bytes inside
// paymentPayload.payload. Common field names observed: "transaction",
// "signedTransaction". We try both.
// ---------------------------------------------------------------------------

function extractSignedTransaction(payload: Record<string, unknown>): string | null {
  const candidate =
    typeof payload['signedTransaction'] === 'string'
      ? payload['signedTransaction']
      : typeof payload['transaction'] === 'string'
        ? payload['transaction']
        : null;

  return candidate;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const koraFacilitatorRoutes = new Hono();

// ---------------------------------------------------------------------------
// GET /x402/supported
// ---------------------------------------------------------------------------
//
// Called by x402ResourceServer.initialize() to discover supported payment
// schemes. We return an exact-amount Solana scheme with USDC.
//
// Response shape expected by @x402/core:
//   { schemes: { exact: { "<caip2-chain>": { tokens: ["<mint>"] } } } }
//
// We attempt to fetch the supported token list from Kora first. If Kora
// is unreachable, we fall back to our hardcoded USDC mint.
// ---------------------------------------------------------------------------

koraFacilitatorRoutes.get('/supported', async (c) => {
  const chainId = resolveChainId();
  const fallbackMint = resolveUsdcMint();

  let tokens: string[] = [fallbackMint];

  // Try Kora for live token list — silently fall back on any error
  if (isKoraConfigured()) {
    try {
      const koraMints = await koraGetSupportedTokens();
      if (koraMints.length > 0) {
        tokens = koraMints;
        logger.info('kora-facilitator-bridge: supported tokens loaded from Kora', {
          count: tokens.length,
          chainId,
        });
      }
    } catch (err) {
      logger.warn('kora-facilitator-bridge: could not fetch Kora supported tokens — using fallback', {
        error: err instanceof Error ? err.message : String(err),
        fallback: fallbackMint,
      });
    }
  }

  return c.json({
    schemes: {
      exact: {
        [chainId]: {
          tokens,
        },
      },
    },
  });
});

// ---------------------------------------------------------------------------
// POST /x402/verify
// ---------------------------------------------------------------------------
//
// Validates a payment payload before settlement. Runs governance checks:
//   1. Token mint is on the USDC allowlist
//   2. Recipient is the platform treasury (if configured)
//   3. Amount does not exceed the per-transaction cap
//
// Returns { isValid: true } on success or { isValid: false, invalidReason }
// on governance failure. This matches the VerifyResponse shape expected by
// @x402/core facilitator clients.
// ---------------------------------------------------------------------------

koraFacilitatorRoutes.post(
  '/verify',
  zValidator('json', VerifyBodySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          isValid: false,
          invalidReason: 'VALIDATION_ERROR',
          invalidMessage: result.error.message,
        },
        400
      );
    }
  }),
  async (c) => {
    const { paymentPayload, paymentRequirements } = c.req.valid('json');

    const config = buildGovernanceConfig();

    const govCheck = runBridgeGovernanceChecks(
      {
        mint: paymentRequirements.asset,
        recipient: paymentRequirements.payTo,
        amount: paymentRequirements.amount,
      },
      config
    );

    if (!govCheck.allowed) {
      logger.warn('kora-facilitator-bridge: verify governance check failed', {
        reason: govCheck.reason,
        asset: paymentRequirements.asset,
        payTo: paymentRequirements.payTo,
        amount: paymentRequirements.amount,
      });
      return c.json({
        isValid: false,
        invalidReason: govCheck.reason,
      });
    }

    logger.info('kora-facilitator-bridge: verify passed', {
      asset: paymentRequirements.asset,
      amount: paymentRequirements.amount,
      payTo: paymentRequirements.payTo,
      x402Version: paymentPayload.x402Version,
    });

    return c.json({ isValid: true });
  }
);

// ---------------------------------------------------------------------------
// POST /x402/settle
// ---------------------------------------------------------------------------
//
// Executes settlement via Kora's gasless infrastructure. Steps:
//   1. Re-run governance checks (defense in depth — never trust /verify alone)
//   2. Extract signed transaction from paymentPayload.payload
//   3. Submit to Kora for co-signing (gas fee) and on-chain submission
//   4. Return { success: true, txHash } on success
//
// Error response shapes:
//   { success: false, errorReason: 'GOVERNANCE_FAILED', errorMessage: string }
//   { success: false, errorReason: 'SETTLEMENT_FAILED', errorMessage: string }
//   { success: false, errorReason: 'INVALID_PAYLOAD', errorMessage: string }
// ---------------------------------------------------------------------------

koraFacilitatorRoutes.post(
  '/settle',
  zValidator('json', SettleBodySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          errorReason: 'VALIDATION_ERROR',
          errorMessage: result.error.message,
        },
        400
      );
    }
  }),
  async (c) => {
    const { paymentPayload, paymentRequirements } = c.req.valid('json');

    // Step 1 — Governance checks (defense in depth)
    const config = buildGovernanceConfig();

    const govCheck = runBridgeGovernanceChecks(
      {
        mint: paymentRequirements.asset,
        recipient: paymentRequirements.payTo,
        amount: paymentRequirements.amount,
      },
      config
    );

    if (!govCheck.allowed) {
      logger.warn('kora-facilitator-bridge: settle governance check failed', {
        reason: govCheck.reason,
        asset: paymentRequirements.asset,
        payTo: paymentRequirements.payTo,
        amount: paymentRequirements.amount,
      });
      return c.json({
        success: false,
        errorReason: 'GOVERNANCE_FAILED',
        errorMessage: govCheck.reason,
      });
    }

    // Step 2 — Extract signed transaction
    const signedTransaction = extractSignedTransaction(paymentPayload.payload);

    if (!signedTransaction) {
      logger.error('kora-facilitator-bridge: no signed transaction found in payload', {
        payloadKeys: Object.keys(paymentPayload.payload),
      });
      return c.json({
        success: false,
        errorReason: 'INVALID_PAYLOAD',
        errorMessage: 'No signed transaction found in paymentPayload.payload (expected "signedTransaction" or "transaction" field)',
      });
    }

    // Step 3 — Check Kora is configured before attempting settlement
    if (!isKoraConfigured()) {
      logger.error('kora-facilitator-bridge: Kora not configured — settlement cannot proceed', {
        hint: 'Set KORA_RPC_URL to enable Kora gasless settlement',
      });
      return c.json({
        success: false,
        errorReason: 'SETTLEMENT_FAILED',
        errorMessage: 'Kora gasless settlement is not configured (KORA_RPC_URL missing)',
      });
    }

    // Step 4 — Submit to Kora
    try {
      const { signature } = await koraSignAndSend(signedTransaction);

      logger.info('kora-facilitator-bridge: settlement successful', {
        txSignature: signature,
        asset: paymentRequirements.asset,
        amount: paymentRequirements.amount,
        payTo: paymentRequirements.payTo,
      });

      return c.json({
        success: true,
        txHash: signature,
        // Provide "transaction" for SettleResponse compatibility with @x402/core
        transaction: signature,
        network: paymentRequirements.network,
      });
    } catch (err) {
      // Log full error internally (may contain KORA_RPC_URL in connection errors)
      // but return an opaque message to the caller to prevent URL disclosure.
      const internalMessage = err instanceof Error ? err.message : String(err);

      logger.error('kora-facilitator-bridge: Kora settlement failed', {
        error: internalMessage,
        asset: paymentRequirements.asset,
        amount: paymentRequirements.amount,
        payTo: paymentRequirements.payTo,
      });

      return c.json({
        success: false,
        errorReason: 'SETTLEMENT_FAILED',
        errorMessage: 'Kora settlement service unavailable',
      });
    }
  }
);
