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
│   └── utils/              # Shared helpers (formatters, constants)
├── hooks/                  # React hooks (useWallet, useAgent, etc.)
└── types/                  # Shared TypeScript types
```

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
- See `ozskr_brand_style_guide.md` for complete brand identity

## Phase Status

- [ ] Phase 1: Foundation (wallet, UI, auth, Hono API, Supabase schema)
- [ ] Phase 2: Agent Core (Mastra agents, Mem0, content pipeline, Claude integration)
- [ ] Phase 3: Trading (Jupiter Ultra swaps, positions, analytics)
- [ ] Phase 4: Scale (multi-agent orchestration, performance optimization)
- [ ] Phase 5: Polish (auto-stake, advanced analytics, platform maturity)
