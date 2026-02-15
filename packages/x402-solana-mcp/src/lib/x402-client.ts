import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  encodePaymentSignatureHeader,
} from '@x402/core/http';
import {
  isPaymentRequired,
  isPaymentRequiredV1,
  isPaymentRequiredV2,
  validatePaymentRequired,
} from '@x402/core/schemas';
import { validateSvmAddress } from '@x402/svm';
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed payment requirement from a 402 response. */
export interface ParsedPaymentRequirement {
  /** x402 protocol version (1 or 2). */
  version: number;
  /** Payment scheme (e.g., "exact"). */
  scheme: string;
  /** Network in CAIP-2 format (e.g., "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"). */
  network: string;
  /** Amount in base units (string to preserve precision). */
  amount: string;
  /** Token mint/asset address. */
  asset: string;
  /** Recipient address. */
  payTo: string;
  /** Maximum timeout in seconds. */
  maxTimeoutSeconds: number;
  /** The full original PaymentRequired object for facilitator submission. */
  raw: unknown;
}

/** Result of an x402 HTTP request. */
export type X402RequestResult =
  | { paymentRequired: false; response: Response }
  | { paymentRequired: true; requirements: ParsedPaymentRequirement[]; rawPaymentRequired: unknown };

/** Result of a paid retry with payment proof. */
export interface PaidResponse {
  response: Response;
  settled: boolean;
  transactionSignature?: string;
  network?: string;
  payer?: string;
}

// ---------------------------------------------------------------------------
// x402 HTTP Client
// ---------------------------------------------------------------------------

/**
 * Makes an HTTP request. If the response is 402, parses x402 payment requirements.
 * If not 402, returns the response directly.
 *
 * Supports both V2 (X-Payment-Required header, base64 JSON) and V1 (individual
 * X-PAYMENT-* headers) formats.
 */
export async function makeX402Request(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  } = {},
): Promise<X402RequestResult> {
  const controller = new AbortController();
  const timeout = options.timeoutMs ?? 10_000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });

    if (response.status !== 402) {
      return { paymentRequired: false, response };
    }

    // Parse 402 response — try body first, then V2 header, then V1 header fallback
    const requirements = await parsePaymentRequiredResponse(response);
    return {
      paymentRequired: true,
      requirements,
      rawPaymentRequired: requirements.length > 0 ? requirements[0].raw : null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retries an HTTP request with x402 payment proof headers.
 * The payment signature is encoded per the x402 protocol.
 */
export async function retryWithPayment(
  url: string,
  paymentPayload: unknown,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  } = {},
): Promise<PaidResponse> {
  const controller = new AbortController();
  const timeout = options.timeoutMs ?? 10_000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    // Encode payment proof into headers (send both V2 and V1 for compatibility)
    const paymentHeader = encodePaymentSignatureHeader(
      paymentPayload as Parameters<typeof encodePaymentSignatureHeader>[0],
    );

    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        ...options.headers,
        'Payment-Signature': paymentHeader,      // V2
        'X-Payment-Signature': paymentHeader,    // V1 fallback
      },
      body: options.body,
      signal: controller.signal,
    });

    // Try to parse settlement response from headers
    let settled = false;
    let transactionSignature: string | undefined;
    let network: string | undefined;
    let payer: string | undefined;

    try {
      // Try V2 header first, fall back to V1
      const responseHeader =
        response.headers.get('Payment-Response') ??
        response.headers.get('X-Payment-Response') ??
        '';
      const settleResponse = decodePaymentResponseHeader(responseHeader);
      settled = settleResponse.success;
      transactionSignature = settleResponse.transaction;
      network = settleResponse.network;
      payer = settleResponse.payer;
    } catch {
      // Settlement headers may not be present on all responses
      settled = response.ok;
    }

    return { response, settled, transactionSignature, network, payer };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Header Parsing
// ---------------------------------------------------------------------------

/**
 * Parses payment requirements from a 402 response.
 *
 * Parsing order:
 *   1. Response body JSON (standard x402 format — most servers use this)
 *   2. V2 header (X-Payment-Required, base64 JSON)
 *   3. V1 headers (individual X-Payment-* headers)
 */
async function parsePaymentRequiredResponse(response: Response): Promise<ParsedPaymentRequirement[]> {
  // Try body first: standard x402 JSON body (most common format)
  try {
    const body = await response.json();
    if (body && typeof body === 'object' && body.x402Version && body.accepts) {
      const reqs = extractRequirements(body);
      if (reqs.length > 0) return reqs;
    }
  } catch {
    // Body not JSON — fall through to header parsing
  }

  // Try V2: single base64-encoded JSON header (check both V2 and V1 header names)
  const v2Header =
    response.headers.get('Payment-Required') ??
    response.headers.get('X-Payment-Required');
  if (v2Header) {
    try {
      const decoded = decodePaymentRequiredHeader(v2Header);
      if (isPaymentRequired(decoded)) {
        return extractRequirements(decoded);
      }
    } catch {
      // Fall through to V1
    }
  }

  // Try V1: individual X-PAYMENT-* headers
  const amount = response.headers.get('X-Payment-Amount');
  const recipient = response.headers.get('X-Payment-Recipient') ?? response.headers.get('X-Payment-PayTo');
  const token = response.headers.get('X-Payment-Token') ?? response.headers.get('X-Payment-Asset');
  const network = response.headers.get('X-Payment-Network');

  if (amount && recipient) {
    const v1Requirement: ParsedPaymentRequirement = {
      version: 1,
      scheme: 'exact',
      network: network ?? 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      amount,
      asset: token ?? '',
      payTo: recipient,
      maxTimeoutSeconds: 30,
      raw: {
        x402Version: 1,
        amount,
        recipient,
        token: token ?? '',
        network: network ?? 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
      },
    };
    return [v1Requirement];
  }

  return [];
}

/**
 * Extracts individual requirements from a PaymentRequired response.
 */
function extractRequirements(paymentRequired: unknown): ParsedPaymentRequirement[] {
  const pr = paymentRequired as Record<string, unknown>;

  if (isPaymentRequiredV2(pr)) {
    const accepts = pr.accepts as Array<Record<string, unknown>>;
    return accepts.map((req) => ({
      version: 2,
      scheme: (req.scheme as string) ?? 'exact',
      network: req.network as string,
      amount: req.amount as string,
      asset: req.asset as string,
      payTo: req.payTo as string,
      maxTimeoutSeconds: (req.maxTimeoutSeconds as number) ?? 30,
      raw: paymentRequired,
    }));
  }

  if (isPaymentRequiredV1(pr)) {
    // V1 has an `accepts` array with requirement objects
    const accepts = (pr as Record<string, unknown>).accepts as Array<Record<string, unknown>> | undefined;
    if (accepts && accepts.length > 0) {
      return accepts.map((req) => ({
        version: 1,
        scheme: (req.scheme as string) ?? 'exact',
        network: (req.network as string) ?? '',
        amount: (req.maxAmountRequired as string) ?? (req.amount as string) ?? '',
        asset: (req.asset as string) ?? '',
        payTo: (req.payTo as string) ?? '',
        maxTimeoutSeconds: (req.maxTimeoutSeconds as number) ?? 30,
        raw: paymentRequired,
      }));
    }
    return [];
  }

  return [];
}

/**
 * Validates that a payment requirement is compatible with our agent's network and capabilities.
 */
export function validateRequirement(
  req: ParsedPaymentRequirement,
  expectedNetwork: string,
): string | null {
  if (!req.amount || req.amount === '0') {
    return 'Payment amount is zero or missing';
  }

  if (!req.payTo) {
    return 'Payment recipient is missing';
  }

  if (req.payTo && !validateSvmAddress(req.payTo)) {
    return `Invalid recipient address: ${req.payTo}`;
  }

  if (req.network && !req.network.startsWith('solana:')) {
    return `Unsupported network: ${req.network} (expected Solana)`;
  }

  if (expectedNetwork && req.network && req.network !== expectedNetwork) {
    return `Network mismatch: expected ${expectedNetwork}, got ${req.network}`;
  }

  return null;
}
