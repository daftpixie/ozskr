# Twitter/X Thread 2: Architecture Deep Dive

**Hook:** Production Solana AI platform architecture
**Target Audience:** Technical builders, backend devs, Web3 architects
**Tone:** Technical, opinionated, battle-tested insights
**CTA:** GitHub repo star

---

## Thread (10 tweets)

### 1/
Here's the architecture behind a production Solana AI agent platform.

Next.js 15. TypeScript strict. Non-custodial DeFi. AI memory with pgvector.

No fluff. No wrappers. Just patterns that work. 🧵

### 2/
The monorepo question: Why not separate frontend + backend?

Next.js 15 App Router + Hono API running at /api/[[...route]] gives us:
- Type-safe RPC-style APIs (Zod schemas everywhere)
- Single deploy target (Vercel)
- No CORS gymnastics
- Shared types across stack

Railway deferred. Don't need it.

### 3/
Data layer: Supabase (PostgreSQL 16 + pgvector + Row Level Security + Realtime subscriptions)

Why pgvector? AI agents need semantic memory. Mem0 stores embeddings. We query: "Show me content similar to this vibe."

RLS policies enforce wallet-based access control. No query without auth context.

### 4/
AI stack:
- Mastra (agent framework with tool execution)
- Mem0 (persistent memory with namespacing per character)
- Claude API with prompt caching (90% cost reduction on repeated context)
- fal.ai (unified image + video generation)

Langfuse tracing on all Claude calls for observability.

### 5/
Content pipeline is 7 stages:
parse → context (inject Mem0) → enhance (Claude) → generate (Claude + fal.ai) → quality (Claude) → moderation (3-stage safety) → store (Supabase + R2)

Every stage is independently testable. Every stage has retry logic. Nothing publishes without all 7 passing.

### 6/
DeFi integration: Jupiter Ultra for swaps on Solana.

Non-custodial design means:
- All signing client-side (@solana/wallet-adapter-react)
- Transaction simulation BEFORE execution
- Slippage guards (default 50 bps, user-adjustable)
- Priority fees via Helius for reliability

Human-in-the-loop approval for ALL transactions.

### 7/
Why @solana/kit instead of legacy web3.js?

Functional patterns. No class constructors. Explicit types. Better tree-shaking.

```ts
// ✅ @solana/kit
const addr = address('So11...');

// ❌ Deprecated
const pk = new PublicKey('So11...');
```

Future-proof. Type-safe. Works.

### 8/
Background jobs: Trigger.dev v3 (isolated containers, zero-config retries, cron schedules)

Content generation pipeline runs async. Users get SSE streaming updates via Server-Sent Events.

No polling. No websocket overhead. Just event streams.

### 9/
Cost optimization example: Claude prompt caching.

Character DNA (persona + style + guardrails) is ~4000 tokens. With caching, we pay full price once, then 90% discount on every subsequent generation.

For 1000 content generations, that's ~$45 saved vs. $50 spent. Worth the implementation.

### 10/
The repo is public. MIT licensed. Full test coverage (482 tests).

Want to see how AI agents architect production systems?

Star the repo: https://github.com/daftpixie/ozskr

Every pattern. Every decision. Every trade-off. All in git history.

---

## Tweet Performance Notes

- Tweet 1: Clear technical hook
- Tweet 2: Opinionated take (monorepo justification) - invites discussion
- Tweet 5: Concrete system design (7-stage pipeline)
- Tweet 7: Code snippet breaks up text, shows hands-on implementation
- Tweet 9: ROI calculation (cost optimization) appeals to practical builders
- Tweet 10: CTA to GitHub with value prop

## Code Snippet Formatting

Tweet 7 uses inline code formatting. Keep it short (3-4 lines max) for readability on mobile.

## Hashtag Strategy (use sparingly)
- #Solana
- #TypeScript
- #WebDev

## Media Suggestions
- Tweet 1: Architecture diagram (Next.js + Hono + Supabase + Solana visual)
- Tweet 5: Flowchart of 7-stage content pipeline
- Tweet 6: Screenshot of Jupiter swap transaction with simulation UI
- Tweet 10: GitHub repo preview card

---

**Status:** Draft - Ready for review
**Author:** content-writer agent
**Date:** 2026-02-13
