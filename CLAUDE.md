# ozskr.ai — Solana AI Agent Platform

Web3 AI Influencer Platform built on Solana. Next.js 15 App Router, TypeScript 5.x strict, @solana/kit, Vercel AI SDK + Claude API.

**Repo**: https://github.com/daftpixie/ozskr
**License**: Open Source
**Built exclusively with Claude Code.**

## Commands

```bash
pnpm dev          # Start dev server (port 3000)
pnpm build        # Production build
pnpm typecheck    # TypeScript strict check — run after every change
pnpm lint         # ESLint check
pnpm test         # Vitest test suite
pnpm test:e2e     # Playwright end-to-end tests
```

## Architecture

```
src/
├── app/                    # Next.js App Router pages + API routes
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   └── features/           # Domain-specific components
├── features/
│   ├── agents/             # AI Agent creation & management
│   ├── wallet/             # Solana wallet connection (adapter)
│   ├── trading/            # Jupiter Ultra, Raydium integration
│   └── analytics/          # Agent performance tracking
├── lib/
│   ├── solana/             # RPC clients, transaction builders (@solana/kit)
│   ├── ai/                 # Claude integration, Mastra agents, Mem0 memory
│   ├── api/                # Hono service layer, Zod schemas
│   ├── social/             # SocialPublisher adapters (Twitter, Ayrshare)
│   ├── monitoring/         # Error tracking, cost tracking, admin metrics
│   └── utils/              # Shared helpers (formatters, constants)
├── hooks/                  # React hooks (useWallet, useAgent, etc.)
└── types/                  # Shared TypeScript types
packages/                       # Open-source packages (MIT license)
├── agent-wallet-sdk/           # SPL delegation, KeyManager interface, USDC validation
├── x402-solana-mcp/            # MCP server for x402 payments (V1+V2 headers)
└── x402-facilitator/           # Governance-aware settlement (OFAC, circuit breaker, delegation)
```

## Deployment

- **Frontend + API:** Vercel (Next.js + Hono catch-all at /api/[[...route]])
- **Background Jobs:** Trigger.dev Cloud (isolated containers)
- **Database:** Supabase (PostgreSQL 16 + pgvector + RLS + Realtime)
- **Cache / Rate Limiting:** Upstash Redis
- **Content Storage:** Cloudflare R2 (bucket: ozskr-content)
- **Domain:** ozskr.vercel.app (production)
- **Network:** devnet (current) — toggle via SOLANA_NETWORK env var
- **Tests:** 659 passing across 63 files

Railway deferred — Hono runs inside Next.js, not as standalone server.
Infisical deferred — secrets direct in Vercel/Trigger.dev for now.

## Agent Orchestration (Opus 4.6)

This project uses Claude Code's subagent system with Opus 4.6 as the strategic orchestrator. The orchestrator does NOT implement features directly — it plans, delegates, reviews, and synthesizes.

### Orchestrator Workflow

When implementing features, the orchestrator (Opus) should:

1. **Analyze** the request against the PRD to identify all affected domains
2. **Decompose** into work packages with clear boundaries and acceptance criteria
3. **Delegate** to specialist agents — one agent per work package
4. **Review** all outputs for cross-cutting concerns (security, type consistency, architectural coherence)
5. **Gate** with `security-auditor` (mandatory for Solana/DeFi/API paths) and `code-reviewer` (mandatory for all paths)

### Agent Ownership Map

| Domain | Owning Agent | PRD Sections |
|--------|-------------|--------------|
| Blockchain, DeFi, wallet, $HOPE token | `solana-dev` | §2, §8 |
| UI components, dashboard, streaming UX | `frontend-dev` | §6, §10 |
| Mastra agents, Mem0, content pipeline, AI models | `ai-agent-dev` | §3, §4, §5, §7, §9 |
| Hono API, Supabase schema, RLS, infra config | `api-architect` | §11, §13.3, §14 |
| Test coverage across all domains | `test-writer` | All |
| Security review (read-only, post-implementation) | `security-auditor` | §13 |
| Fast code quality checks (read-only) | `code-reviewer` | All |
| Infrastructure, CI/CD, secrets, deploy, monitoring | `devops-infra` | §14, Launch Ops |
| Legal docs, marketing, open-source docs, community | `content-writer` | Launch Ops |
| Social API migration, Twitter direct, SocialPublisher | `social-integration-dev` | §7, Launch Ops |
| Marketing strategy, community growth, social campaigns | `glinda-cmo` | Phase 7 GTM |
| Grant applications, funding strategy, pitch materials | `toto-funding` | Phase 7 GTM |
| SPL delegation, agent keypair, x402 tx | `solana-dev` | PRD §16 |
| MCP server, tool definitions, x402 HTTP | `mcp-dev` | PRD §16 |
| MCP server test coverage | `test-writer` | PRD §16 |
| Facilitator settlement, OFAC screening, circuit breaker | `solana-dev` | PRD §16 |
| Facilitator Hono service, audit logging, REST API | `api-architect` | PRD §16 |
| Facilitator security audit (payment flow, OFAC, governance) | `security-auditor` | PRD §16 |
| Facilitator test coverage (devnet integration, governance) | `test-writer` | PRD §16 |

### Agent Interaction Rules

1. **Write agents never call other write agents.** Only the orchestrator delegates.
2. **Review agents run after every write agent completes.** `security-auditor` is mandatory for Solana/DeFi/API paths; `code-reviewer` runs on everything.
3. **Subagents cannot spawn subagents.** The hierarchy is strictly flat — Opus delegates, agents execute.
4. **Agent Teams mode uses git worktree isolation.** Each parallel agent gets its own worktree; conflicts are resolved at merge time by the orchestrator.
5. **Escalation to Opus is explicit.** Subagents surface architectural concerns rather than making cross-domain decisions.

### Escalation Rules (for subagents)

Subagents should escalate to the orchestrator when:
- Architectural decisions affect more than 2 service domains
- Security-critical pattern choices are ambiguous
- A new dependency addition exceeds 100KB bundle impact
- Schema changes affect more than 3 database tables
- Cross-agent coordination is required (e.g., API contract changes that affect frontend)

### Launch Escalation Rules (Phase 6+)

Hard rejections (no exceptions):
- Any feature involving the platform signing transactions on behalf of users → REJECT
- Any feature involving holding/converting crypto for users → REJECT
- Content mentioning $HOPE value/price/returns → REJECT (SEC risk)

Mandatory escalation:
- Legal doc final versions → flag for Matt's attorney (never self-approve)
- Reward distribution logic changes → escalate to orchestrator
- Mainnet config changes → mandatory `devops-infra` + `security-auditor` dual approval
- Payment wallet address changes → escalate to Matt directly
- Open-source changes exposing internal patterns → `security-auditor` gate

### Go-to-Market Escalation Rules (Phase 7)

Hard rejections:
- Any content implying $HOPE is a security/investment → REJECT (SEC risk)
- Any endorsement deal without `#ad` / `#sponsored` disclosure → REJECT (FTC 16 CFR §255)
- Any AI-generated content published without disclosure → REJECT (NY S.B. S6524-A)
- Any claim about token price, yield, or financial returns → REJECT

Mandatory escalation:
- Partnership or sponsorship terms → escalate to Matt
- Grant application submissions → escalate to Matt for final review
- Community moderation policy changes → escalate to orchestrator
- Any paid promotion campaign → requires `glinda-cmo` + `security-auditor` dual review

### Agent Teams Parallelism (Phase 1 Example)

When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is enabled:

| Worktree | Agent | Track | Dependencies |
|----------|-------|-------|-------------|
| `wt-auth` | `solana-dev` | Wallet auth (SIWS), session | None |
| `wt-ui` | `frontend-dev` | Dashboard shell, design system | None |
| `wt-api` | `api-architect` | Hono scaffold, Supabase schema, RLS | None |
| `wt-test` | `test-writer` | Test infra, mock setup | Watches other worktrees |

## Code Style

- TypeScript strict mode — no `any`, use `unknown` + type narrowing
- Named exports only, no default exports (except Next.js pages/layouts)
- Use `@solana/kit` patterns: `pipe()`, `address()`, `lamports()`, BigInt for amounts
- Zod schemas for ALL external data: API params, AI tool inputs, RPC responses
- React Query for server state, Zustand for client state — never mix
- Prefer `async/await` over `.then()` chains
- No `console.log` in production code — use structured logger

## Solana Patterns — IMPORTANT

```typescript
// ✅ CORRECT — @solana/kit functional style
import { pipe, createTransactionMessage, address } from '@solana/kit';
const addr = address('So11111111111111111111111111111111111111112');

// ❌ WRONG — deprecated web3.js v1 patterns
import { PublicKey, Connection } from '@solana/web3.js';
const pk = new PublicKey('...');
```

- Always validate addresses with `assertIsAddress()` before RPC calls
- Always simulate transactions before execution: `simulateTransaction()`
- Use `@solana/wallet-adapter-react` for all signing — NEVER handle keys server-side
- Use environment variables for RPC endpoints, never hardcode
- Use `@solana/compat` only for Anchor bridging — prefer native @solana/kit

## Security — CRITICAL

- **NEVER** commit private keys, seed phrases, `.env` files, or API secrets
- **NEVER** execute transactions without explicit user confirmation
- **NEVER** handle private keys server-side — all signing is client-side via wallet adapter
- Transaction simulation REQUIRED before any write operation
- Slippage guards REQUIRED on all swap operations (default: 50 bps)
- Human-in-the-loop approval for ALL DeFi transactions
- Sensitive values MUST come from Infisical, not raw environment variables
- Supabase RLS policies REQUIRED on every table — no query without auth context
- Mem0 namespaces MUST be isolated per character with server-side enforcement
- Content moderation pipeline MUST run before any content is stored or published
- Rate limits enforced per-wallet at the edge layer (Cloudflare Workers + Upstash)
- Agent keypairs: 0600 file permissions, encrypted at rest via scrypt/AES-256-GCM
- SPL delegation: spending caps enforced both on-chain (approveChecked amount) and client-side (budget.ts)
- x402 payments: transaction simulation required before every payment submission
- npm packages: zero secrets, zero hardcoded endpoints, full dependency audit before publication
- Facilitator: OFAC screening REQUIRED before every settlement (no bypass path)
- Facilitator: circuit breaker on consecutive settlement failures (5 failures → 60s cooldown)
- Facilitator: delegation governance checks before every transfer (cap, expiry, revocation status)
- Facilitator: audit log for every settlement attempt (success and failure, with tx signature)
- Facilitator: ScreeningProvider interface for pluggable OFAC screening (static SDN baseline, Chainalysis for production)
- Token validation: always use `validateTokenMint()` to prevent spoofed USDC mint attacks
- KeyManager: production deployments MUST use a production-grade provider (Turnkey, Privy) — never use encrypted-json in production

## AI Compliance — CRITICAL

All AI-generated content published via ozskr.ai MUST comply with:

- **FTC 16 CFR §255**: Endorsement content must include `#ad` or `#sponsored` disclosure
- **NY S.B. S6524-A**: AI-generated content must be labeled as such
- **Platform TOS**: Twitter/X, Instagram, etc. require AI content disclosure
- Auto-disclosure injection is enforced at the SocialPublisher adapter layer
- Endorsement guardrails are enforced at the moderation pipeline layer
- Content mentioning $HOPE must use utility-only framing (never investment language)

## $HOPE Token Reference

$HOPE is a **utility token** for the ozskr.ai ecosystem. It is NOT a security, NOT an investment, and has NO guaranteed value.

| Allowed | Prohibited |
|---------|-----------|
| "$HOPE unlocks premium features" | "$HOPE will increase in value" |
| "Earn $HOPE through platform activity" | "$HOPE is an investment opportunity" |
| "Utility token for the ozskr ecosystem" | "$HOPE provides returns" |
| "Hold $HOPE to access tier benefits" | "Buy $HOPE before the price goes up" |

All agents MUST follow this language guide when generating content mentioning $HOPE.

## Testing

- Run individual test files for speed: `pnpm test src/lib/solana/rpc.test.ts`
- Always `pnpm typecheck` after code changes
- Solana tests use devnet — never mainnet
- Mock wallet adapter in component tests
- Test DeFi functions against known token pairs on devnet
- E2E tests in `tests/e2e/` via Playwright
- Mock fal.ai, Mem0, and Trigger.dev in unit tests

## Workflow

- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `security:`
- Always run `pnpm lint && pnpm typecheck` before committing
- Branch format: `feat/description`, `fix/description`, `chore/description`
- AI-assisted commits: add `Assisted-by: Claude Code` trailer for substantial AI-generated code
- PRs require security review for changes to `src/lib/solana/`, `src/features/trading/`, or `src/app/api/`
- All Claude API calls MUST include Langfuse tracing headers

## Design System

- Brand colors: Solana Purple `#9945FF`, Solana Green `#14F195`, Brick Gold `#F59E0B`
- Dark mode default: Void Black `#0A0A0B` background
- Fonts: Satoshi (display), Inter (body), JetBrains Mono (code)
- See `ozskr-design-system.css` for production-ready design tokens
- See `docs/ozskr_brand_style_guide.md` for complete brand identity

## Key References

| Document | Path |
|----------|------|
| Brand Style Guide | `docs/ozskr_brand_style_guide.md` |
| Security Audit | `docs/security-audit-pre-alpha.md` |
| Legal Policies (11) | `docs/legal/*.md` |
| Marketing Content | `docs/marketing/*.md` |
| Community Docs | `docs/community/*.md` |
| Funding Materials | `docs/funding/*.md` |
| PRD v2.3 Amendment | `docs/prd_v2_3_amendment.md` |
| Master Plan v3.2 | `docs/master_plan_v3_2_amendment.md` |
| Changelog | `CHANGELOG.md` |

## Phase Status

- [x] Phases 1–6: COMPLETED (Foundation → Agent Core → Trading → Hardening → Polish → Launch Ops)
- [ ] Phase 7: Go-to-Market ← CURRENT (platform launch track)
  - [x] 7.1: CLAUDE.md Phase 7 update + new agent definitions (glinda-cmo, toto-funding)
  - [x] 7.2: AI compliance infrastructure (auto-disclosure, endorsement guardrails)
  - [x] 7.3: Funding materials (Solana Foundation grant, one-pager, FUNDING.yml)
  - [x] 7.4: Alpha infrastructure (access tiers, whitelist, admin dashboard, micro-surveys, E2E tests)
  - [x] 7.5: Content activation (2-week calendar, publish-ready blog + thread)
  - [x] 7.6: Business development (revenue model, 3 partnership outreach templates)
  - [x] 7.7: Alpha bug triage (admin issues API, auto-create from surveys, admin tracker UI)
  - [x] 7.8: Batch whitelist + waitlist conversion pipeline
  - [x] 7.9: Alpha metrics report generator (JSON + markdown export)
  - [x] 7.10: Multi-user load validation (50 concurrent sessions, rate limit stress)
  - [x] 7.11: Blog integration (/blog with SEO, static generation, 2 launch posts)
  - [x] 7.12: Community launch (Discord playbook, KOL outreach package, Show HN draft)
  - [x] 7.13: Investor materials (12-slide deck, Superteam microgrant application)
  - [ ] 7.14: Product Hunt launch execution
  - [ ] 7.15: Mainnet preparation (network switch, final security audit)
  - [ ] 7.16: Post-launch monitoring and iteration
- [ ] Phase 7.M: MCP Server + Facilitator Build ← CURRENT (parallel open-source track)
  - [x] 7.M.1: Workspace initialization + agent specs
  - [x] 7.M.2: @ozskr/agent-wallet-sdk v0.1.2-beta (SPL delegation, budget, keypair)
  - [x] 7.M.3: @ozskr/x402-solana-mcp v0.2.0-beta (8 MCP tools, x402 payment flow)
  - [x] 7.M.4: Documentation, testing, npm publication
  - [ ] 7.M.5: MCP directory submissions, ecosystem announcements
  - [x] 7.M.6: @ozskr/x402-facilitator v0.1.0-beta (governance-aware settlement, 128 tests)
  - [x] 7.M.7: Facilitator devnet integration testing (9 devnet tests passing)
  - [x] 7.M.8: Facilitator documentation + npm publication prep (npm token refresh needed)
  - [x] 7.M.9: Mainnet readiness hardening (KeyManager, ScreeningProvider, V2 headers, USDC validation)
- [ ] Phase 8: Agentic Commerce Layer (activation-gated: 100+ users, attorney sign-off, x402 recovery)
- [ ] Phase 9: Agent Marketplace (activation-gated: Phase 8 stable 3+ months, 500+ agents)
- [ ] Deferred: Auto-Stake Smart Contract (pending security audit budget $15-30K)

Phase 6 engineering complete. Phase 7 Sprints 1-3 complete. 292 tests across 3 packages (76 SDK + 88 MCP + 128 facilitator) + 659 app tests. SDK v0.1.2-beta + MCP v0.2.0-beta published. Facilitator v0.1.0-beta ready (npm token refresh needed). Remaining: Product Hunt launch, mainnet prep, MCP directory submissions.
