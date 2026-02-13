# How AI Built an AI Platform: Building ozskr.ai with Claude Code

This is the story of how an AI influencer platform was built by AI agents. Not "AI-assisted" where a developer types code and an LLM suggests completions. Full orchestration — a strategic planner delegating to specialist agents, security auditors gating every change, and test writers ensuring coverage. The platform is called ozskr.ai. The tool is called Claude Code. This is what happened.

---

## The Meta Story

ozskr.ai is a platform for creating AI agent influencers on Solana. Users design characters with custom personas, generate content via Claude API, and publish to social media. AI agents creating content for human-managed AI agents. The recursion is intentional.

The constraint: build it in 6 weeks from zero to production deploy, maintain test coverage above 80%, pass a security audit with zero critical findings, and do it entirely with AI-generated code.

The result: 482 tests across 48 files. Zero `any` types. Live at [ozskr.vercel.app](https://ozskr.vercel.app). Code at [github.com/daftpixie/ozskr](https://github.com/daftpixie/ozskr). MIT license. Built exclusively with [Claude Code](https://claude.com/claude-code).

---

## What is Claude Code?

Claude Code is Anthropic's CLI tool for Claude. It's not a code editor plugin. It's a terminal-based interface where Claude (Opus 4.6 in this case) has direct access to your filesystem, can execute bash commands, run tests, commit to git, and invoke other Claude instances as specialist agents.

Key capabilities:

- Read/write files, search codebases (grep, glob)
- Execute bash commands (git, pnpm, docker, etc.)
- Invoke subagents with specialized instructions (security-auditor, test-writer, solana-dev)
- Maintain context across sessions via project memory (`CLAUDE.md`, `MEMORY.md`)
- Stream output in real-time (watch tests run, see compilation errors immediately)

The mental model: Claude Code is an autonomous developer that follows a project specification (the PRD), delegates to specialists, and gates changes with review agents.

---

## The Orchestrator Pattern: Opus 4.6 as Strategic Planner

The development process mirrors the platform's own architecture. Opus 4.6 doesn't implement features directly — it plans, delegates, reviews, and synthesizes.

### Agent Ownership Map

| Agent | Domain | Role |
|-------|--------|------|
| **Opus 4.6** | Orchestration | Strategic planner, cross-domain coordinator, merge decision maker |
| **solana-dev** | Blockchain | Wallet auth, Jupiter integration, transaction building, HOPE token |
| **frontend-dev** | UI/UX | React components, dashboard, streaming progress, design system |
| **ai-agent-dev** | AI/ML | Claude integration, Mem0 memory, content pipeline, Mastra agents |
| **api-architect** | Backend | Hono routes, Supabase schema, RLS policies, Zod validation |
| **test-writer** | Quality | Test coverage across all domains, mocks, E2E flows |
| **security-auditor** | Security | Read-only post-implementation audits, vulnerability identification |
| **code-reviewer** | Code quality | Fast pre-merge checks, type safety, lint violations |
| **devops-infra** | Infrastructure | CI/CD, deployment, secrets, monitoring, GitHub configuration |
| **content-writer** | Documentation | Legal docs, marketing, README, community materials |
| **social-integration-dev** | Social APIs | Twitter OAuth, SocialPublisher abstraction, rate limiting |

### Orchestrator Workflow

When implementing a feature (e.g., "Add DeFi trading via Jupiter"):

1. **Analyze:** Opus reads the PRD, identifies all affected domains (blockchain, API, UI, testing, security)
2. **Decompose:** Break into work packages with clear acceptance criteria
   - WP 3.1.1: Trading data model, API routes, rate limiting (api-architect)
   - WP 3.1.2: Jupiter client, transaction builder, priority fees (solana-dev)
   - WP 3.1.3: Swap UI, confirmation modal, wallet adapter (frontend-dev)
   - WP 3.1.4: Test coverage for all above (test-writer)
3. **Delegate:** Invoke specialist agents sequentially (can't parallelize due to type dependencies)
4. **Review:** Run `security-auditor` (mandatory for Solana/DeFi) and `code-reviewer` (mandatory for all)
5. **Gate:** If security-auditor flags critical issues, reject and re-delegate. If code-reviewer flags type errors, fix immediately.
6. **Merge:** Once all gates pass, commit with conventional commit message

The orchestrator never writes implementation code directly. It reads PRD sections, delegates to agents, and synthesizes their outputs.

---

## Agent Interaction Rules

**Rule 1: Write agents never call other write agents.**

Only the orchestrator delegates. If `solana-dev` identifies a frontend concern, it surfaces the issue to Opus rather than invoking `frontend-dev` directly. This prevents infinite recursion and maintains a clear hierarchy.

**Rule 2: Review agents run after every write agent completes.**

`security-auditor` is mandatory for:
- Solana/DeFi code (wallet auth, transaction building, token operations)
- API routes handling sensitive data (user wallet addresses, OAuth tokens)
- Content moderation pipeline

`code-reviewer` runs on everything. It checks:
- TypeScript strict mode compliance (no `any` types)
- Zod schemas at API boundaries
- Named exports only (no default exports except Next.js pages)
- Proper error handling (no swallowed exceptions)

**Rule 3: Subagents cannot spawn subagents.**

The hierarchy is strictly flat. Opus delegates to agents. Agents execute and return results. No nested delegation.

**Rule 4: Escalation to Opus is explicit.**

Subagents surface architectural concerns rather than making cross-domain decisions. Examples:

- "This RLS policy change affects 3 tables — should we batch in a single migration or separate?" → escalate to Opus
- "Jupiter API changed and now requires priority fee estimation — this affects transaction building in solana-dev AND UI display in frontend-dev" → escalate to Opus
- "Test coverage for this pipeline stage is 65% — should we add more tests or is this acceptable given alpha constraints?" → escalate to Opus

---

## A Day in the Build: Typical Session Workflow

**Session goal:** Implement scheduled content generation (users can queue posts for future publish).

### Step 1: Opus reads PRD, identifies dependencies

Opus reads PRD section 7 (Social Publishing) and identifies:
- Need: Database table `scheduled_posts` (api-architect)
- Need: Trigger.dev job to execute scheduled publishes (api-architect)
- Need: UI in agent dashboard to schedule posts (frontend-dev)
- Need: Tests for job execution, database queries, UI interactions (test-writer)
- Security gate: Scheduled posts must check moderation status before publish (security-auditor)

### Step 2: Opus decomposes into work packages

- WP 7.1: Database schema for `scheduled_posts` with RLS policies
- WP 7.2: Trigger.dev job `publish-scheduled.ts` with retry logic
- WP 7.3: Schedule modal in agent dashboard (date/time picker, timezone handling)
- WP 7.4: Test coverage (database, job, UI)

### Step 3: Opus delegates to api-architect

Prompt sent to `api-architect` agent:

```
You are the API architect for ozskr.ai. Implement WP 7.1: Database schema for scheduled_posts.

Requirements:
- Table: scheduled_posts (id, character_id, content_generation_id, scheduled_at, status, created_at)
- RLS policies: users can only schedule posts for their own characters
- Index on scheduled_at for job queries
- Status enum: pending, published, failed, cancelled

Deliverable: Migration file in supabase/migrations/
```

`api-architect` creates the migration, runs `pnpm typecheck` to ensure no type errors, and returns the file path.

### Step 4: Opus reviews with code-reviewer

```
Review the migration file for:
- Correct RLS policy scoping (wallet_address)
- Index on scheduled_at
- Foreign key constraints
- No SQL injection vectors
```

`code-reviewer` flags: "Missing ON DELETE CASCADE for content_generation_id foreign key — if generation is deleted, scheduled post should also be deleted."

Opus directs `api-architect` to fix. Migration updated. Re-review passes.

### Step 5: Opus delegates to api-architect for Trigger.dev job

Prompt:

```
Implement WP 7.2: Trigger.dev job publish-scheduled.ts.

Requirements:
- Interval trigger (every 5 minutes)
- Query scheduled_posts WHERE scheduled_at <= now() AND status = 'pending'
- For each: check moderation_status, publish via SocialPublisher, update status
- Retry logic: max 3 retries with exponential backoff
- Logging: Langfuse trace for observability

Deliverable: src/lib/jobs/publish-scheduled.ts
```

`api-architect` implements, runs tests (`pnpm test src/lib/jobs/publish-scheduled.test.ts`), returns results.

### Step 6: Opus reviews with security-auditor

```
Audit WP 7.2 for:
- Moderation status enforcement before publish
- Service role client usage (not user JWT)
- No bypass paths for unauthorized publishes
- Rate limit handling if provider throttles
```

`security-auditor` flags: "Job uses service role client but doesn't verify character ownership before publishing — malicious scheduled_at manipulation could publish for any character."

Opus directs fix: Add `JOIN characters ON characters.id = scheduled_posts.character_id` and verify `wallet_address` ownership via RLS policy.

Re-audit passes.

### Step 7: Opus delegates to frontend-dev

Prompt:

```
Implement WP 7.3: Schedule modal in agent dashboard.

Requirements:
- Date/time picker (react-datepicker)
- Timezone dropdown (use Intl.DateTimeFormat for user's locale)
- Preview of scheduled time in UTC and user's local time
- Validation: cannot schedule in the past, max 30 days in future
- API call to POST /api/schedules

Deliverable: src/features/agents/schedule-modal.tsx
```

`frontend-dev` implements, runs `pnpm typecheck`, returns component.

### Step 8: Opus delegates to test-writer

Prompt:

```
Write tests for WP 7.1-7.3:
- Database: RLS policy enforcement, ON DELETE CASCADE
- Job: scheduled publish execution, moderation check, retry logic
- UI: date validation, timezone handling, API integration

Deliverable: 3 test files
```

`test-writer` creates tests, runs `pnpm test`, returns coverage report (87% line coverage).

### Step 9: Opus synthesizes and commits

All work packages complete. All gates passed. Opus creates a commit:

```bash
git add supabase/migrations/20260212_scheduled_posts.sql
git add src/lib/jobs/publish-scheduled.ts
git add src/lib/jobs/publish-scheduled.test.ts
git add src/features/agents/schedule-modal.tsx
git add src/features/agents/schedule-modal.test.tsx

git commit -m "$(cat <<'EOF'
feat(social): scheduled content publishing

Implements scheduled post queuing and background job execution.

- Database: scheduled_posts table with RLS policies
- Job: Trigger.dev interval job (5min) with retry logic
- UI: Schedule modal with timezone handling and validation
- Tests: 87% coverage across database, job, UI

Moderation status enforcement verified by security-auditor.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

Session complete. Feature shipped in 1 session (~45 minutes of autonomous work).

---

## The Overnight Autonomous Build Concept

The most ambitious experiment: queue up 5 feature requests, let Claude Code run overnight with explicit instructions to commit after each task, run tests after each commit, and stop if tests fail.

**Setup:**

```
Task queue:
1. Implement gamification points system (api-architect, test-writer)
2. Add achievement unlock logic (api-architect, test-writer)
3. Build leaderboard UI (frontend-dev, test-writer)
4. Add streak tracking (api-architect, test-writer)
5. Create tier badge system (frontend-dev, test-writer)

Instructions:
- Commit after each task with conventional commit message
- Run pnpm test after each commit
- If tests fail, attempt fix once; if still failing, stop and report
- Escalate architectural decisions to morning review
```

**Result:**

5/5 tasks completed. 58 tests added. 0 failed commits. 4 escalations flagged for morning review:

1. "Leaderboard cache staleness is 5 minutes — acceptable for alpha or should it be real-time Supabase Realtime?"
2. "Achievement unlock has potential race condition if two actions trigger same achievement simultaneously — add unique constraint or handle in application layer?"
3. "Tier badge colors not defined in design system — placeholder values used, need design input"
4. "Points ledger is append-only but no archival strategy — should we archive after 90 days or keep forever?"

Human review in morning: approved 3 escalations, flagged race condition concern for fix. Total autonomous work: 6 hours overnight (wall time), equivalent to ~2 days of human developer work.

This became the model for Phase 5 (Polish) — queue up 10 optimization tasks, run overnight, review in morning.

---

## Legal Docs by AI: 10/10 Policy Drafts Generated

One of the most surprising successes: generating legal policy documents. We needed 10 documents for launch:

1. Privacy Policy (multi-jurisdictional, CCPA + GDPR)
2. Terms of Service (AI content IP, liability, crypto payment terms)
3. Acceptable Use Policy
4. AI Content Disclosure Policy
5. Token Usage Terms ($HOPE utility framing, SEC-safe)
6. DMCA/Copyright Policy
7. Cookie Policy
8. Non-Custodial Wallet Disclaimer
9. Data Retention Policy
10. Content Moderation Policy

**Prompt to content-writer agent:**

```
You are the legal documentation specialist for ozskr.ai. Generate a Privacy Policy draft.

Requirements:
- Multi-jurisdictional: CCPA (California), GDPR (EU)
- Cover: wallet data (public blockchain addresses), AI-generated content, OAuth tokens
- Third-party services: Anthropic, fal.ai, Ayrshare, Supabase, Cloudflare, Upstash
- Data retention: 90 days for deleted content, 1 year for logs
- Encryption: TLS 1.3 in transit, pgcrypto at rest
- No selling data, no advertising tracking

Constraints:
- Mark as "DRAFT — REQUIRES ATTORNEY REVIEW" at top
- Plain language where possible, legal precision where required
- Link to third-party privacy policies
- Avoid legalese that obscures meaning

Deliverable: docs/legal/privacy-policy.md
```

Result: 261-line privacy policy with 13 sections covering data collection, third-party services, security measures, user rights (CCPA + GDPR), blockchain data disclaimers, and contact information. Flagged for attorney review (never self-approved).

Same process for all 10 documents. Average generation time: 8 minutes per document. Total cost: ~$2.40 in API calls (Opus 4.6 pricing).

**Critical constraint:** All documents mentioning $HOPE use utility-only framing. No value, price, returns, or investment language (SEC risk). `content-writer` agent has hard-coded rejection rules:

```
IF document mentions:
- "$HOPE will increase in value"
- "$HOPE is an investment opportunity"
- "$HOPE provides returns"
- "Buy $HOPE before price goes up"

THEN reject immediately with error message: "SEC risk — token language must use utility-only framing"
```

Human review caught 0 SEC-violating language in final drafts. All 10 documents are queued for attorney review before beta launch.

---

## Testing Patterns Discovered: Vitest 4 Edge Cases

The test-writer agent discovered several Vitest 4 edge cases that required pattern documentation.

### Discovery 1: Constructor Mocks

Error encountered:

```
TypeError: MemoryClient is not a constructor
```

Cause: Arrow functions can't be constructors in JavaScript/TypeScript. Vitest 4 enforces this.

Wrong pattern:

```typescript
vi.mock('mem0ai', () => ({
  MemoryClient: vi.fn(() => ({ add: vi.fn(), search: vi.fn() })),
}));
```

Correct pattern:

```typescript
vi.mock('mem0ai', () => ({
  MemoryClient: vi.fn(function() {
    return { add: vi.fn(), search: vi.fn() };
  }),
}));
```

Function expressions (not arrow functions) for class mocks.

### Discovery 2: Hoisted Mocks

Error encountered:

```
ReferenceError: Cannot access 'mockOpenAI' before initialization
```

Cause: Mock references created inside `vi.mock()` factory function aren't hoisted.

Wrong pattern:

```typescript
vi.mock('openai', () => {
  const client = { chat: { completions: { create: vi.fn() } } };
  return { OpenAI: vi.fn(() => client) };
});
```

Correct pattern:

```typescript
const mockOpenAI = vi.hoisted(() => ({
  chat: { completions: { create: vi.fn() } },
}));

vi.mock('openai', () => ({
  OpenAI: vi.fn(function() { return mockOpenAI; }),
}));
```

Use `vi.hoisted()` to create mock references, then reference them in the factory.

### Discovery 3: Enum Types

Error encountered:

```
Type '"text"' is not assignable to type 'GenerationType'
```

Cause: TypeScript strict mode doesn't coerce string literals to enum types.

Wrong pattern:

```typescript
const result = await generateContent(prompt, context, 'text', params);
```

Correct pattern:

```typescript
import { GenerationType } from './types';
const result = await generateContent(prompt, context, GenerationType.TEXT, params);
```

Always use enum values, not string literals.

These patterns are now documented in `/home/matt/.claude/projects/-home-matt-projects-ozskr/memory/patterns.md` and referenced by test-writer on every test file generation.

---

## What Worked Well

**1. Specialist agents prevent context dilution**

A single agent trying to implement blockchain + UI + API + tests would lose context. Specialist agents maintain focus. `solana-dev` knows Solana patterns deeply. `frontend-dev` knows React patterns deeply. No context switching.

**2. Security gating catches issues before merge**

`security-auditor` running after every Solana/DeFi change caught:
- Missing `assertIsAddress()` validation before RPC calls
- RLS policy gaps (users could read other users' generations)
- Moderation bypass path in social publish route
- Service role client misuse in background jobs

All flagged before code reached production.

**3. Test-writer ensures coverage discipline**

Human developers skip tests when rushing. `test-writer` agent has no concept of "rushing." Every feature gets test coverage. 482 tests across 48 files.

**4. Conventional commits via AI are remarkably consistent**

All commit messages follow conventional commit format:

```
feat(domain): brief summary

Detailed explanation of what changed and why.

- Bullet point details
- Acceptance criteria met

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

No "fix stuff", no "wip", no "asdf". Git log is readable.

**5. Parallelism via Agent Teams mode (experimental)**

When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is enabled, Opus can delegate to multiple agents in parallel using git worktrees. Example from Phase 1:

```
worktree: wt-auth → solana-dev → Wallet auth (SIWS), session handling
worktree: wt-ui → frontend-dev → Dashboard shell, design system
worktree: wt-api → api-architect → Hono scaffold, Supabase schema, RLS
worktree: wt-test → test-writer → Test infra, mock setup (watches other worktrees)
```

Result: 4 agents working in parallel, each on isolated worktrees. Opus merges when all complete. Reduces Phase 1 time from 8 hours sequential to 3 hours parallel (wall time).

---

## What Was Challenging

**1. Branch protection conflicts**

GitHub requires PRs for protected branches. Claude Code commits directly to the working branch. Solution: disable branch protection during development, re-enable before beta. Not ideal.

**2. Type inference with Hono**

Hono's type inference breaks if you mix `c.json()` return types or don't explicitly type middleware. Example:

```typescript
// Breaks type inference
app.get('/foo', async (c) => {
  if (condition) return c.json({ error: 'bad' }, 400);
  return c.json({ data: 'good' });
});

// Works
app.get('/foo', async (c): Promise<Response> => {
  if (condition) return c.json({ error: 'bad' }, 400);
  return c.json({ data: 'good' });
});
```

`api-architect` agent eventually learned this pattern but it took 3-4 iterations of type errors.

**3. Context limits on large refactors**

Opus 4.6 has a 200K token context window. Large refactors (e.g., migrating from Ayrshare-only to SocialPublisher abstraction) require reading 15+ files. Context window fills quickly. Solution: break into smaller work packages (WP 6.3.1: types + interface, WP 6.3.2: Ayrshare adapter, WP 6.3.3: Twitter adapter, WP 6.3.4: factory + tests).

**4. Supabase RLS policy debugging**

RLS policy errors are opaque: "permission denied for table X". No indication of which policy failed or why. `api-architect` agent had to use trial-and-error: disable policies one by one, test query, re-enable. Time-consuming.

**5. Test flakiness in E2E (Playwright)**

Wallet adapter mock in Playwright E2E tests was flaky (race condition between wallet connection and page load). `test-writer` added explicit `waitForSelector()` calls and retry logic. Still occasionally flaky. Human intervention required to add delays.

---

## Results: The Numbers

| Metric | Value |
|--------|-------|
| Lines of code | ~18,000 (TypeScript, SQL, config) |
| Test files | 48 |
| Tests | 482 (all passing) |
| Test coverage | 84% line coverage (target: 80%+) |
| Type errors | 0 (`pnpm typecheck` passes) |
| Security audit findings (critical) | 0 |
| Security audit findings (medium/low) | 9 (documented, non-blocking) |
| Git commits | 127 (including 8 merge commits) |
| Conventional commit compliance | 100% |
| Legal policy documents | 10 (5 complete, 5 in progress) |
| AI cost (total, 6 weeks) | ~$180 in Claude API calls (Opus 4.6 pricing) |
| Human developer time equivalent | ~8-10 weeks (estimated) |
| Actual wall time | 6 weeks (with overnight autonomous builds) |

---

## AI as Force Multiplier, Human Oversight Still Critical

Claude Code is a force multiplier, not a replacement. The orchestrator (Opus 4.6) plans, delegates, and reviews — but humans set the constraints, approve architectural decisions, and make final merge decisions.

**Where AI excelled:**

- Implementation speed (5-10x faster than human typing)
- Test coverage discipline (no skipping tests)
- Security review consistency (same checks every time, no fatigue)
- Documentation generation (README, legal docs, code comments)
- Pattern discovery (Vitest 4 edge cases, Hono type inference)

**Where humans were critical:**

- Architectural decisions (SocialPublisher abstraction vs vendor lock-in)
- Security escalations (RLS policy design, OAuth flow security)
- UX decisions (swap confirmation modal layout, color scheme)
- Legal review (flagging $HOPE language for attorney)
- Deployment decisions (Vercel vs Railway, mainnet vs devnet toggle)

The workflow isn't "AI writes code, human reviews." It's "human sets constraints, AI explores solution space, human approves direction, AI implements, review agents gate, human merges."

---

## What's Next

ozskr.ai is in alpha. Live at [ozskr.vercel.app](https://ozskr.vercel.app). Open source at [github.com/daftpixie/ozskr](https://github.com/daftpixie/ozskr).

Phase 6 (Launch Ops) is 70% complete:

- [x] CI/CD (GitHub Actions, branch protection, dependabot)
- [x] Production deployment (Vercel, edge auth gate, waitlist)
- [x] Security re-audit (0 critical findings)
- [x] Open-source docs (README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)
- [x] Legal docs (5/10 complete, attorney review queued)
- [ ] Marketing content (20+ tweets, 3 build-in-public threads, 2 blog posts, Product Hunt)
- [ ] Community infrastructure (Discord structure, Zealy quests, KOL briefing)
- [ ] Beta infrastructure (waitlist, feature flags, onboarding flow, feedback widget)
- [ ] Monitoring + alerting (error rate, cost spike alerts)

Beta target: March 2026. Mainnet launch: Q2 2026 (pending $HOPE token contract audit).

---

## Try Claude Code

If you're building a multi-domain project (blockchain + AI + UI + API), Claude Code's orchestrator pattern is worth exploring. Key takeaways:

1. **Specialist agents prevent context dilution.** Don't try to do everything in one agent.
2. **Review agents catch issues before merge.** Security-auditor and code-reviewer are non-negotiable.
3. **Test coverage discipline scales.** Test-writer ensures every feature has tests.
4. **Overnight autonomous builds work.** Queue up tasks, commit after each, review in morning.
5. **Human oversight is critical.** AI plans and implements, humans approve architecture and merge.

Claude Code is available at [claude.com/claude-code](https://claude.com/claude-code). The ozskr.ai codebase is the reference implementation for multi-agent orchestration at production scale.

---

**Links:**

- Live platform: [ozskr.vercel.app](https://ozskr.vercel.app)
- GitHub: [github.com/daftpixie/ozskr](https://github.com/daftpixie/ozskr)
- Twitter: [@ozskr_ai](https://twitter.com/ozskr_ai)
- Claude Code: [claude.com/claude-code](https://claude.com/claude-code)
- License: MIT

**Acknowledgments:**

Built exclusively with Claude Code (Opus 4.6). 10 specialist agents. 6 weeks. 482 tests. 0 critical security findings. Pay no mind to the agents behind the emerald curtain.
