// ---------------------------------------------------------------------------
// x402 Payment Middleware for Hono
// ---------------------------------------------------------------------------
//
// Wraps @x402/hono paymentMiddleware with:
//   - Solana (SVM) ExactSvmScheme for USDC payment verification
//   - Per-service route configuration derived from SERVICE_PRICES
//   - ENABLE_X402_BILLING=false bypass for development/testing
//   - Structured logging on payment gate decisions
//
// SECURITY:
//   - PLATFORM_TREASURY_ADDRESS is the USDC recipient — must never be
//     client-controlled; it is read from env at middleware construction time
//   - All payment verification runs server-side via the facilitator
//   - No private keys are touched here (read-only verification path)
//   - Transaction simulation is enforced by the facilitator before settlement

import { createMiddleware } from 'hono/factory';
import type { MiddlewareHandler } from 'hono';
import { paymentMiddleware, x402ResourceServer } from '@x402/hono';
import { HTTPFacilitatorClient } from '@x402/core/server';
import type { Network } from '@x402/core/types';
import { ExactSvmScheme } from '@x402/svm/exact/server';
import { logger } from '@/lib/utils/logger';
import type { ServicePrice } from './service-pricing';

// ---------------------------------------------------------------------------
// Network constants
// ---------------------------------------------------------------------------

/** CAIP-2 network identifier for Solana mainnet */
const SOLANA_MAINNET_CAIP2: Network = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

/** CAIP-2 network identifier for Solana devnet */
const SOLANA_DEVNET_CAIP2: Network = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

/**
 * Resolve the active Solana CAIP-2 network identifier from environment.
 * Defaults to devnet to fail safe during development.
 */
function resolveNetwork(): Network {
  const network =
    process.env.NEXT_PUBLIC_SOLANA_NETWORK ??
    process.env.SOLANA_NETWORK ??
    'devnet';
  return network === 'mainnet-beta' ? SOLANA_MAINNET_CAIP2 : SOLANA_DEVNET_CAIP2;
}

// ---------------------------------------------------------------------------
// Billing bypass (development / CI)
// ---------------------------------------------------------------------------

/**
 * Returns true when x402 billing is enabled.
 *
 * Set ENABLE_X402_BILLING=false to bypass the payment gate entirely.
 * Defaults to enabled (true) to fail safe — missing var keeps billing on.
 */
export function isBillingEnabled(): boolean {
  return process.env.ENABLE_X402_BILLING !== 'false';
}

// ---------------------------------------------------------------------------
// Passthrough middleware (billing disabled)
// ---------------------------------------------------------------------------

/** No-op Hono middleware used when ENABLE_X402_BILLING=false */
const passthroughMiddleware: MiddlewareHandler = createMiddleware(async (_c, next) => {
  await next();
});

// ---------------------------------------------------------------------------
// Shared resource server (one per process — constructed lazily)
// ---------------------------------------------------------------------------

// Cache the resource server to avoid re-constructing on every request.
// The server holds a connection to the facilitator, so it should be reused.
let _resourceServer: x402ResourceServer | null = null;
let _resourceServerNetwork: Network | null = null;

/**
 * Get or construct the shared x402ResourceServer.
 * Re-creates if the configured network changes (e.g., during tests).
 */
function getResourceServer(network: Network, facilitatorUrl: string): x402ResourceServer {
  if (_resourceServer && _resourceServerNetwork === network) {
    return _resourceServer;
  }

  const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
  _resourceServer = new x402ResourceServer(facilitatorClient).register(
    network,
    new ExactSvmScheme()
  );
  _resourceServerNetwork = network;

  return _resourceServer;
}

// ---------------------------------------------------------------------------
// x402 middleware factory
// ---------------------------------------------------------------------------

/**
 * Build the x402 payment middleware for a specific service endpoint.
 *
 * When ENABLE_X402_BILLING=false this returns a no-op passthrough middleware.
 * Otherwise it builds a live x402 payment gate using:
 *   - ExactSvmScheme (Solana USDC exact-amount payment scheme)
 *   - HTTPFacilitatorClient pointing at X402_FACILITATOR_URL (ozskr's own
 *     facilitator) or the public x402.org facilitator as network-level fallback
 *   - PLATFORM_TREASURY_ADDRESS as the USDC payTo recipient
 *
 * The x402 middleware handles:
 *   1. Returning HTTP 402 with payment requirements when X-Payment header absent
 *   2. Verifying payment proof in the X-Payment header via the facilitator
 *   3. Passing through to the route handler when payment is valid
 *   4. Settling the payment with the facilitator after a successful response
 *
 * @param price - ServicePrice record for the endpoint being protected
 * @param httpMethod - HTTP verb in uppercase (POST, GET, etc.)
 * @param path - Full route path including /api prefix (e.g., '/api/services/image-generate')
 */
export function buildX402Middleware(
  price: ServicePrice,
  httpMethod: string,
  path: string
): MiddlewareHandler {
  if (!isBillingEnabled()) {
    logger.info('x402 billing disabled — passthrough active', {
      serviceId: price.serviceId,
    });
    return passthroughMiddleware;
  }

  const treasuryAddress = process.env.PLATFORM_TREASURY_ADDRESS;

  if (!treasuryAddress) {
    // PLATFORM_TREASURY_ADDRESS is required when billing is enabled.
    // Fail closed (503) rather than open — a misconfigured deploy must not
    // grant free access to paid AI endpoints.
    logger.error('PLATFORM_TREASURY_ADDRESS not set — refusing to serve paid endpoint', {
      serviceId: price.serviceId,
      path,
    });
    return createMiddleware(async (c) => {
      return c.json(
        { error: 'Service temporarily unavailable', code: 'MISCONFIGURED' },
        503
      );
    });
  }

  const facilitatorUrl =
    process.env.X402_FACILITATOR_URL ?? 'https://facilitator.x402.org';

  const network = resolveNetwork();

  // Route key must match the format expected by @x402/hono: "METHOD /path"
  const routeKey = `${httpMethod.toUpperCase()} ${path}`;

  try {
    const server = getResourceServer(network, facilitatorUrl);

    const middleware = paymentMiddleware(
      {
        [routeKey]: {
          accepts: {
            scheme: 'exact',
            // x402 price strings use "$" prefix (e.g. "$0.10")
            price: `$${price.priceUsdc.toFixed(2)}`,
            network,
            payTo: treasuryAddress,
            // Allow up to 5 minutes for the payment transaction to be finalized
            maxTimeoutSeconds: 300,
          },
          description: price.description,
        },
      },
      server,
      // paywallConfig — undefined: no browser paywall UI in API context
      undefined,
      // paywall — undefined: use default x402 paywall provider
      undefined,
      // syncFacilitatorOnStart = false: avoid slow cold-start on Vercel
      false
    );

    logger.info('x402 payment gate configured', {
      serviceId: price.serviceId,
      routeKey,
      network,
      priceUsdc: price.priceUsdc,
      facilitatorUrl,
    });

    return middleware;
  } catch (err) {
    // If x402 infrastructure fails to initialize, fail closed (503) not open.
    // A broken payment gate must never grant free access.
    logger.error('Failed to initialize x402 payment middleware — returning 503', {
      serviceId: price.serviceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return createMiddleware(async (c) => {
      return c.json(
        { error: 'Service temporarily unavailable', code: 'PAYMENT_GATE_ERROR' },
        503
      );
    });
  }
}
