# x402-facilitator Deployment

Deployment configuration for the `@ozskr/x402-facilitator` service.

## Deployment Options

### Option 1: Docker (recommended for staging/production)

```bash
cd packages/x402-facilitator
docker compose up -d
```

Uses the `Dockerfile` and `docker-compose.yml` in the package directory.
See `packages/x402-facilitator/.env.example` for all environment variables.

### Option 2: Node.js Direct

```bash
cd packages/x402-facilitator
pnpm build
node dist/cli.js
```

### Option 3: Railway

1. Create a new Railway service
2. Set root directory to `packages/x402-facilitator`
3. Set build command: `pnpm build`
4. Set start command: `node dist/cli.js`
5. Add environment variables from `.env.example`
6. Deploy

### Option 4: Cloudflare Workers (future)

Requires Hono adapter migration from `@hono/node-server` to `@hono/cloudflare-workers`.
Not yet implemented. Tracked for Phase 8.

## Environment Variables

See `packages/x402-facilitator/.env.example` for the complete list.

**Required:**
- `SOLANA_RPC_URL` - Helius or other Solana RPC endpoint
- `FACILITATOR_KEYPAIR_PATH` - Path to encrypted fee-payer keypair
- `FACILITATOR_PASSPHRASE` - Decryption passphrase (min 12 chars)

**Governance (all default to disabled):**
- `OFAC_ENABLED` - OFAC/SDN screening
- `CIRCUIT_BREAKER_ENABLED` - Velocity-based circuit breaker
- `DELEGATION_CHECK_ENABLED` - On-chain delegation validation
- `BUDGET_ENFORCE_ENABLED` - Cumulative budget enforcement

## MCP Server Integration

The MCP server (`@ozskr/x402-solana-mcp`) connects to the facilitator via:

```bash
X402_FACILITATOR_URL=http://localhost:4020        # Local facilitator
X402_FACILITATOR_FALLBACK_URL=https://facilitator.payai.network  # PayAI fallback
```

Fallback chain: ozskr facilitator -> PayAI -> error.

## Health Check

```bash
curl http://localhost:4020/health
```

Returns governance module status, gas balance, and replay guard size.
