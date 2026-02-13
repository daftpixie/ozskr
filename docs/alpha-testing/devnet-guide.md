# ozskr.ai Alpha Testing — Devnet Guide

## Prerequisites

- Node.js 20+
- pnpm 9+
- A Solana wallet (Phantom or Solflare recommended)
- Free Helius API key ([dev.helius.xyz](https://dev.helius.xyz))
- Supabase project ([supabase.com](https://supabase.com))

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/daftpixie/ozskr.git
cd ozskr
pnpm install

# 2. Run setup script
./scripts/devnet-setup.sh

# 3. Fill in .env.local with your API keys

# 4. Start dev server
pnpm dev
```

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

### Required for Alpha Testing

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `NEXT_PUBLIC_SOLANA_NETWORK` | Set to `devnet` | — |
| `NEXT_PUBLIC_HELIUS_RPC_URL` | Helius RPC endpoint | [dev.helius.xyz](https://dev.helius.xyz) |
| `HELIUS_API_KEY` | Helius API key (for balance queries) | Same as above |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | [supabase.com](https://supabase.com) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Supabase dashboard > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Supabase dashboard > Settings > API |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | Claude API key | [console.anthropic.com](https://console.anthropic.com) |

### Optional

| Variable | Description |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis for caching (degrades gracefully without) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `ADMIN_WALLETS` | Comma-separated admin wallet addresses |
| `OPENAI_API_KEY` | For content moderation pipeline |

## Wallet Setup

### Phantom (Recommended)

1. Install [Phantom](https://phantom.app/) browser extension
2. Open Settings > Developer Settings
3. Change Network to **Devnet**
4. Copy your wallet address

### Getting Devnet SOL

You need devnet SOL for transaction fees:

```bash
# Using Solana CLI
solana airdrop 2

# Or use the web faucet
# https://faucet.solana.com
```

## Access Tiers on Devnet

On devnet, there are no real $HOPE tokens. Use the **whitelist system** to grant access:

### Self-whitelisting for Testing

1. Add your wallet to `ADMIN_WALLETS` in `.env.local`:
   ```
   ADMIN_WALLETS=YourWalletAddressHere
   ```

2. Use the admin API to whitelist yourself:
   ```bash
   # Get an auth token first (connect wallet in the UI, then grab the JWT from browser devtools)

   curl -X POST http://localhost:3000/api/admin-whitelist \
     -H "Authorization: Bearer YOUR_JWT" \
     -H "Content-Type: application/json" \
     -d '{
       "walletAddress": "YourWalletAddress",
       "accessTier": "ALPHA",
       "notes": "Dev testing"
     }'
   ```

3. The whitelist overrides balance checks — you'll get ALPHA access even with 0 $HOPE

### Access Tier Reference

| Tier | $HOPE Required | Features |
|------|---------------|----------|
| ALPHA | 10,000+ | Full platform access, 5 agents |
| BETA | 5,000+ | Core features, 3 agents |
| EARLY_ACCESS | 1,000+ | Limited features, 1 agent |
| WAITLIST | 0 | Landing page + waitlist only |

## Database Setup

### Run Migrations

Apply all Supabase migrations in order:

```bash
# If using Supabase CLI
supabase db push

# Or apply manually via Supabase SQL Editor
# Files are in supabase/migrations/ (apply in order)
```

### Key Tables

- `users` — Wallet-authenticated user records
- `characters` — AI agent character definitions
- `content_generations` — Generated content records
- `alpha_whitelist` — Manual access tier overrides
- `feedback` — User feedback submissions

## Running Tests

```bash
# Full test suite
pnpm test

# Specific test file
pnpm test src/lib/auth/access-tier.test.ts

# Type checking
pnpm typecheck

# Linting
pnpm lint

# E2E tests (requires dev server running)
pnpm test:e2e
```

## Admin API Reference

All admin routes require:
- JWT auth token in `Authorization: Bearer <token>` header
- Wallet address in `ADMIN_WALLETS` env var

### Whitelist Management

```bash
# List all whitelisted wallets
GET /api/admin-whitelist

# Check specific wallet
GET /api/admin-whitelist/:wallet

# Add/update wallet
POST /api/admin-whitelist
Body: { "walletAddress": "...", "accessTier": "ALPHA|BETA|EARLY_ACCESS", "notes": "..." }

# Remove wallet
DELETE /api/admin-whitelist/:wallet
```

### Metrics

```bash
# Error rates (current hour)
GET /api/admin/metrics/errors

# Cost breakdown (last 7 days)
GET /api/admin/metrics/costs

# Platform summary
GET /api/admin/metrics/summary
```

## Troubleshooting

### "Invalid wallet address" error
- Ensure your wallet is connected and on devnet
- Check that the address is a valid base58 Solana address (32-44 chars)

### Balance shows 0 despite whitelist
- The balance checker runs first; whitelist is a fallback
- Check that the whitelist entry exists: `GET /api/admin-whitelist/:wallet`
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly

### "HELIUS_API_KEY not configured"
- Add `HELIUS_API_KEY=your-key` to `.env.local`
- The balance checker will return 0 without it (whitelist still works)

### Redis warnings in test output
- These are harmless — tests don't require Redis
- The system degrades gracefully when Redis is unavailable
