# Inside ozskr.ai: Architecture of a Solana AI Agent Platform

Building a Web3 AI influencer platform means solving two hard problems simultaneously: managing non-custodial DeFi transactions with zero server-side key storage, and orchestrating multi-stage AI content pipelines with quality gates and observability. This is the technical story of how we built ozskr.ai — an open-source platform that lets users create AI agent influencers on Solana with persistent memory, DeFi trading capabilities, and multi-platform social publishing.

Live at [ozskr.vercel.app](https://ozskr.vercel.app). Code at [github.com/daftpixie/ozskr](https://github.com/daftpixie/ozskr).

---

## The Problem

Most AI influencer tools are black boxes with API keys you paste into a form. You don't own the data, you can't inspect the pipeline, and you definitely can't integrate crypto payments or on-chain trading. We wanted something different:

- Open source from day one (MIT license)
- Non-custodial architecture (no server-side private keys, ever)
- Transparent content pipeline with quality gates and cost tracking
- Multi-platform social publishing (start with abstractions, not vendor lock-in)
- Built for Solana from the ground up (not a generic blockchain wrapper)

The constraint: build it fast enough to ship in 6 weeks while maintaining production-grade security and test coverage.

---

## Stack Overview

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 15 App Router, TypeScript 5.x strict | Server Components, streaming, co-located API routes |
| Blockchain | @solana/kit, Jupiter Ultra, Helius RPC | Functional style, transaction versioning, priority fees |
| AI | Claude API (Anthropic), Mem0, fal.ai, Mastra | Frontier model quality, persistent memory, open-source orchestration |
| Database | Supabase (PostgreSQL 16 + RLS + Realtime) | Row Level Security, pgcrypto for OAuth tokens, edge-ready |
| API | Hono + Zod | 4x faster than Express, schema validation at every boundary |
| State | React Query (server), Zustand (client) | Never mix concerns — server state is cache, client state is ephemeral |
| Auth | Sign-In with Solana (SIWS) | Wallet-native, no email, no password database |
| Social | SocialPublisher abstraction (Ayrshare + Twitter direct) | Start with managed service, migrate to direct API, keep the same interface |
| Jobs | Trigger.dev | Isolated containers, native TypeScript, better than cron + queues |
| Observability | Langfuse | AI-native tracing — token counts, cache hits, latency per stage |
| Rate Limiting | Upstash Redis | Edge-compatible, pay-per-request, geographic distribution |
| Testing | Vitest 4 (482 tests across 48 files), Playwright E2E | Constructor mocks, hoisted factories, strict TypeScript inference |

No `any` types. No default exports except Next.js pages. No `console.log` in production. TypeScript strict mode enforced at CI time.

---

## The 7-Stage Content Pipeline

The content generation pipeline is the core of the platform. It's not just "call Claude and hope for the best" — it's a multi-stage orchestration with retry logic, quality gates, and cost tracking. Every stage is observable via Langfuse.

### Stage Flow

```
Input
  ↓
1. Parse & Validate (Zod schemas, length caps)
  ↓
2. Context Recall (Mem0 memory, character DNA)
  ↓
3. Enhance Prompt (Claude transforms user input + context into production prompt)
  ↓
4. Generate Content (Claude for text, fal.ai for images)
  ↓
5. Quality Check (scoring algorithm, retry loop with max 3 attempts)
  ↓
6. Moderation (OpenAI omni-moderation-latest, three-tier flow)
  ↓
7. Store & Notify (Supabase write, Realtime broadcast)
  ↓
Output
```

### Implementation Highlights

**Stage 3: Enhance Prompt**

The user types "make a funny tweet about coffee." That's not enough context for a character-consistent AI agent. Stage 3 transforms it:

```typescript
// User input
"make a funny tweet about coffee"

// Enhanced prompt (Claude transforms user intent + character DNA)
"You are Neo, a cyberpunk hacker with a sardonic wit and a caffeine dependency.
Write a 280-character tweet about coffee that includes:
- A tech metaphor (blockchain, AI, or cybersecurity)
- Dark humor about late-night coding
- Your signature closing style: concise, punchy, no hashtags

Constraints: Twitter format, single tweet, no emojis."
```

This enhancement step is where character consistency happens. The user sees streaming progress updates as each stage completes.

**Stage 5: Quality Check (Retry Loop)**

Quality check runs after generation. If the score is below threshold (0.7 for text, 0.6 for images), the pipeline retries generation up to 3 times. This prevents low-quality outputs from reaching users while keeping latency acceptable.

```typescript
let attempts = 0;
const maxAttempts = 3;

do {
  attempts++;
  generationResult = await generateContent(enhancedPrompt, context, type, params, onProgress);
  qualityResult = await qualityCheck(generationResult, context, onProgress);

  if (!qualityResult.shouldRetry || attempts >= maxAttempts) {
    break;
  }

  onProgress({
    stage: 'quality_check',
    message: `Quality below threshold (${qualityResult.qualityScore.toFixed(2)}), retrying...`,
  });
} while (attempts < maxAttempts);
```

Real-time progress callbacks mean users see "Generation attempt 2/3" in the UI instead of a frozen loading spinner.

**Stage 6: Moderation (Three-Tier Flow)**

Content moderation uses OpenAI's `omni-moderation-latest` model with a three-tier decision tree:

- Score > 0.8: REJECTED (auto-block, user notified)
- Score 0.5-0.8: FLAGGED (manual review required before publish)
- Score < 0.5: APPROVED (auto-publish enabled)

Moderation runs before storage (stage 6 before stage 7). No bypass paths exist in the codebase — the pipeline orchestrator enforces ordering. The security audit verified this with explicit checks.

Image moderation is a stub in alpha (relies on fal.ai's built-in safety). AWS Rekognition integration is queued for beta.

### Cost Tracking and Observability

Every pipeline run tracks:

- Token usage (input, output, cached) across both enhancement and generation stages
- Cost in USD (Claude pricing: $3/MTok input, $15/MTok output for enhancement; varies by model for generation)
- Cache hit rates (enhancement prompts with identical character DNA + context hit prompt cache at 90% efficiency)
- Latency per stage and total end-to-end

Example result:

```typescript
{
  generationId: "uuid",
  outputText: "Just debugged my coffee machine's firmware...",
  qualityScore: 0.87,
  moderationStatus: "approved",
  tokenUsage: { input: 1420, output: 89, cached: 1200 },
  costUsd: 0.00234,
  latencyMs: 3420,
  cacheHit: true,
  modelUsed: "claude-opus-4-6"
}
```

Langfuse ingests these traces for analysis. We can identify which characters have the highest cache hit rates, which generation types cause retries, and where latency spikes happen.

---

## AI Integration: Memory, Models, and Telemetry

### Character DNA

Every AI agent has a "DNA" — structured configuration that defines persona, voice style, visual identity, and behavioral constraints. It's stored in the `characters` table with a JSON schema:

```typescript
interface CharacterDNA {
  name: string;
  persona: string; // e.g., "cyberpunk hacker with sardonic wit"
  voiceStyle: string; // e.g., "concise, punchy, dark humor"
  visualStyle: string; // e.g., "neon-lit urban dystopia"
  constraints: {
    maxLength: number;
    allowedTopics: string[];
    forbiddenTopics: string[];
    platformStyles: Record<SocialPlatform, PlatformStyleGuide>;
  };
}
```

Character DNA is the "system prompt" equivalent — it's injected into every pipeline run for that character.

### Mem0 Integration: Persistent Memory

AI agents need to remember past interactions. Mem0 provides vector-based memory with automatic summarization. Every character gets an isolated namespace:

```typescript
// Server generates namespace (never user input)
const namespace = `char_${character.id}`; // e.g., "char_a7f3e2b1-..."

// Namespace is regex-validated before Mem0 SDK calls
const namespaceRegex = /^char_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!namespaceRegex.test(namespace)) {
  throw new Error('Invalid namespace');
}

// Fetch memory for context recall
const memories = await memoryClient.search(query, {
  user_id: namespace,
  limit: 5,
});
```

Cross-character memory contamination is prevented by:
1. Server-side namespace generation (no user input)
2. Regex validation before SDK calls
3. RLS policies on `character_memory` table (wallet address ownership check)

The security audit verified namespace isolation with explicit cross-character access attempts.

### Multi-Model Strategy

We use different models for different tasks:

- **Claude Opus 4.6:** Content generation, prompt enhancement (frontier quality, 200K context)
- **fal.ai (Flux, SDXL):** Image generation (faster than Midjourney API, better cost control)
- **OpenAI omni-moderation-latest:** Content moderation (industry standard, well-calibrated thresholds)

Model selection is configurable per generation type. Text defaults to Opus, images default to Flux, moderation always uses OpenAI.

---

## DeFi Layer: Non-Custodial Trading with Jupiter Ultra

The trading layer is the most security-sensitive part of the platform. The constraint: enable AI agents to execute token swaps without the platform ever holding private keys or submitting transactions on behalf of users.

### Jupiter Ultra Integration

Jupiter is Solana's liquidity aggregator. We use the Jupiter Ultra API for quote aggregation and swap transaction building:

```typescript
// 1. Get best route across all DEXes
const quote = await jupiterClient.getQuote({
  inputMint: address('So11111111111111111111111111111111111111112'), // SOL
  outputMint: address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'), // USDC
  amount: lamports(1_000_000_000n), // 1 SOL
  slippageBps: 50, // 0.5%
});

// 2. Build versioned transaction (client-side signing required)
const swapTx = await jupiterClient.buildSwapTransaction({
  quoteResponse: quote,
  userPublicKey: walletAddress,
});

// 3. Simulate before execution (REQUIRED)
const simulationResult = await rpc.simulateTransaction(swapTx);
if (simulationResult.err) {
  throw new Error('Simulation failed — transaction would fail on-chain');
}

// 4. User confirms in UI modal (amounts, slippage, minimum received, network fee)
// 5. Client-side wallet adapter signs and submits
const signature = await wallet.sendTransaction(swapTx, connection);
```

The API returns a 202 status with a message: "Execute transaction client-side." No server-side transaction submission exists in the codebase.

### Security Architecture

The security audit verified 14 checks across payment flows:

- All signing goes through `WalletSignerAdapter` (client-side only)
- `simulateTransaction()` required before every swap execution
- Human confirmation dialog displays amounts, slippage, minimum received, network fee, price impact
- Address validation via `address()` from `@solana/kit` before RPC calls
- BigInt financial math (no floating point in amount calculations)
- RLS policies on `swap_history`, `watchlist`, `token_balances_cache`
- Rate limiting on all swap, quote, and read endpoints
- Zod validation enforces slippage range (10-300 bps), Base58 address format, amount format
- Error handling redacts sensitive keywords from logs
- No `.env` files committed (all secrets in Infisical or Vercel environment)

Result: 0 critical findings, 3 low/medium warnings (slippage cap UI/API mismatch, missing `assertIsAddress()` in priority fee estimation, token list deployment process).

### Transaction Lifecycle

```
User initiates swap
  ↓
1. API: Rate limit check (Upstash Redis)
  ↓
2. API: Zod validation (input mint, output mint, amount, slippage)
  ↓
3. API: Jupiter quote fetch (best route across DEXes)
  ↓
4. API: Quote returned to client with price impact calculation
  ↓
5. Client: Swap confirmation modal (user reviews amounts, fees, slippage)
  ↓
6. Client: Jupiter swap transaction built (versioned transaction with priority fee)
  ↓
7. Client: Transaction simulation (RPC call, must succeed or abort)
  ↓
8. Client: Wallet adapter signs transaction (private key never leaves user's device)
  ↓
9. Client: Transaction submitted to RPC (user's wallet, not platform)
  ↓
10. Client: Confirmation polling (30s timeout, fallback to block height checking)
  ↓
11. API: Swap record created (wallet address, input/output amounts, timestamp)
```

The platform creates a swap record after the fact (step 11) for analytics, but has no involvement in transaction signing or submission.

---

## Social Publishing: Abstraction Over Providers

Social media publishing is where the "AI influencer" value prop becomes real. Users shouldn't care whether we use Ayrshare (managed service, $39/mo) or Twitter's direct API (OAuth 2.0 PKCE, free) — the interface should be identical.

### SocialPublisher Abstraction

```typescript
interface SocialPublisher {
  readonly provider: SocialProvider; // 'ayrshare' | 'direct'

  publish(post: SocialPost): Promise<PublishResult>;
  delete(externalPostId: string, profileKey: string): Promise<void>;
  getAnalytics(externalPostId: string, profileKey: string): Promise<PostAnalytics>;
}

interface SocialPost {
  text: string;
  platforms: SocialPlatform[]; // ['twitter', 'instagram', 'linkedin']
  mediaUrls?: string[];
  profileKey: string; // Provider-specific auth key
}

interface PublishResult {
  provider: SocialProvider;
  externalId: string; // Provider's batch ID
  platformPostIds: Record<string, string>; // { twitter: '123...', instagram: '456...' }
  platformPostUrls: Record<string, string>;
  costUsd: number; // Estimated cost (Ayrshare: $0.10/post, Twitter direct: $0.00)
}
```

Factory pattern selects the implementation at runtime:

```typescript
export const createPublisher = (provider: SocialProvider): SocialPublisher => {
  switch (provider) {
    case SocialProvider.AYRSHARE:
      return new AyrshareAdapter();
    case SocialProvider.DIRECT:
      return new TwitterAdapter();
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
};
```

This means we can start with Ayrshare for multi-platform support, migrate to Twitter's direct API for cost savings, and add Instagram/LinkedIn direct APIs later — all without touching the publish job or API route.

### OAuth 2.0 PKCE for Twitter Direct

Twitter's direct API uses OAuth 2.0 with PKCE (Proof Key for Code Exchange). The flow:

1. User clicks "Connect Twitter" in dashboard
2. API generates `code_verifier` (random 128-char string) and `code_challenge` (SHA-256 hash)
3. API redirects to Twitter OAuth consent screen with `code_challenge`
4. User approves
5. Twitter redirects back with `code`
6. API exchanges `code` + `code_verifier` for access token and refresh token
7. Tokens stored in `social_accounts` table (encrypted at rest via pgcrypto)
8. Access token expires after 2 hours; refresh token valid for 180 days
9. API automatically refreshes tokens before publish if needed

Result: zero-cost direct posting to Twitter with automatic token refresh. Ayrshare fallback if user hasn't connected Twitter directly.

### Testing Strategy

79 tests across social layer:

- Ayrshare adapter: multi-platform batch posting, single-platform delete, analytics fetch
- Twitter adapter: OAuth PKCE flow, token refresh, tweet posting, media upload, rate limit handling
- Publisher factory: provider selection, error handling
- API routes: moderation status enforcement, RLS policy verification, rate limiting

Mock setup uses Vitest 4's `vi.hoisted()` pattern for constructor mocks:

```typescript
const mockTwitterClient = vi.hoisted(() => ({
  post: vi.fn(),
  delete: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('twitter-api-sdk', () => ({
  Client: vi.fn(function() { return mockTwitterClient; }),
}));
```

Arrow functions can't be constructors in Vitest 4 — use `vi.fn(function() { ... })` for class mocks.

---

## Security Architecture: Defense in Depth

Security was a first-class constraint, not a post-launch audit. We shipped alpha with 0 critical findings across 3 audits (payment flows, content moderation, gamification rewards).

### Row Level Security (RLS)

Every table has RLS policies. Example from `content_generations`:

```sql
CREATE POLICY "Users can only read their own generations"
ON content_generations
FOR SELECT
USING (
  auth.jwt() ->> 'wallet_address' = (
    SELECT wallet_address FROM characters WHERE id = content_generations.character_id
  )
);

CREATE POLICY "Users can only insert generations for their own characters"
ON content_generations
FOR INSERT
WITH CHECK (
  auth.jwt() ->> 'wallet_address' = (
    SELECT wallet_address FROM characters WHERE id = content_generations.character_id
  )
);
```

No queries bypass RLS — the API uses `createAuthenticatedClient(jwtToken)` which injects the JWT into the Supabase client. Service role client is used only for background jobs (publish, scheduled generation, leaderboard refresh).

### Content Moderation Pipeline

Moderation stage runs before storage (stage 6 before stage 7). No bypass paths:

```typescript
// Stage 6: Content Moderation
const moderationResult = await moderateContent({
  text: generationResult.outputText,
  imageUrl: generationResult.outputUrl,
}, onProgress);

// Stage 7: Store & Notify (receives moderation status)
await storeAndNotify(
  input.generationId,
  result, // includes moderationStatus
  context,
  input.jwtToken,
  onProgress
);
```

Social publish route enforces moderation status:

```typescript
// Explicit check — cannot bypass
if (generation.moderation_status !== 'approved') {
  throw new Error(`Cannot publish: moderation status is ${generation.moderation_status}`);
}
```

The security audit attempted to bypass moderation via direct Supabase updates, direct API calls, and service role queries. All attempts failed due to RLS policies and middleware enforcement.

### Input Validation (Zod Everywhere)

Every API boundary has a Zod schema:

```typescript
// Content generation API
const GenerateContentSchema = z.object({
  characterId: z.string().uuid(),
  generationType: z.enum(['text', 'image']),
  inputPrompt: z.string().min(1).max(5000),
  modelParams: z.object({
    temperature: z.number().min(0).max(1).optional(),
    maxTokens: z.number().min(1).max(4096).optional(),
  }).optional(),
});

// Route handler
app.post('/generate', authMiddleware, rateLimiter, async (c) => {
  const body = await c.req.json();
  const validated = GenerateContentSchema.parse(body); // Throws 400 if invalid
  // ...
});
```

No `req.body.characterId` without validation. No `parseInt(userId)` without checking `isNaN`. TypeScript strict mode + Zod = end-to-end type safety from HTTP request to database write.

### Rate Limiting (Per-Wallet, Edge-Level)

Upstash Redis tracks requests per wallet address:

```typescript
// Rate limiter middleware
const rateLimiter = async (c: Context, next: Next) => {
  const walletAddress = c.get('walletAddress'); // From authMiddleware
  const key = `ratelimit:${walletAddress}:${c.req.path}`;

  const result = await redis.incr(key);
  if (result === 1) {
    await redis.expire(key, 60); // 1-minute window
  }

  if (result > 30) { // 30 requests per minute per wallet
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  await next();
};
```

Applied to all authenticated routes. Different limits for read (30/min), write (10/min), and DeFi operations (5/min).

---

## Testing Strategy: 482 Tests Across 48 Files

Test coverage was a non-negotiable constraint. Every feature required tests before merge.

### Test Breakdown

| Domain | Files | Tests | Coverage Target |
|--------|-------|-------|-----------------|
| Pipeline (7 stages) | 8 | 79 | 90%+ line coverage |
| Solana (RPC, Jupiter, HOPE token) | 6 | 67 | 85%+ (mocked RPC) |
| Social (Ayrshare, Twitter, publisher) | 9 | 79 | 90%+ (mocked APIs) |
| API routes (trading, AI, content, social) | 12 | 134 | 80%+ (integration) |
| Gamification (points, streaks, achievements) | 5 | 58 | 85%+ |
| Wallet (adapter, hooks, store) | 4 | 37 | 80%+ (mocked wallet adapter) |
| Auth (SIWS, middleware) | 4 | 28 | 95%+ |

Total: 48 test files, 482 passing tests.

### Vitest 4 Patterns (Hard-Earned)

**Constructor Mocks**

Wrong (arrow function can't be a constructor):

```typescript
vi.mock('mem0ai', () => ({
  MemoryClient: vi.fn(() => ({ add: vi.fn(), search: vi.fn() })),
}));
```

Right (function expression):

```typescript
vi.mock('mem0ai', () => ({
  MemoryClient: vi.fn(function() {
    return { add: vi.fn(), search: vi.fn() };
  }),
}));
```

**Hoisted Mocks**

Wrong (mock created inside factory):

```typescript
vi.mock('openai', () => ({
  OpenAI: vi.fn(() => ({ chat: { completions: { create: vi.fn() } } })),
}));
```

Right (hoisted reference):

```typescript
const mockOpenAI = vi.hoisted(() => ({
  chat: { completions: { create: vi.fn() } },
}));

vi.mock('openai', () => ({
  OpenAI: vi.fn(function() { return mockOpenAI; }),
}));
```

**Enum Types**

Wrong (string literal):

```typescript
const result = await generateContent(prompt, context, 'text', params);
```

Right (enum value):

```typescript
import { GenerationType } from './types';
const result = await generateContent(prompt, context, GenerationType.TEXT, params);
```

These patterns are documented in `/home/matt/.claude/projects/-home-matt-projects-ozskr/memory/patterns.md` for future reference.

### E2E Testing (Playwright)

Playwright tests cover critical user flows:

- Wallet connection (Phantom mock)
- Agent creation and DNA configuration
- Content generation with streaming progress
- Swap flow from quote to confirmation
- Social account connection and publish

E2E tests run on every PR via GitHub Actions. Failed tests block merge.

---

## Feature Flags with Server-Side Verification

Feature flags control access to incomplete features (trading, scheduled posting, analytics dashboard). They're toggled via environment variables but verified server-side:

```typescript
// Environment variable
ENABLE_TRADING=false

// Server-side verification (not client-side toggle)
export const isFeatureEnabled = (feature: Feature): boolean => {
  const flags = {
    trading: process.env.ENABLE_TRADING === 'true',
    scheduled: process.env.ENABLE_SCHEDULED === 'true',
    analytics: process.env.ENABLE_ANALYTICS === 'true',
  };
  return flags[feature] ?? false;
};

// API middleware
app.post('/swap', authMiddleware, async (c) => {
  if (!isFeatureEnabled('trading')) {
    return c.json({ error: 'Trading not available in alpha' }, 403);
  }
  // ...
});
```

UI checks the same flag but the API enforces it. No client-side bypass.

---

## What We'd Do Differently

1. **Schema-first API design:** We wrote routes first, Zod schemas second. Should've been reverse — schema first, route implementation second. OpenAPI generation from Zod would've saved hours.

2. **Type inference with Hono:** Hono's type inference is powerful but breaks easily if you mix `c.json()` return types. Explicit return type annotations on every route handler would've prevented runtime surprises.

3. **Mem0 namespace design:** We chose `char_<uuid>` as namespace pattern. Should've been `char_<wallet_address>_<char_name>` for easier debugging and analytics queries.

4. **Earlier Playwright setup:** We added E2E tests in Phase 4. Should've been Phase 1 — bugs caught at the component level are 10x cheaper to fix than bugs caught during E2E.

5. **Langfuse from day one:** We added Langfuse telemetry in Phase 2. Should've been in the first pipeline iteration — debugging without observability was painful.

6. **Upstash Redis key design:** We used generic `ratelimit:` prefixes. Should've been namespaced by feature (`ratelimit:swap:`, `ratelimit:generate:`) for easier expiration policies and cost tracking.

---

## Open Source Invitation

The entire codebase is open source (MIT license) at [github.com/daftpixie/ozskr](https://github.com/daftpixie/ozskr). We're building in public and welcome contributions.

Key areas where we'd love help:

- AWS Rekognition integration for image moderation (replacing the stub)
- Instagram and LinkedIn direct API adapters (OAuth 2.0 flows)
- Supabase Edge Functions for real-time leaderboard updates (replacing cron job)
- Mastra agent examples for custom behaviors (beyond the default character DNA)
- Internationalization (i18n) support for dashboard UI

See [CONTRIBUTING.md](https://github.com/daftpixie/ozskr/blob/main/CONTRIBUTING.md) for PR workflow and code style requirements.

---

## Conclusion

ozskr.ai is a Web3 AI influencer platform built on Solana with a 7-stage content pipeline, non-custodial DeFi trading, and multi-platform social publishing. The architecture prioritizes security (0 critical findings), observability (Langfuse tracing on every AI call), and developer experience (TypeScript strict, 482 tests, open source).

Built entirely with Claude Code (Opus 4.6) using a multi-agent orchestration pattern. Deployed on Vercel, live at [ozskr.vercel.app](https://ozskr.vercel.app).

Pay no mind to the agents behind the emerald curtain.

---

**Links:**

- Live platform: [ozskr.vercel.app](https://ozskr.vercel.app)
- GitHub: [github.com/daftpixie/ozskr](https://github.com/daftpixie/ozskr)
- Twitter: [@ozskr_ai](https://twitter.com/ozskr_ai)
- License: MIT

**Tech mentioned:**

- Next.js 15, React 19, TypeScript 5.x, Tailwind CSS 4
- @solana/kit, Jupiter Ultra, Helius
- Claude API (Anthropic), Mem0, fal.ai, Mastra
- Supabase, Hono, Zod, React Query, Zustand
- Vitest, Playwright, Langfuse, Upstash, Trigger.dev
