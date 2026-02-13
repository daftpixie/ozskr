# Changelog

All notable changes to ozskr.ai will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - Phase 7: Go-to-Market

### Added
- AI compliance infrastructure:
  - Auto-AI-disclosure injection in SocialPublisher adapters (`#AIGenerated` tag)
  - Twitter adapter enforces 280-char limit with disclosure (truncates text, never drops tag)
  - Ayrshare adapter injects disclosure with no character limit
  - Endorsement content guardrails in moderation pipeline:
    - Investment language detection for $HOPE (SEC compliance, 9 regex patterns)
    - Endorsement disclosure enforcement (FTC 16 CFR §255)
    - Runs before OpenAI moderation (synchronous, fast)
  - 44 new tests (18 ai-disclosure + 26 endorsement-guardrails)
- New agent definitions:
  - `glinda-cmo`: Marketing strategy, community growth, social campaigns, KOL outreach
  - `toto-funding`: Grant applications, funding strategy, pitch materials
- Funding materials:
  - Solana Foundation grant application ($35K, 3 milestones over 6 months)
  - One-page project pitch document for partners/ecosystem funds
  - `.github/FUNDING.yml` for GitHub Sponsors integration

### Changed
- CLAUDE.md updated for Phase 7:
  - Phase 6 marked complete with detailed completion record
  - Phase 7 Go-to-Market sub-phases defined (7.1–7.8)
  - AI Compliance section (FTC, SEC, NY S.B. S6524-A)
  - $HOPE Token Reference language guide
  - Go-to-Market escalation rules
  - 2 new agents in ownership map
  - Key References table
- Test count: 587 passing across 58 files (up from 503/52)

### Sprint 2: Alpha Readiness + Content Activation

#### Added — Track A: Alpha Infrastructure
- Token-gated $HOPE access system:
  - `AccessTier` enum (ALPHA/BETA/EARLY_ACCESS/WAITLIST) with threshold-based determination
  - Cached balance checker via Helius `getTokenAccountsByOwner` with 5-min Redis TTL
  - Whitelist fallback for devnet/early alpha when Helius is unreachable
  - `AccessGate` component for feature gating with upgrade prompt + Jupiter link
  - 22 tests (tier boundaries, cache hit/miss, Helius fetch, whitelist tiers)
- Alpha whitelist management:
  - Supabase `alpha_whitelist` table with RLS (service role only)
  - Admin CRUD API: POST/GET/DELETE at `/api/admin-whitelist`
  - Non-admin wallets receive 404 (hides route existence)
  - Upsert support, Zod validation rejects WAITLIST tier
  - 9 tests covering admin gating, CRUD, validation
- Devnet testing configuration:
  - `scripts/devnet-setup.sh`: env validation, Solana CLI config, prereq checks
  - `docs/alpha-testing/devnet-guide.md`: comprehensive alpha testing guide
  - Added `HELIUS_API_KEY` and `ADMIN_WALLETS` to `.env.example`
- E2E Playwright tests:
  - `alpha-journey.spec.ts`: 8 scenarios (landing → dashboard → agents flow)
  - `access-gating.spec.ts`: 8 scenarios (auth redirects, admin endpoint guards)
- Feedback micro-surveys:
  - Supabase `feedback_surveys` table with RLS
  - `MicroSurvey` component for contextual feedback at key moments
  - Zustand store with localStorage persistence for dismissed surveys
  - 5 trigger points: first_generation, first_publish, third_agent, first_schedule, weekly_checkin
  - API route: POST `/api/feedback/survey` with Zod validation
  - 9 tests for store state management and config validation
- Admin alpha dashboard:
  - `/admin` page with platform metrics summary
  - Error rate alerts display for active monitoring
  - Whitelist CRUD UI: add/remove wallets with tier selection
  - Non-admin wallets see "Page Not Found" (hides route)

#### Added — Track B: Content Activation
- 2-week content calendar (Weeks 1-2, March 3-16, 2026)
- Publish-ready blog: "How We Built an AI Platform with Nothing But AI Agents"
- Publish-ready thread: 12-tweet build-in-public thread

#### Added — Track C: Business Development
- Comprehensive revenue model with margin analysis:
  - Cost per user: $12.71 (100 users) → $2.91 (10K users)
  - Pricing tiers: Starter $29, Creator $79, Pro $199 + $HOPE discount
  - Break-even at 3 paying users, 92%+ margin at 1,000 users
  - Sensitivity analysis: 81%+ margin even in worst case
- 3 partnership outreach templates (Jupiter, Anthropic, fal.ai)

## [0.6.0] - 2026-02-13 - Phase 6: Launch Operations

### Changed
- Brand realignment across entire frontend:
  - Replaced Geist fonts with brand stack: Satoshi (display), Inter (body), JetBrains Mono (code) via `next/font`
  - Added full design token system: Emerald City palette, brick palette, extended neutrals, brand shadows, glows, transitions
  - Added utility classes: `.font-display`, `.text-gradient-solana`, `.glow-emerald`, `.pattern-bricks`, `.logo-brick`, `.animate-fade-in-up`, stagger delays
  - Added brand keyframes: `curtain-reveal`, `fade-in-up`, `pulse-glow` with reduced-motion support
  - Updated landing page with Oz-themed copy, brick pattern background, entrance animations
  - Updated dashboard shell: logo-brick in sidebar/topbar, Oz-themed sidebar footer quote
  - Updated agent UI: brand-aligned copy for create wizard, generate modal, publish modal
  - Updated 11 remaining pages with `font-display` headings and thematic copy
  - Updated command bar, feedback widget with brand voice

### Added
- Monitoring and cost tracking infrastructure:
  - Error tracking middleware with hourly Redis counters per endpoint
  - Cost tracker for Claude API, fal.ai, and social publish costs
  - `platform_metrics` Supabase table with RLS (service role only)
  - Admin-only metrics API: `/admin/metrics/{errors,costs,summary}`
  - Alerts for >5% error rate and >2x daily cost spike detection
- Beta onboarding wizard (4-step flow):
  - Welcome screen with brand-aligned design
  - Waitlist status gating (approved/pending/not-on-list)
  - Profile setup with display name and content category preferences
  - First agent teaser with create/explore CTAs
  - OnboardingGuard component for dashboard route protection
- 21 new tests across monitoring and onboarding (503 total)
- SocialPublisher abstraction layer with adapter pattern:
  - Unified `SocialPublisher` interface for multi-provider publishing
  - `AyrshareAdapter` wrapping existing client ($0.01/platform/publish)
  - `TwitterAdapter` for zero-cost direct API publishing
  - Publisher factory with feature-flag driven provider selection
  - Per-publish cost tracking (`cost_usd`, `provider` columns on social_posts)
- Twitter/X direct API integration:
  - OAuth 2.0 PKCE flow (public client, no server-side secrets)
  - Encrypted token storage via pgcrypto (AES-256) in Supabase
  - Auto-refresh on expired tokens with 60-second buffer
  - Tweet posting with media upload (v2 API + v1.1 media endpoint)
  - Rate limiter with exponential backoff, jitter, and Retry-After support
  - Token revocation on account disconnect
- CI/CD pipeline with GitHub Actions:
  - Parallelized jobs: lint, typecheck, test, build
  - Automated security scanning with CodeQL and `pnpm audit`
  - Claude Code automated PR review for security-critical paths
- Feature flags system for progressive rollout
- Railway deployment configuration with preview environments
- Monitoring: health checks, error tracking, performance metrics
- Backup and disaster recovery procedures
- Secret rotation workflows with Infisical integration
- 63 new tests across SocialPublisher and Twitter integration
- Waitlist system with 500-spot cap, status endpoint, and remaining spots display
- Feature flags hardened with server-side verification via Supabase RPC
- In-app feedback widget with star rating, message, and Supabase storage

### Documentation
- Open-source README with Mermaid architecture diagram and quick-start guide
- CONTRIBUTING.md with AI-assisted development policy
- GitHub infrastructure: CODEOWNERS, issue/PR templates, dependabot, branch protection
- Legal policies — all 11/11 complete (attorney reviewed):
  - Privacy Policy, Terms of Service, Acceptable Use Policy
  - Token Disclaimer ($HOPE utility-only framing)
  - AI Content Disclosure, Token Usage Terms
  - Cookie Policy, Data Retention Policy, DMCA Policy
  - Content Moderation Policy, Wallet & Transaction Terms
- Marketing content:
  - 25-tweet backlog across 5 categories
  - 3 build-in-public Twitter thread scripts
  - 2 blog posts (architecture deep-dive + "How AI Built an AI Platform")
  - Product Hunt launch copy with maker comment and launch checklist
- Community infrastructure:
  - Discord server structure (7 categories, 20+ channels, roles, welcome flow)
  - Zealy quest campaign ("Follow the Yellow Brick Road", 20 quests across 4 tiers)
  - KOL briefing package (talking points, sample posts, FAQ, compliance notes)

### Changed
- Social publishing now supports dual providers (Ayrshare + Twitter direct)
- Enhanced worker architecture with Cloudflare Workers for edge compute
- Network configuration system with devnet/mainnet switching
- Improved RPC client with automatic failover and health monitoring

### Security
- Max swap slippage reduced from 300 bps to 100 bps (anti-sandwich protection)
- Twitter OAuth token revocation on account disconnect
- Pre-open-source security audit: secrets scan, RLS verification, OWASP review

## [0.5.0] - 2026-02-12 - Phase 5: Polish

### Added
- Gamification engine with points system, achievements, and streak tracking
- Leaderboard with global and friend rankings
- Achievement page with progress tracking and unlockable rewards
- Tier badges (Newbie, Rising Star, Influencer, Legend)
- Streak display with milestone celebrations
- Toast notifications for achievement unlocks
- Comprehensive Playwright E2E test suite:
  - Wallet connection and authentication flows
  - Agent creation and management
  - Content generation with SSE streaming
  - Trading and swap execution
  - Analytics dashboard interaction
  - Gamification features (achievements, leaderboard)
- Health check endpoints for monitoring

### Changed
- Production hardening: structured logging with correlation IDs and error context
- Enhanced error handling with graceful degradation
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- Bundle optimization: code splitting, tree shaking, dynamic imports
- React Query configuration tuning: stale times, cache management, deduplication
- Image optimization: Next.js Image component, WebP format, lazy loading
- Database connection pooling and query optimization

### Security
- Final pre-production security audit pass
- Environment variable validation with Zod schemas
- Sensitive data redaction in logs
- Rate limiting configuration for production
- Content Security Policy (CSP) enforcement
- Supabase RLS policy audit and hardening

### Fixed
- Memory leaks in SSE connections
- Race conditions in content generation pipeline
- Transaction confirmation polling edge cases
- Wallet adapter reconnection handling

## [0.4.0] - 2026-02-11 - Phase 4: Scale

### Added
- Trigger.dev integration for scheduled background jobs
- Automated content generation jobs with cron scheduling
- Ayrshare social media publishing integration:
  - Twitter, LinkedIn, Instagram, Facebook support
  - Post scheduling and queue management
  - Publishing status tracking
- Content calendar UI:
  - Weekly/monthly calendar views
  - Drag-and-drop scheduling
  - Publish now and schedule for later flows
  - Draft management
- Analytics dashboards with Recharts visualizations:
  - Agent performance metrics (engagement, reach, conversion)
  - Platform-wide statistics (total posts, active agents, user growth)
  - Time-series charts for trend analysis
  - Top performing content leaderboard
- $HOPE token integration:
  - Balance display in dashboard
  - Portfolio value tracking
  - Token metadata and price feed integration
  - Transaction history

### Changed
- Content generation pipeline optimized for scheduled execution
- Database schema extended for job tracking and publishing metadata
- React Query configuration for real-time analytics updates

### Performance
- Implemented data pagination for analytics queries
- Chart rendering optimized with memoization
- Background job queue with concurrency limits

## [0.3.0] - 2026-02-10 - Phase 3: Trading

### Added
- Jupiter Ultra swap client integration:
  - Quote fetching with route optimization
  - Priority fee calculation for faster settlement
  - Slippage tolerance configuration (default 50 bps)
- Transaction builder utilities using @solana/kit:
  - Functional transaction composition with `pipe()`
  - Address validation with `assertIsAddress()`
  - Amount handling with BigInt and `lamports()`
- Token utilities and SPL Token program integration
- Swap execution flow:
  - Pre-flight simulation (required before execution)
  - Transaction signing via wallet adapter
  - Confirmation polling with exponential backoff
  - Error handling and retry logic
- Trading UI components:
  - Swap interface with token selection and amount input
  - Real-time quote updates
  - Transaction preview with fee breakdown
  - Confirmation modal with transaction details
- Portfolio view:
  - Token balance display with USD values
  - 24h price change indicators
  - Portfolio allocation chart
- Trading history:
  - Transaction list with status indicators
  - Solana Explorer links
  - Filter by token and date range

### Security
- DeFi safety hardening:
  - Mandatory transaction simulation before execution
  - Slippage guards on all swap operations
  - Human-in-the-loop approval for all DeFi transactions
  - Input validation with Zod schemas
  - Amount overflow protection with BigInt
- Comprehensive edge case testing:
  - Insufficient balance scenarios
  - Slippage exceeded conditions
  - Transaction timeout handling
  - Network error recovery

### Changed
- Migrated from deprecated @solana/web3.js v1 to @solana/kit patterns
- Enhanced RPC client with Jupiter API integration

## [0.2.0] - 2026-02-09 - Phase 2: Agent Core

### Added
- Mastra AI agent framework integration:
  - Claude 3.5 Sonnet as reasoning engine
  - Tool calling for content generation and memory operations
  - Streaming response support with Server-Sent Events (SSE)
- Mem0 memory layer:
  - Per-character namespace isolation (security-critical)
  - Contextual memory retrieval for personalized content
  - Memory management API routes
  - Server-side enforcement of namespace boundaries
- 7-stage content generation pipeline:
  1. Parse: Request validation and intent extraction
  2. Context: Memory retrieval from Mem0
  3. Enhance: Prompt engineering with character DNA
  4. Generate: Claude API call with streaming
  5. Quality: Content quality scoring and refinement
  6. Moderate: AI-powered content moderation (toxicity, compliance)
  7. Store: Supabase persistence with metadata
- Character DNA system:
  - JSON-based character personality definitions
  - Voice, tone, style, and content preferences
  - Dynamic loading and validation
- Langfuse tracing integration:
  - Request/response logging for all Claude API calls
  - Performance metrics and cost tracking
  - Error monitoring and debugging
- Agent creation wizard:
  - Multi-step form with character DNA configuration
  - Real-time preview of agent personality
  - Image upload for avatar (fal.ai integration placeholder)
- Agent management UI:
  - Agent list with status indicators
  - Edit and delete operations
  - Character DNA editor
- Content generation interface:
  - Streaming content display with SSE
  - Real-time progress indicators
  - Regenerate and edit controls
- API routes:
  - POST /api/agents/create
  - GET /api/agents/list
  - POST /api/agents/generate (SSE endpoint)
  - POST /api/agents/memory/add
  - GET /api/agents/memory/retrieve

### Security
- Security review and hardening:
  - Removed error.message leaks in API responses
  - Enforced type safety in AI route handlers
  - Added input sanitization for user-provided content
  - Implemented rate limiting per wallet address
  - Mem0 namespace isolation enforcement (prevents cross-character memory access)
  - Content moderation pipeline (blocks toxic/prohibited content)

### Changed
- Enhanced error handling with structured error types
- Improved API response schemas with Zod validation

## [0.1.0] - 2026-02-08 - Phase 1: Foundation

### Added
- Next.js 15 App Router scaffold:
  - TypeScript 5.x with strict mode
  - App Router file structure
  - Server and client component patterns
- ozskr.ai design system:
  - Brand colors: Solana Purple (#9945FF), Solana Green (#14F195), Brick Gold (#F59E0B)
  - Dark mode default with Void Black (#0A0A0B) background
  - Typography: Satoshi (display), Inter (body), JetBrains Mono (code)
  - shadcn/ui component primitives
  - Tailwind CSS configuration
- Supabase integration:
  - Database schema with tables: users, agents, content, sessions
  - Row Level Security (RLS) policies on all tables
  - Auth context integration
  - TypeScript types generated from schema
- Hono API scaffold:
  - RESTful API routes with Zod validation
  - JWT middleware for protected routes
  - Error handling middleware
  - CORS configuration
- Sign-In with Solana (SIWS) authentication:
  - Wallet connection via @solana/wallet-adapter-react
  - Challenge-response flow with cryptographic signature verification
  - Session management with HTTP-only cookies
  - Automatic wallet reconnection
- Dashboard shell:
  - Responsive sidebar navigation
  - Command palette (Cmd+K / Ctrl+K)
  - User profile dropdown
  - Breadcrumb navigation
- Live SOL balance display:
  - Real-time balance fetching from Solana RPC
  - Auto-refresh on wallet change
  - Formatted display with lamport conversion
- Personalized welcome section:
  - Wallet address display (truncated)
  - Time-based greeting
  - Quick action cards
- Test infrastructure:
  - Vitest configuration for unit and integration tests
  - Solana devnet mock patterns
  - Supabase test client setup
  - API route testing utilities
  - Wallet adapter mocking for component tests

### Security
- Client-side wallet signing only (no server-side key handling)
- SIWS signature verification
- JWT-based session management with secure cookies
- Supabase RLS enforcement on all queries
- Environment variable validation

---

## Development Notes

- **Built exclusively with Claude Code** (Anthropic Claude Opus 4.6)
- All Solana transactions use @solana/kit functional patterns (no deprecated web3.js v1)
- All AI calls include Langfuse tracing for observability
- TypeScript strict mode enforced — no `any` types
- Conventional Commits used throughout
- Security-first approach: simulation before execution, human-in-the-loop approvals, content moderation

## License

Open Source - See LICENSE file for details

## Links

- **Repository**: https://github.com/daftpixie/ozskr
- **Documentation**: See /docs folder
- **Security**: See SECURITY.md
- **Contributing**: See CONTRIBUTING.md
