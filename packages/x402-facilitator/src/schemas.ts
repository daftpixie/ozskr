import { z } from 'zod';

// ---------------------------------------------------------------------------
// x402 Request Body Schemas
// ---------------------------------------------------------------------------

/**
 * Schema for payment payload in x402 verify/settle requests.
 * Validates structure without deeply constraining x402-internal fields.
 */
const PaymentPayloadSchema = z.object({
  x402Version: z.number().optional(),
  resource: z.record(z.unknown()).optional(),
  accepted: z.record(z.unknown()).optional(),
  payload: z.record(z.unknown()),
}).passthrough();

/**
 * Schema for payment requirements in x402 verify/settle requests.
 */
const PaymentRequirementsSchema = z.object({
  scheme: z.string(),
  network: z.string(),
  asset: z.string(),
  amount: z.string(),
  payTo: z.string(),
  maxTimeoutSeconds: z.number().optional(),
  extra: z.record(z.unknown()).optional(),
}).passthrough();

export const VerifyRequestSchema = z.object({
  paymentPayload: PaymentPayloadSchema,
  paymentRequirements: PaymentRequirementsSchema,
});

export const SettleRequestSchema = z.object({
  paymentPayload: PaymentPayloadSchema,
  paymentRequirements: PaymentRequirementsSchema,
});

export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;
export type SettleRequest = z.infer<typeof SettleRequestSchema>;
