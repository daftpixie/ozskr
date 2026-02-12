---
paths:
  - "src/app/api/**/*.ts"
  - "src/lib/api/**/*.ts"
---

# API Route Rules

## Validation

- Every route handler MUST use `zValidator` from `@hono/zod-validator`
- Input schemas defined adjacent to route files: `route.schema.ts`
- Type inference via `z.infer<typeof schema>` — no manual interface duplication
- All response types must also have Zod schemas for documentation and testing

## Error Handling

- All errors follow the contract: `{ error: string, code: string, details?: unknown }`
- Standard codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMITED`, `INTERNAL_ERROR`, `UPSTREAM_ERROR`
- Never expose internal error details (stack traces, SQL errors) in production responses
- Log full error context server-side via structured logger

## Authentication

- All non-public routes MUST verify JWT from SIWS auth
- Wallet address extracted from JWT, never from request body/params
- Session validation middleware applied to all protected route groups

## Solana Endpoints

- All Solana-related API endpoints are READ-ONLY — never sign transactions server-side
- Transaction building data (quotes, estimates, account info) served to the client
- Client handles signing and submission via wallet adapter

## Rate Limiting

- Rate limit middleware applied per-route-group with appropriate limits
- Use `@upstash/ratelimit` with per-wallet keying
- Include `Retry-After` header on 429 responses

## SSE Streaming

- SSE endpoints include: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- Use Hono's streaming response helpers
- Clean up connections on client disconnect
