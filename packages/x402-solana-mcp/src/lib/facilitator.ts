// ---------------------------------------------------------------------------
// Facilitator Integration — CDP Primary + PayAI Fallback
// ---------------------------------------------------------------------------

/** Settlement result from a facilitator. */
export interface SettlementResult {
  success: boolean;
  transactionSignature: string;
  network: string;
  payer?: string;
  facilitator: string;
  errorReason?: string;
  errorMessage?: string;
}

/** Facilitator endpoint configuration. */
interface FacilitatorEndpoint {
  name: string;
  url: string;
  settlePath: string;
}

/** Default CDP facilitator URL — can be overridden via config. */
const DEFAULT_CDP_URL = 'https://x402.org/facilitator';

/** Default PayAI facilitator URL — can be overridden via config. */
const DEFAULT_PAYAI_URL = 'https://facilitator.payai.network';

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_RETRIES = 2;

/**
 * Submits a signed payment payload to a facilitator for settlement.
 *
 * Tries the primary facilitator first. If it fails or times out, falls back
 * to the fallback facilitator. Each attempt has a 5s timeout and up to 2
 * retries per facilitator.
 *
 * Facilitator URLs are configurable via the `primaryUrl` and `fallbackUrl`
 * parameters (sourced from X402_FACILITATOR_URL and X402_FACILITATOR_FALLBACK_URL
 * environment variables). Defaults to CDP primary + PayAI fallback.
 *
 * @param paymentPayload - The signed payment payload (x402 format)
 * @param paymentRequirements - The accepted payment requirements
 * @param primaryUrl - Optional primary facilitator URL (defaults to CDP)
 * @param fallbackUrl - Optional fallback facilitator URL (defaults to PayAI)
 * @returns Settlement result with transaction signature
 */
export async function submitToFacilitator(
  paymentPayload: unknown,
  paymentRequirements: unknown,
  primaryUrl?: string,
  fallbackUrl?: string,
): Promise<SettlementResult> {
  const primary: FacilitatorEndpoint = {
    name: primaryUrl ? 'custom' : 'cdp',
    url: primaryUrl ?? DEFAULT_CDP_URL,
    settlePath: '/settle',
  };

  const fallback: FacilitatorEndpoint = {
    name: fallbackUrl ? 'custom-fallback' : 'payai',
    url: fallbackUrl ?? DEFAULT_PAYAI_URL,
    settlePath: '/settle',
  };

  // Try primary first, then fallback
  try {
    return await attemptSettle(primary, paymentPayload, paymentRequirements);
  } catch (primaryError) {
    try {
      return await attemptSettle(fallback, paymentPayload, paymentRequirements);
    } catch (fallbackError) {
      // Both facilitators failed — return the more informative error
      throw new FacilitatorError(
        `All facilitators failed. ${primary.name}: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}. ${fallback.name}: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
      );
    }
  }
}

/**
 * Attempts to settle with a single facilitator, with retries.
 */
async function attemptSettle(
  endpoint: FacilitatorEndpoint,
  paymentPayload: unknown,
  paymentRequirements: unknown,
): Promise<SettlementResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await settleOnce(endpoint, paymentPayload, paymentRequirements);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on 4xx errors (client-side issues won't be fixed by retrying)
      if (lastError instanceof FacilitatorError && lastError.statusCode && lastError.statusCode >= 400 && lastError.statusCode < 500) {
        throw lastError;
      }

      // Wait briefly before retrying (exponential backoff: 500ms, 1000ms)
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new FacilitatorError('Settlement failed after retries');
}

/**
 * Single settlement attempt against a facilitator endpoint.
 */
async function settleOnce(
  endpoint: FacilitatorEndpoint,
  paymentPayload: unknown,
  paymentRequirements: unknown,
): Promise<SettlementResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const settleUrl = `${endpoint.url}${endpoint.settlePath}`;

    const response = await fetch(settleUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload,
        paymentRequirements,
      }),
      signal: controller.signal,
    });

    const body = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      throw new FacilitatorError(
        (body.errorMessage as string) ?? (body.message as string) ?? `HTTP ${response.status}`,
        response.status,
      );
    }

    if (body.success === false) {
      throw new FacilitatorError(
        (body.errorMessage as string) ?? (body.errorReason as string) ?? 'Settlement rejected',
        response.status,
      );
    }

    return {
      success: true,
      transactionSignature: (body.transaction as string) ?? '',
      network: (body.network as string) ?? '',
      payer: body.payer as string | undefined,
      facilitator: endpoint.name,
    };
  } catch (error) {
    if (error instanceof FacilitatorError) throw error;

    if (error instanceof Error && error.name === 'AbortError') {
      throw new FacilitatorError(`Timeout after ${DEFAULT_TIMEOUT_MS}ms connecting to ${endpoint.name}`);
    }

    throw new FacilitatorError(
      `Failed to connect to ${endpoint.name}: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Error Class
// ---------------------------------------------------------------------------

export class FacilitatorError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'FacilitatorError';
    this.statusCode = statusCode;
  }
}
