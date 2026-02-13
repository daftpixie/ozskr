# ozskr.ai KOL Briefing Package

**Version:** 1.0.0
**Last Updated:** February 13, 2026
**Status:** Pre-Alpha (Waitlist Open)

---

## Project Overview

ozskr.ai is an open-source Web3 AI Influencer Platform built on Solana that enables creators to deploy autonomous AI agents with persistent memory, content generation capabilities, and non-custodial DeFi integration. The platform features a 7-stage content pipeline with automated moderation, real-time streaming generation, and integration with Jupiter Ultra for on-chain trading — all built entirely using Claude Code (Opus 4.6).

**The Problem:** Current AI agent platforms either lack blockchain integration, require custodial control of funds, or produce low-quality content without proper moderation pipelines. Creators need a platform that combines sophisticated AI capabilities, Web3-native functionality, and security-first architecture.

**Current Status:** Alpha build complete with 482 passing tests across 45 test files. Waitlist open for 500 initial spots at ozskr.vercel.app. Pre-alpha security audit passed with zero critical vulnerabilities. Open-source repository live at github.com/daftpixie/ozskr under MIT license.

**Key Metrics:**
- TypeScript strict mode with 100% type coverage
- 482 tests across unit, integration, and E2E layers
- Tech stack: Next.js 15, @solana/kit, Vercel AI SDK, Claude API, Mastra agents, Mem0 memory
- 6 phases completed: Foundation, Agent Core, Trading, Hardening, Polish, Launch Ops (in progress)
- Security-first: pre-alpha audit completed, Supabase RLS policies on all tables, client-side signing only
- Non-custodial architecture: no server-side key handling, wallet adapter integration

---

## Key Differentiators

### 1. Built Entirely with Claude Code
The entire platform — from architecture to implementation to documentation — was built using Claude Code's Opus 4.6 orchestrator with specialized subagents. This meta-narrative (AI building AI tools) demonstrates the sophistication of modern AI-assisted development and provides complete transparency through the open-source codebase.

### 2. Non-Custodial DeFi Integration
ozskr.ai integrates Jupiter Ultra for on-chain swaps without ever handling user private keys. All transaction signing happens client-side via Solana wallet adapters. The platform cannot execute transactions on behalf of users — every DeFi operation requires explicit human approval.

### 3. 7-Stage Content Pipeline with Automated Moderation
Every piece of AI-generated content passes through a rigorous pipeline: parse → context → enhance → generate → quality → moderation → store. Content moderation runs before storage or publication, filtering harmful content, hate speech, and policy violations. Quality gates ensure coherence and brand alignment.

### 4. Persistent AI Memory Per Agent
Each AI agent has isolated memory powered by Mem0, enabling context-aware conversations, learning from interactions, and maintaining character consistency over time. Memory namespaces are server-side enforced to prevent cross-agent data leakage.

### 5. Open Source Under MIT License
The entire codebase is open source at github.com/daftpixie/ozskr. No proprietary black boxes. Full transparency into security patterns, AI integration, and DeFi logic. Community contributions welcome via standard GitHub PR workflow.

### 6. Security-First Architecture
482 tests ensure code quality. Pre-alpha security audit passed with zero critical vulnerabilities. Supabase Row-Level Security policies on every table. Rate limiting per-wallet at edge layer. Transaction simulation required before execution. Slippage guards on all swap operations. Human-in-the-loop approval for DeFi transactions.

---

## Talking Points

1. **ozskr.ai is the first AI agent platform built entirely with AI** — the entire codebase was developed using Claude Code's Opus 4.6 orchestrator, proving AI can build production-grade Web3 infrastructure.

2. **Non-custodial by design** — ozskr.ai never holds your private keys. All transaction signing happens client-side via Solana wallet adapters. Your funds, your control.

3. **7-stage content pipeline ensures quality** — every AI-generated post passes through automated moderation, quality checks, and policy enforcement before publication. No unfiltered AI spam.

4. **Agents remember conversations** — persistent memory via Mem0 means your AI agent learns from interactions, maintains character consistency, and provides context-aware responses over time.

5. **Built on Solana for speed and cost** — leverage Solana's high throughput and low transaction fees for AI agent operations, content storage, and DeFi integration.

6. **Open source under MIT license** — full codebase transparency at github.com/daftpixie/ozskr. 482 tests, TypeScript strict mode, zero proprietary black boxes.

7. **Pay no mind to the agents behind the emerald curtain** — Wizard of Oz theming reflects the platform's philosophy: sophisticated AI working behind the scenes while you maintain full control.

8. **$HOPE is a utility token, not an investment** — use $HOPE to unlock premium features, access tier benefits, and participate in platform governance. No price promises, no yield guarantees.

9. **Security-first from day one** — pre-alpha security audit passed with zero critical vulnerabilities. Supabase RLS policies, edge rate limiting, transaction simulation, and slippage guards protect users.

10. **Alpha waitlist open for 500 creators** — join the first wave at ozskr.vercel.app. Build-in-public transparency, weekly updates, and direct feedback loop with the core team.

---

## Sample Posts

### Short Tweet (280 chars)

```
ozskr.ai is live in alpha — the first AI agent platform built entirely with AI.

Non-custodial DeFi, persistent memory, 7-stage content moderation, open source.

Built with Claude Code. 482 tests. Zero critical vulnerabilities.

Waitlist open: ozskr.vercel.app
```

### Medium Post (2-3 tweets / short thread)

```
1/ ozskr.ai just launched alpha access — a Web3 AI Influencer Platform built entirely with Claude Code.

The meta-narrative: AI building AI tools. The result: production-grade infrastructure with 482 tests and zero critical vulnerabilities.

2/ What makes it different:
- Non-custodial DeFi (Jupiter Ultra integration)
- Persistent AI memory per agent (Mem0)
- 7-stage content pipeline with automated moderation
- Open source under MIT license (github.com/daftpixie/ozskr)

3/ Wizard of Oz theming: "Pay no mind to the agents behind the emerald curtain."

Sophisticated AI works behind the scenes. You maintain full control. Your keys, your funds, your content.

Waitlist open for 500 spots: ozskr.vercel.app
```

### Detailed Overview (5+ tweet thread)

```
1/ Announcing ozskr.ai — a Web3 AI Influencer Platform on Solana that's redefining how creators deploy autonomous agents.

The twist? The entire platform was built with Claude Code's Opus 4.6 orchestrator. AI building AI tools.

Here's what makes it special:

2/ Non-Custodial by Design

ozskr.ai never touches your private keys. All transaction signing happens client-side via Solana wallet adapters.

Jupiter Ultra integration for swaps. Human-in-the-loop approval for every DeFi operation. Your funds, your control.

3/ 7-Stage Content Pipeline

Every AI-generated post passes through:
- Parse → Context → Enhance → Generate → Quality → Moderation → Store

Content moderation runs BEFORE publication. No unfiltered AI spam. No policy violations. Quality gates enforce coherence and brand alignment.

4/ Persistent AI Memory

Each agent has isolated memory powered by Mem0. Agents remember conversations, learn from interactions, and maintain character consistency over time.

Memory namespaces are server-side enforced to prevent cross-agent data leakage.

5/ Security-First Architecture

- 482 tests across 45 test files
- Pre-alpha security audit: zero critical vulnerabilities
- Supabase RLS policies on every table
- Edge rate limiting per wallet
- Transaction simulation before execution
- Slippage guards on all swaps

6/ Open Source Under MIT License

Full codebase transparency at github.com/daftpixie/ozskr. TypeScript strict mode. No proprietary black boxes. Community contributions welcome.

See exactly how AI agents, DeFi integration, and content moderation work under the hood.

7/ Wizard of Oz Theming

"Pay no mind to the agents behind the emerald curtain."

Sophisticated AI works behind the scenes. You pull the levers. The platform handles complexity while you maintain creative control.

8/ $HOPE Utility Token

$HOPE unlocks premium features, tier benefits, and platform governance. It's a utility token — NOT an investment.

No price predictions. No yield promises. Access-focused design. See docs/legal/token-disclaimer.md for full details.

9/ Current Status

Alpha build complete. Waitlist open for 500 initial spots. Weekly build-in-public updates. Direct feedback loop with the core team.

Join the first wave: ozskr.vercel.app
Follow: @ozskr_ai
GitHub: github.com/daftpixie/ozskr

/end
```

---

## Key Links

- **Website:** https://ozskr.vercel.app
- **GitHub Repository:** https://github.com/daftpixie/ozskr
- **Twitter:** https://twitter.com/ozskr_ai
- **Discord:** [Discord invite link — TBD in Phase 6.11]
- **Waitlist:** https://ozskr.vercel.app (embedded on landing page)

**Legal Documentation:**
- Token Disclaimer: `/docs/legal/token-disclaimer.md`
- Privacy Policy: `/docs/legal/privacy-policy.md`
- Terms of Service: `/docs/legal/terms-of-service.md`
- Acceptable Use Policy: `/docs/legal/acceptable-use-policy.md`
- AI Content Disclosure: `/docs/legal/ai-content-disclosure.md`

**Technical Documentation:**
- README: `/README.md`
- Contributing Guide: `/CONTRIBUTING.md`
- Security Policy: `/SECURITY.md`
- Code of Conduct: `/CODE_OF_CONDUCT.md`
- Security Audit Report: `/docs/security-audit-pre-alpha.md`

---

## FAQ for KOLs

### 1. What is ozskr.ai?

ozskr.ai is an open-source Web3 AI Influencer Platform built on Solana. It enables creators to deploy autonomous AI agents with persistent memory, content generation capabilities, and non-custodial DeFi integration. The platform features a 7-stage content pipeline with automated moderation and real-time streaming generation.

### 2. Is it on mainnet?

Not yet. The platform currently operates on Solana devnet. Mainnet deployment is planned after beta testing is complete and a formal smart contract audit is conducted (budgeted at $15-30K for the Auto-Stake Smart Contract). The network can be toggled via the `SOLANA_NETWORK` environment variable.

### 3. What is $HOPE?

$HOPE is ozskr.ai's utility token. It unlocks premium features, tier benefits, and platform governance participation. **$HOPE is NOT an investment vehicle.** It does not promise returns, yield, or price appreciation. It is strictly a utility token for accessing platform functionality. See `/docs/legal/token-disclaimer.md` for full legal details.

### 4. Is it safe to use?

Yes. ozskr.ai is built with security-first architecture:
- Pre-alpha security audit passed with zero critical vulnerabilities
- Non-custodial design: the platform never handles your private keys
- All transaction signing happens client-side via Solana wallet adapters
- Supabase Row-Level Security policies on every database table
- Edge rate limiting per wallet to prevent abuse
- Transaction simulation required before execution
- 482 tests across 45 test files ensure code quality

### 5. How was it built?

The entire platform was built using Claude Code's Opus 4.6 orchestrator with specialized subagents. This includes architecture, implementation, testing, documentation, and security review. The codebase is open source under MIT license at github.com/daftpixie/ozskr, providing full transparency into the build process.

### 6. Is it open source?

Yes. The entire codebase is available at github.com/daftpixie/ozskr under the MIT license. This includes all AI integration logic, DeFi patterns, content moderation pipelines, and security implementations. Community contributions are welcome via the standard GitHub PR workflow (see `/CONTRIBUTING.md`).

### 7. When is the public launch?

ozskr.ai is currently in alpha with a waitlist for 500 initial spots. Public launch timing depends on beta testing results, mainnet readiness, and smart contract audit completion. Follow @ozskr_ai on Twitter for weekly build-in-public updates and launch announcements.

### 8. Can I create my own agent?

Yes. Alpha users can create AI agents with custom character DNA, personality traits, content styles, and trading preferences. Each agent has isolated memory (Mem0) and passes through the 7-stage content pipeline. Agent creation is gated by $HOPE tier during alpha to manage infrastructure load.

### 9. What chains does it support?

ozskr.ai is currently Solana-only. Solana was chosen for its high throughput, low transaction fees, and mature DeFi ecosystem (Jupiter Ultra, Raydium). Multi-chain support is not on the current roadmap but could be considered based on community feedback post-launch.

### 10. How do I join the waitlist?

Visit ozskr.vercel.app and enter your email address in the embedded waitlist form. Waitlist spots are limited to 500 for the alpha phase. Selections will prioritize creators with existing audiences, Web3 experience, and alignment with the platform's build-in-public ethos.

---

## Media Kit Checklist

The following assets should be prepared for KOL distribution (to be created in Phase 6.10):

### Logo Variations
- [ ] **Mark** (icon only, square format, 512x512px minimum)
- [ ] **Wordmark** (text only, horizontal lockup, SVG + PNG)
- [ ] **Full Lockup** (mark + wordmark, primary brand asset, SVG + PNG)
- [ ] **Light Mode** (for white/light backgrounds)
- [ ] **Dark Mode** (for black/dark backgrounds, default)
- [ ] **Monochrome** (single-color version for special use cases)

### Color Palette
- [ ] **Primary Colors** (Solana Purple `#9945FF`, Solana Green `#14F195`, Brick Gold `#F59E0B`)
- [ ] **Background Colors** (Void Black `#0A0A0B`, Dark Gray `#1A1A1B`)
- [ ] **Accent Colors** (full palette from `ozskr-design-system.css`)
- [ ] **Hex Values Table** (for easy copy-paste)

### Screenshots (High Resolution, 2x Retina Minimum)
- [ ] **Landing Page** (hero section, Wizard of Oz theming)
- [ ] **Dashboard Overview** (agent cards, stats, navigation)
- [ ] **Agent Creation Flow** (character DNA setup, modal UI)
- [ ] **Content Generation** (streaming UI, SSE progress, quality gates)
- [ ] **Trading Interface** (Jupiter Ultra integration, position management)
- [ ] **Wallet Connection** (Solana wallet adapter, SIWS flow)
- [ ] **Mobile Responsive Views** (2-3 key screens on mobile)

### Architecture Diagram
- [ ] **System Architecture** (high-level, suitable for non-technical audiences)
- [ ] **Content Pipeline Diagram** (7 stages with icons and brief descriptions)
- [ ] **DeFi Integration Flow** (non-custodial design, client-side signing)
- [ ] **Agent Orchestration Map** (subagent structure, ownership domains)

### Brand Guidelines PDF
- [ ] **Logo Usage Rules** (spacing, minimum size, incorrect usage examples)
- [ ] **Color System** (primary, secondary, accent, background palettes)
- [ ] **Typography** (Satoshi, Inter, JetBrains Mono with usage guidelines)
- [ ] **Tone of Voice** (confident but not arrogant, technical but accessible)
- [ ] **Wizard of Oz Theming** (narrative guidelines, approved phrases)
- [ ] **Token Language Guide** (SEC-safe $HOPE framing, do/don't examples)

### Video Assets (Optional, High Priority for Launch)
- [ ] **Platform Demo** (2-3 minute walkthrough, narrated)
- [ ] **Agent Creation Tutorial** (60-90 seconds, key steps only)
- [ ] **Build-in-Public Montage** (behind-the-scenes, Claude Code workflow)

### Press Kit (For Media Inquiries)
- [ ] **One-Pager** (project summary, key stats, team, contact info)
- [ ] **Founder Bio** (Matt + relevant background)
- [ ] **Technical Fact Sheet** (tech stack, performance metrics, security audit results)
- [ ] **High-Resolution Headshots** (team members, if applicable)

---

## Compliance Notes

### CRITICAL: $HOPE Token Language

**$HOPE is a utility token, NOT an investment.** All messaging must use utility-focused framing:

| DO SAY | DO NOT SAY |
|--------|------------|
| "$HOPE unlocks premium features" | "$HOPE will increase in value" |
| "Earn $HOPE through platform activity" | "$HOPE is an investment opportunity" |
| "Utility token for the ozskr ecosystem" | "$HOPE provides returns" |
| "Hold $HOPE to access tier benefits" | "Buy $HOPE before the price goes up" |

### SEC-Safe Messaging Rules

1. **No price predictions** — never mention potential $HOPE value, ROI, or market performance
2. **No financial advice** — platform does not provide investment recommendations
3. **No guaranteed returns** — never promise APY, yield, or profit from $HOPE holdings
4. **Utility-only framing** — always emphasize access to features, not financial upside

### Non-Custodial Disclosure

ozskr.ai is a non-custodial platform. It does not:
- Hold user private keys or seed phrases
- Execute transactions on behalf of users
- Convert or hold crypto assets for users
- Provide custodial wallet services

All transaction signing happens client-side via Solana wallet adapters. Users maintain full control of their funds at all times.

### Legal Documentation

All legal documents are available in the `/docs/legal/` directory and are marked **"DRAFT — REQUIRES ATTORNEY REVIEW"** where applicable. KOLs should refer specific legal questions to:

- **Token Economics:** `/docs/legal/token-disclaimer.md`
- **Privacy:** `/docs/legal/privacy-policy.md`
- **Terms:** `/docs/legal/terms-of-service.md`
- **Acceptable Use:** `/docs/legal/acceptable-use-policy.md`
- **AI Content:** `/docs/legal/ai-content-disclosure.md`

For questions not covered in existing documentation, escalate to Matt directly rather than providing unofficial interpretations.

### Content Moderation Policy

All AI-generated content passes through automated moderation before publication. The platform filters:
- Harmful content (violence, self-harm, hate speech)
- Policy violations (spam, misleading information)
- Brand misalignment (off-topic, low-quality output)

KOLs should emphasize the platform's commitment to responsible AI content generation, not unfiltered AI spam.

### Alpha Status Honesty

ozskr.ai is in alpha. KOLs should be transparent about:
- Current status (alpha, not production-ready)
- Network (devnet, not mainnet)
- Waitlist limitations (500 spots for initial cohort)
- Ongoing development (weekly build-in-public updates)

Avoid language that implies the platform is fully production-ready or feature-complete.

### Questions and Escalation

For questions not covered in this briefing:
- **Technical Questions:** GitHub Discussions at github.com/daftpixie/ozskr/discussions
- **Legal/Compliance Questions:** Escalate to Matt directly (do not provide unofficial answers)
- **Partnership Inquiries:** Contact via Discord or Twitter DM to @ozskr_ai

---

**Document Version:** 1.0.0
**Last Updated:** February 13, 2026
**Maintained By:** content-writer agent
**Review Cycle:** Weekly during Phase 6, monthly post-launch
