# Production Deployment Guide

## Architecture

```
                    ┌──────────────┐
                    │  Cloudflare  │  Edge rate limiting
                    │   Workers    │  (future: SIWS verify)
                    └──────┬───────┘
                           │
              ┌────────────▼────────────┐
              │       Vercel            │
              │  Next.js 15 + Hono API  │  Frontend + API
              │  ozskr.ai              │
              └──┬────────┬────────┬───┘
                 │        │        │
    ┌────────────▼┐  ┌────▼─────┐  ┌▼───────────┐
    │  Supabase   │  │ Trigger  │  │ External   │
    │  PostgreSQL │  │  .dev    │  │ APIs       │
    │  + RLS      │  │ (Railway)│  │            │
    └─────────────┘  └──────────┘  └────────────┘
                                    Claude, Jupiter,
                                    Ayrshare, Twitter,
                                    Mem0, fal.ai
```

## Priority 1: Vercel — Next.js + API

The Hono API runs as a Next.js catch-all route (`/api/[[...route]]`), so a single Vercel deployment serves both frontend and API.

### Setup

1. **Connect repo**: Go to [vercel.com/new](https://vercel.com/new), import `daftpixie/ozskr`
2. **Framework**: Auto-detected as Next.js
3. **Settings** (override if needed):
   - Build command: `pnpm build`
   - Install command: `pnpm install --frozen-lockfile`
   - Output directory: `.next`
   - Node.js version: 20.x

### Environment Variables

Set in Vercel dashboard > Project > Settings > Environment Variables.

**Client-side (NEXT_PUBLIC_):**

| Variable | Example | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase anon/public key |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` | `devnet` or `mainnet-beta` |
| `NEXT_PUBLIC_HELIUS_RPC_URL` | `https://devnet.helius-rpc.com/?api-key=...` | Helius RPC |
| `NEXT_PUBLIC_APP_URL` | `https://ozskr.ai` | Used for CORS |
| `NEXT_PUBLIC_HOPE_MINT` | `HoPE...` | $HOPE token mint address |

**Server-side:**

| Variable | Notes |
|----------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role JWT (never exposed to client) |
| `JWT_SECRET` | Session signing key |
| `ANTHROPIC_API_KEY` | Claude API |
| `OPENAI_API_KEY` | OpenAI (fallback models) |
| `MEM0_API_KEY` | Mem0 memory service |
| `FAL_KEY` | fal.ai image generation |
| `AYRSHARE_API_KEY` | Social publishing |
| `TWITTER_CLIENT_ID` | Twitter OAuth 2.0 client ID |
| `TWITTER_TOKEN_ENCRYPTION_KEY` | 32+ char key for pgcrypto |
| `LANGFUSE_SECRET_KEY` | Langfuse observability |
| `LANGFUSE_PUBLIC_KEY` | Langfuse observability |
| `LANGFUSE_BASEURL` | Langfuse endpoint |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `INFISICAL_CLIENT_ID` | Infisical secrets (optional) |
| `INFISICAL_CLIENT_SECRET` | Infisical secrets (optional) |

### Preview Deploys

Automatic on every PR. Preview deployments use the same environment variables. Set `NEXT_PUBLIC_SOLANA_NETWORK=devnet` for all preview environments.

### Domain

1. Add `ozskr.ai` in Vercel > Project > Settings > Domains
2. Update DNS: CNAME to `cname.vercel-dns.com`
3. SSL auto-provisions via Let's Encrypt

## Priority 2: Railway — Trigger.dev Workers

Trigger.dev background jobs run on Railway as a separate service.

### Setup

```bash
npm install -g @railway/cli
railway login
railway init
# Select the ozskr project or create new
```

### Environment Variables

Set in Railway dashboard:

| Variable | Notes |
|----------|-------|
| `TRIGGER_API_KEY` | From Trigger.dev dashboard |
| `TRIGGER_API_URL` | Trigger.dev API endpoint |
| `ANTHROPIC_API_KEY` | For content generation jobs |
| `MEM0_API_KEY` | For memory-enhanced generation |
| `AYRSHARE_API_KEY` | For social publishing jobs |
| `TWITTER_CLIENT_ID` | For Twitter direct publishing |
| `TWITTER_TOKEN_ENCRYPTION_KEY` | Token encryption |
| `SUPABASE_SERVICE_ROLE_KEY` | Database writes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `LANGFUSE_SECRET_KEY` | Telemetry |
| `LANGFUSE_PUBLIC_KEY` | Telemetry |
| `LANGFUSE_BASEURL` | Langfuse endpoint |

### Deploy

```bash
railway up
```

Or connect the GitHub repo for auto-deploy on push to main.

### Health Monitoring

- Railway dashboard: CPU, memory, logs
- Trigger.dev dashboard: Job success/failure, execution times
- Restart policy: auto-restart on failure (max 10 retries)

## Priority 3: Cloudflare — Edge Layer

### Rate Limiting Worker

```bash
# Deploy the rate limiter
npx wrangler deploy

# Set secrets
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

### R2 Storage (Content Assets)

```bash
# Create bucket
npx wrangler r2 bucket create ozskr-content

# Configure CORS (create cors.json first)
npx wrangler r2 bucket cors put ozskr-content --rules '[{
  "AllowedOrigins": ["https://ozskr.ai"],
  "AllowedMethods": ["GET"],
  "MaxAgeSeconds": 86400
}]'
```

Then uncomment the R2 binding in `wrangler.toml`.

## Environment Toggle: devnet to mainnet

The entire Solana stack is controlled by a single environment variable:

```
NEXT_PUBLIC_SOLANA_NETWORK=devnet    # or mainnet-beta
```

This drives `src/lib/solana/network-config.ts` which derives:
- RPC URL fallback
- Token mint addresses (USDC, SOL, HOPE)
- Explorer URLs
- Cluster parameter for Solscan links

### Switch Procedure

1. **Update Vercel**: Settings > Environment Variables > set `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`
2. **Update Railway**: same variable change
3. **Redeploy both**: Vercel auto-redeploys on env change; Railway may need manual trigger
4. **Verify**: `./scripts/verify-deployment.sh`
5. **Smoke test**: Connect wallet, check SOL balance, attempt a small swap

### Mainnet Checklist

- [ ] All secrets rotated (never reuse devnet keys on mainnet)
- [ ] Helius RPC URL is mainnet endpoint
- [ ] $HOPE mint address set correctly
- [ ] Slippage guards verified (max 100 bps)
- [ ] Rate limits configured for production load
- [ ] Monitoring alerts configured
- [ ] Backup procedures verified

## Verify Deployment

```bash
# Default (production)
./scripts/verify-deployment.sh

# Custom URL (staging)
FRONTEND_URL=https://staging.ozskr.ai ./scripts/verify-deployment.sh

# With Supabase check
SUPABASE_URL=https://xxx.supabase.co ./scripts/verify-deployment.sh
```
