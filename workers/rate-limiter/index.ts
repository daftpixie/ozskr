/**
 * Edge Rate Limiter Worker (Stub)
 *
 * Intended architecture:
 * 1. Extract JWT from Authorization header
 * 2. Derive wallet address from JWT claims
 * 3. Check rate limit via Upstash Redis (@upstash/ratelimit)
 * 4. Forward request to origin or return 429
 *
 * Actual implementation deferred to Sprint 2.
 * This stub passes through all requests unchanged.
 */

export interface Env {
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    // Stub: pass through all requests to origin
    return fetch(request);
  },
};
