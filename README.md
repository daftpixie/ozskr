<div align="center">

# ozskr.ai

### Pay no mind to the agents behind the emerald curtain.

**Web3 AI Influencer Platform on Solana — built entirely by Claude Code.**

[![Next.js 15](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://typescriptlang.org)
[![Solana](https://img.shields.io/badge/Solana-@solana/kit-9945FF?logo=solana)](https://solana.com)
[![Claude API](https://img.shields.io/badge/Claude-Opus_4.6-D4A574?logo=anthropic)](https://anthropic.com)
[![Tests](https://img.shields.io/badge/Tests-389_passing-brightgreen)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Live Demo](https://ozskr.ai) | [Documentation](docs/) | [Contributing](CONTRIBUTING.md) | [Security](SECURITY.md)

</div>

---

## The Story

ozskr.ai is an AI agent platform where users create AI characters that generate content, publish to social media, and trade tokens on Solana. The recursive part? **The entire platform was designed, architected, and coded by the same kind of AI agent orchestration it provides to users.**

Every line of production code, every test, every deployment config — orchestrated by Claude Opus 4.6 delegating to specialist sub-agents: a Solana developer, a frontend engineer, an API architect, a test writer, and a security auditor. The agents behind the emerald curtain built their own stage.

## Features

**AI Agent Creation** — Design characters with custom personas, voice styles, and visual identities. Each agent gets persistent memory via Mem0.

**Content Generation Pipeline** — 7-stage pipeline: parse, context recall, enhance, generate (Claude), quality check, moderation, store. All content passes through automated moderation before storage or publishing.

**Social Publishing** — Multi-platform publishing via Ayrshare. Schedule content, track engagement, view analytics per agent.

**DeFi Trading** — Non-custodial token swaps via Jupiter Ultra. Transaction simulation required before execution. Slippage protection enforced. All signing is client-side via wallet adapter.

**$HOPE Token** — Utility token for platform services. Not an investment. See [Token Disclaimer](docs/legal/token-disclaimer.md).

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js 15 App Router                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  Agents  │  │  Trade   │  │ Calendar │  │Analytics│ │
│  │  UI/SSE  │  │  Swap UI │  │ Schedule │  │Dashboard│ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       │              │              │              │      │
│  ┌────▼──────────────▼──────────────▼──────────────▼────┐ │
│  │              Hono API Layer + Zod Validation          │ │
│  └────┬──────────────┬──────────────┬──────────────┬────┘ │
└───────┼──────────────┼──────────────┼──────────────┼─────┘
        │              │              │              │
   ┌────▼────┐   ┌─────▼────┐   ┌────▼────┐   ┌────▼─────┐
   │ Claude  │   │ Jupiter  │   │Ayrshare │   │ Supabase │
   │ + Mem0  │   │  Ultra   │   │ Social  │   │ + RLS    │
   │ + fal   │   │(client)  │   │  Pub    │   │          │
   └─────────┘   └──────────┘   └─────────┘   └──────────┘
   AI Pipeline    DeFi (non-     Publishing     PostgreSQL
   7 stages       custodial)     Multi-plat     Row-Level
                                                Security
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15, React 19, TypeScript 5.x strict |
| Blockchain | @solana/kit, Jupiter Ultra, Helius RPC |
| AI | Claude API (Anthropic), Mastra agents, Mem0 memory |
| Images | fal.ai (Flux, SDXL) |
| Database | Supabase (PostgreSQL + RLS) |
| API | Hono, Zod validation |
| State | React Query (server), Zustand (client) |
| Auth | Sign-In with Solana (SIWS) |
| Jobs | Trigger.dev |
| Observability | Langfuse (AI tracing) |
| Rate Limiting | Upstash Redis |
| Storage | Cloudflare R2 |
| Secrets | Infisical |
| Testing | Vitest (389 tests), Playwright (E2E) |
| UI | Tailwind CSS 4, shadcn/ui, Radix |

## Quick Start

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 9+
- A Solana wallet (Phantom, Solflare, or Backpack)

### Setup

```bash
# Clone
git clone https://github.com/daftpixie/ozskr.git
cd ozskr

# Install
pnpm install

# Configure
cp .env.example .env.local
# Fill in your API keys (see .env.example for descriptions)

# Run
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your wallet.

### Commands

```bash
pnpm dev          # Start dev server (port 3000)
pnpm build        # Production build
pnpm typecheck    # TypeScript strict check
pnpm lint         # ESLint
pnpm test         # Run all 389 tests
pnpm test:e2e     # Playwright end-to-end tests
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages + API routes
├── components/ui/          # shadcn/ui primitives
├── features/
│   ├── agents/             # AI agent creation & management
│   ├── wallet/             # Solana wallet connection
│   └── trading/            # Jupiter Ultra, swap flow
├── lib/
│   ├── solana/             # RPC, transactions, tokens (@solana/kit)
│   ├── ai/                 # Claude integration, pipeline, memory
│   ├── api/                # Hono routes, Zod schemas
│   ├── secrets/            # Infisical integration
│   └── utils/              # Logger, formatters
├── hooks/                  # React hooks
└── types/                  # Shared TypeScript types
```

## Security

- All signing is client-side — the platform **never** handles private keys
- Transaction simulation required before every execution
- Slippage guards on all swap operations (max 300 bps)
- Content moderation pipeline on all AI outputs
- Row Level Security on every database table
- Mem0 namespace isolation per character
- Zod validation on all API boundaries

Found a vulnerability? See [SECURITY.md](SECURITY.md).

## Built with Claude Code

This project was built exclusively with [Claude Code](https://claude.com/claude-code), Anthropic's CLI for Claude. The development process uses the same multi-agent orchestration pattern the platform provides:

- **Opus 4.6** orchestrates as the strategic planner
- **Specialist agents** (solana-dev, frontend-dev, api-architect, ai-agent-dev) implement features
- **Review agents** (security-auditor, code-reviewer) gate every change
- **Test writer** ensures coverage across all domains

389 tests. 35+ test files. Zero `any` types. Every line AI-generated, human-reviewed.

## Contributing

We welcome contributions from both human developers and AI-assisted workflows. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

[MIT](LICENSE)

## Legal

- [Privacy Policy](docs/legal/privacy-policy.md)
- [Terms of Service](docs/legal/terms-of-service.md)
- [Acceptable Use Policy](docs/legal/acceptable-use-policy.md)
- [Token Disclaimer](docs/legal/token-disclaimer.md)
- [AI Content Disclosure](docs/legal/ai-content-disclosure.md)

---

<div align="center">

**ozskr.ai** — Where AI agents build the stage they perform on.

</div>
