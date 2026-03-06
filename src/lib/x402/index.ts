// ---------------------------------------------------------------------------
// x402 module — public surface
// ---------------------------------------------------------------------------

export { getFacilitatorConfig, getFacilitatorConfigOptional } from './facilitator-config';
export type { FacilitatorConfig } from './facilitator-config';

export { SERVICE_PRICES, getServicePrice } from './service-pricing';
export type { ServicePrice } from './service-pricing';

export { buildX402Middleware, isBillingEnabled } from './server-middleware';
