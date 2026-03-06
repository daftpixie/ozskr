// ---------------------------------------------------------------------------
// x402 Service Pricing Registry
// ---------------------------------------------------------------------------
//
// Defines per-service USDC prices for x402-gated AI endpoints.
// Prices are set in USDC with the corresponding USDC base unit (6 decimals)
// represented as priceLamports (bigint) for on-chain payment requirements.
//
// platformCostUsdc reflects the estimated pass-through cost to the external
// provider (fal.ai, Anthropic). The markup covers infrastructure and margin.

export interface ServicePrice {
  serviceId: string;
  name: string;
  description: string;
  /** Price charged to the caller in USDC (e.g., 0.10 = $0.10) */
  priceUsdc: number;
  /** priceUsdc * 1_000_000n — USDC base units (6 decimals) */
  priceLamports: bigint;
  /** External provider that fulfills this request */
  externalProvider: string;
  /** Estimated cost to the platform in USDC */
  platformCostUsdc: number;
  /** Whether this service is currently accepting payments */
  enabled: boolean;
}

export const SERVICE_PRICES: Record<string, ServicePrice> = {
  'image-generate': {
    serviceId: 'image-generate',
    name: 'AI Image Generation',
    description: 'Generate an image from text prompt via fal-ai/flux/schnell',
    priceUsdc: 0.10,
    priceLamports: 100_000n,
    externalProvider: 'fal.ai',
    platformCostUsdc: 0.04,
    enabled: true,
  },
  'image-generate-pro': {
    serviceId: 'image-generate-pro',
    name: 'AI Image Generation (Pro)',
    description: 'Generate a high-res image via fal-ai/flux/dev',
    priceUsdc: 0.15,
    priceLamports: 150_000n,
    externalProvider: 'fal.ai',
    platformCostUsdc: 0.08,
    enabled: true,
  },
  'image-edit': {
    serviceId: 'image-edit',
    name: 'AI Image Edit',
    description: 'Edit images via fal-ai/flux/dev/image-to-image',
    priceUsdc: 0.12,
    priceLamports: 120_000n,
    externalProvider: 'fal.ai',
    platformCostUsdc: 0.08,
    enabled: true,
  },
  'text-generate': {
    serviceId: 'text-generate',
    name: 'AI Text Generation',
    description: 'Generate text content via Claude Sonnet',
    priceUsdc: 0.02,
    priceLamports: 20_000n,
    externalProvider: 'anthropic',
    platformCostUsdc: 0.006,
    enabled: true,
  },
};

/**
 * Look up a service price by service ID.
 * Returns null if the service ID is unknown or the service is disabled.
 */
export function getServicePrice(serviceId: string): ServicePrice | null {
  const price = SERVICE_PRICES[serviceId];
  return price?.enabled ? price : null;
}
