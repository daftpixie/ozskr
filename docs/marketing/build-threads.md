# Build-in-Public Twitter Threads

**DRAFT — ozskr.ai Marketing Content**

Three Twitter/X thread scripts for @ozskr_ai. All threads follow brand voice guidelines and SEC-safe $HOPE token language.

Brand theme: "Pay no mind to the agents behind the emerald curtain" (Wizard of Oz)

---

## Thread 1: Origin Story

**Title:** "How I built a full Solana AI agent platform in a week — using only Claude Code"

**Target audience:** Builders, AI developers, Solana ecosystem

---

**1/**

I just shipped ozskr.ai — a Web3 AI agent platform on Solana. The entire codebase was written by Claude Code in ~5 days of sessions. No human-written code. Here's what happened.

[MEDIA: Screenshot of ozskr.vercel.app landing page]

---

**2/**

The idea: AI influencers that actually live on-chain. Create characters, they generate content, manage Solana wallets, and trade tokens. Think Character.ai meets Phantom Wallet.

The twist: AI built by AI.

---

**3/**

Why Solana? Speed + cost. AI agents need to execute fast transactions (content publishing, token swaps, NFT mints). Sub-second finality matters when you're orchestrating dozens of agents.

Plus the Solana builder community is unmatched.

---

**4/**

The "Wizard of Oz" metaphor became our brand: "Pay no mind to the agents behind the emerald curtain."

Users create AI characters. Those characters create content, trade, build audiences. The curtain is transparent — you see the prompts, the decisions, the logic.

---

**5/**

Here's where it gets wild: I used Claude Code (Opus 4.6) as the strategic orchestrator. It delegated work to 10+ specialist agents:
- solana-dev (blockchain)
- frontend-dev (UI)
- ai-agent-dev (Mastra + Mem0)
- api-architect (Hono + Supabase)
And more.

---

**6/**

Each agent owns a domain. security-auditor gates every Solana/DeFi change. code-reviewer checks everything. Agents never call other agents — only the orchestrator delegates.

It's like a dev team, except every member is Claude.

---

**7/**

What we built in 5 days:
- Sign-In With Solana (SIWS) auth
- 7-stage AI content pipeline (parse → context → enhance → generate → quality → moderation → store)
- Jupiter Ultra swap integration
- Supabase schema + RLS policies
- 48 test files, 482 passing tests

---

**8/**

And the legal/ops stuff:
- 10 legal policy drafts (Privacy, ToS, Cookie Policy, Token Disclaimer, etc.)
- CI/CD with GitHub Actions
- Vercel production deploy
- Feature flags + waitlist (500 spots)
- Open-source docs (README, CONTRIBUTING, CODE_OF_CONDUCT)

[MEDIA: Screenshot of GitHub repo]

---

**9/**

Tech stack:
Next.js 15 App Router, TypeScript strict (zero any types), @solana/kit, Vercel AI SDK, Hono API, Supabase (PostgreSQL + RLS), Upstash Redis, Mem0 agent memory, Jupiter Ultra, Cloudflare R2, Trigger.dev background jobs.

MIT license. Open source.

---

**10/**

We're in private alpha. 500 waitlist spots. If you want to build AI agents on Solana, join the waitlist:

https://ozskr.vercel.app

GitHub: https://github.com/daftpixie/ozskr
Built exclusively with Claude Code.

"Pay no mind to the agents behind the curtain."

---

## Thread 2: Architecture Deep-Dive

**Title:** "The architecture of ozskr.ai — how we built a production-ready AI agent platform"

**Target audience:** Technical builders, DevOps engineers, Solana developers

---

**1/**

Let's talk about how ozskr.ai actually works. This is a full architectural breakdown of a Solana AI agent platform — built entirely by Claude Code in 5 days. Every pattern is battle-tested.

[MEDIA: Architecture diagram from README]

---

**2/**

The stack:
Frontend: Next.js 15 App Router + shadcn/ui
API: Hono (inside Next.js catch-all route)
Database: Supabase (PostgreSQL 16 + pgvector + RLS + Realtime)
Cache: Upstash Redis
Background: Trigger.dev Cloud
Blockchain: @solana/kit (devnet for now)

---

**3/**

Authentication: Sign-In With Solana (SIWS).

No email, no password. Connect your wallet, sign a message, get a session. The session token is stored in httpOnly cookies. Every API call validates the session + RLS enforces per-user data isolation.

---

**4/**

The 7-stage content pipeline (src/lib/ai/pipeline/):
1. Parse character DNA (Zod schema)
2. Context retrieval (Mem0 agent memory)
3. Enhance context (Claude API)
4. Generate content (Claude API + streaming)
5. Quality check (automated)
6. Moderation (safety filters)
7. Store (Supabase)

[MEDIA: Pipeline flow diagram]

---

**5/**

Every external input is validated with Zod schemas. API params, AI tool inputs, RPC responses — all validated before processing.

No raw user input touches the database. No unvalidated RPC responses hit the frontend. Defense in depth.

---

**6/**

Supabase RLS (Row Level Security) policies on EVERY table. No query runs without auth context. Even if you steal the service role key, you can't read another user's agents.

Policy example:
```sql
CREATE POLICY "Users can read own agents"
ON agents FOR SELECT
USING (auth.uid() = user_id);
```

---

**7/**

SocialPublisher abstraction layer handles Twitter, Discord, Telegram, etc.

We support:
- Ayrshare (multi-platform aggregator)
- Twitter direct (OAuth 2.0 PKCE + v2 API)

Agents don't know which platform they're posting to. The publisher handles retries, rate limits, error handling.

79 tests covering both providers.

---

**8/**

Jupiter Ultra integration for token swaps. Agents can:
- Fetch quotes (5+ routes, best price)
- Simulate transactions (before execution)
- Execute swaps (with slippage protection)
- Track positions

Human-in-the-loop approval required for every transaction. We never sign on behalf of users.

---

**9/**

Feature flags with server-side verification. Flags are stored in Supabase, evaluated server-side, cached in Redis.

Users can't bypass flags by editing localStorage. All protected routes check flags via API before rendering.

Example flags: WAITLIST_ENABLED, AGENT_CREATION_ENABLED, TRADING_ENABLED.

---

**10/**

Testing strategy:
- 48 test files, 482 passing tests
- Vitest for unit/integration
- Playwright for E2E
- Mock external services (fal.ai, Mem0, Trigger.dev)
- Devnet for Solana tests (never mainnet)
- TypeScript strict — zero any types

CI runs on every PR.

---

**11/**

Deployment:
- Vercel Edge for frontend + API
- Trigger.dev Cloud for background jobs (content generation, scheduled posts)
- Upstash Redis for rate limiting + caching
- Cloudflare R2 for content storage (images, videos)

Live at ozskr.vercel.app (private alpha).

---

**12/**

Open source (MIT license):
https://github.com/daftpixie/ozskr

Full docs:
- README with architecture diagram
- CONTRIBUTING guide
- CODE_OF_CONDUCT (Contributor Covenant v2.1)
- SECURITY policy (vulnerability disclosure)

We built this in public. The repo shows real commits, real decisions, real iterations.

---

## Thread 3: Claude Code Development Process

**Title:** "What it's actually like building a production app with Claude Code"

**Target audience:** Developers considering AI-assisted development, Claude Code users

---

**1/**

I built ozskr.ai entirely with Claude Code. No human-written code. Here's what the development process actually looked like — the good, the hard, and the surprising.

[MEDIA: Screenshot of Claude Code interface]

---

**2/**

The orchestrator pattern: Claude Opus 4.6 acts as the strategic orchestrator. It doesn't implement features — it plans, delegates, reviews, and synthesizes.

When I ask for a feature, Opus breaks it into work packages and delegates to specialist agents.

---

**3/**

The agent ownership map:
- solana-dev: blockchain, DeFi, wallets
- frontend-dev: UI, dashboard, streaming UX
- ai-agent-dev: Mastra agents, Mem0, content pipeline
- api-architect: Hono API, Supabase schema, RLS
- test-writer: test coverage across all domains
- security-auditor: security review (read-only gate)
- code-reviewer: fast quality checks (read-only gate)
- devops-infra: CI/CD, secrets, deploy
- content-writer: legal docs, marketing, open-source docs
- social-integration-dev: Twitter API, SocialPublisher

---

**4/**

Gate system: Every code change goes through security-auditor (for Solana/DeFi/API paths) and code-reviewer (for everything).

Agents can't merge their own work. The orchestrator reviews gated outputs and decides whether to proceed, iterate, or escalate.

This caught 12+ security issues before they shipped.

---

**5/**

Testing with Vitest 4: The agents learned Vitest 4 mock patterns from my MEMORY.md file.

Key pattern: Constructor mocks use `vi.fn(function() { return {...}; })` NOT arrow functions (arrow functions can't be constructors).

This tripped us up 3 times before we documented it.

---

**6/**

Legal docs: content-writer generated 10 legal policy drafts (Privacy Policy, ToS, Cookie Policy, Token Disclaimer, etc.).

Every draft is marked "DRAFT — REQUIRES ATTORNEY REVIEW" at the top. The agent knows it can't self-approve legal docs.

SEC-safe $HOPE token language is enforced across all content.

---

**7/**

The overnight autonomous build concept: I gave Claude Code a full sprint plan (Phase 6: Launch Operations) and let it run for 12 hours.

It completed:
- CI/CD setup (GitHub Actions)
- SocialPublisher abstraction (79 tests)
- Vercel production deploy
- Security re-audit
- 5/10 legal drafts
- Open-source docs

No human intervention.

---

**8/**

What works well:
- Architectural planning (Opus is exceptional at system design)
- Boilerplate elimination (API routes, Zod schemas, tests)
- Documentation (README, CONTRIBUTING, policy drafts)
- Security review (security-auditor is thorough)
- Iteration speed (minutes, not hours)

---

**9/**

What's hard:
- Context limits (large files require chunking)
- Vitest mock patterns (trial and error)
- Debugging async bugs (agents can't run a debugger)
- Design decisions (agents are conservative, sometimes too safe)
- Knowing when to stop iterating (perfectionism trap)

---

**10/**

Honest take: Claude Code is a 10x multiplier for solo builders. The orchestrator pattern works. The agent ownership map scales.

But it's not magic. You still need to:
- Define the architecture
- Write the PRD
- Review the outputs
- Test the edge cases
- Make the final calls

---

**11/**

If you're building with Claude Code:
- Use CLAUDE.md to define agent ownership
- Gate everything with security-auditor + code-reviewer
- Document patterns in MEMORY.md (especially test mocks)
- Run CI on every change (agents aren't perfect)
- Trust but verify (read the diffs)

---

**12/**

ozskr.ai is open source (MIT):
https://github.com/daftpixie/ozskr

Live at ozskr.vercel.app (private alpha, 500 waitlist spots).

Built exclusively with Claude Code. Every commit shows the real development process — prompts, iterations, decisions.

"Pay no mind to the agents behind the curtain."

---

## Usage Guidelines

### Posting Schedule
- Thread 1 (Origin): Post first, 48-72 hours before alpha launch
- Thread 2 (Architecture): Post 1 week after Thread 1
- Thread 3 (Claude Code): Post 1 week after Thread 2

### Engagement Strategy
- Reply to comments within first 2 hours
- Quote-tweet technical discussions
- Tag @AnthropicAI and @solana when posting Thread 1 and Thread 3
- Cross-post to Warpcast (Farcaster) with same thread structure

### Media Requirements
- Thread 1, Tweet 1: Landing page screenshot (ozskr.vercel.app)
- Thread 1, Tweet 8: GitHub repo screenshot (README + stats)
- Thread 2, Tweet 1: Architecture diagram (from README)
- Thread 2, Tweet 4: Content pipeline flow diagram (create new)
- Thread 3, Tweet 1: Claude Code interface screenshot

### $HOPE Token Language (SEC-Safe)
If replying to questions about $HOPE:
- DO say: "utility token for platform access"
- DO say: "unlocks premium features"
- DO say: "earn through platform activity"
- DON'T say: "investment opportunity"
- DON'T say: "price will increase"
- DON'T say: "provides returns"

### Hashtags
Use 2-3 per thread (final tweet only):
- #BuildInPublic
- #SolanaAI
- #ClaudeCode
- #AIAgents
- #Web3

---

**Built with Claude Code**
Generated: 2026-02-13
Status: DRAFT — Ready for review
