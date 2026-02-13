# Twitter/X Thread 1: How We Built ozskr.ai

**Hook:** The recursive AI development narrative
**Target Audience:** Builders, devs, AI enthusiasts
**Tone:** Build-in-public, transparent, technical but accessible
**CTA:** Join waitlist

---

## Thread (12 tweets)

### 1/
We built an entire AI agent platform using nothing but AI agents.

No human-written code. No traditional dev team. Just Claude Code orchestrating 12 specialized AI agents.

Here's how we built ozskr.ai - and what we learned along the way. 🧵

### 2/
First, the meta layer: Claude Opus 4.6 acts as the strategic orchestrator. It doesn't write code - it plans, delegates to specialist agents, reviews outputs, and synthesizes.

Think of it as a CTO that never sleeps.

### 3/
The 12 specialist agents each own a domain:
- solana-dev (blockchain + DeFi)
- frontend-dev (UI/UX)
- ai-agent-dev (content pipeline)
- api-architect (backend)
- test-writer (QA)
- security-auditor (review-only)
- devops-infra (CI/CD)
- content-writer (docs + legal)
... and more

### 4/
Every feature starts with decomposition. The orchestrator breaks requests into work packages with clear boundaries, delegates to the right agent, then gates with security + code review.

Hard rule: Write agents never call other write agents. Only the orchestrator delegates.

### 5/
The numbers so far:
- 482+ tests across 48 files
- 6 development phases
- 79 tests for Twitter API integration alone
- 0 critical security issues (pre-alpha audit passed)

All written by AI. All production-ready.

### 6/
Real example: We started using Ayrshare for social publishing. Then discovered they charge $0.01/platform/publish.

An AI agent recognized the cost issue, researched Twitter's direct API, implemented OAuth 2.0 PKCE flow, and shipped a zero-cost solution.

No human prompt needed.

### 7/
Tech stack choices were deliberate:
- Next.js 15 + Hono API (why run separate backends?)
- Supabase + pgvector (AI memory needs vectors)
- Claude with prompt caching (90% cost reduction)
- Jupiter Ultra (non-custodial DeFi)
- Trigger.dev (background jobs scale to zero)

### 8/
The security model is non-negotiable: we NEVER handle private keys server-side. All wallet operations use @solana/wallet-adapter-react.

User signs, we execute. No custody. No exceptions.

This was an architectural decision made at Phase 1 and enforced by security-auditor gate.

### 9/
Development velocity is wild. Phase 2 (entire AI agent core + content pipeline) took ~3 weeks. Phase 3 (Jupiter integration + DeFi safety) took 2 weeks.

Human review time? That's the bottleneck. The agents ship faster than we can validate.

### 10/
The recursive story gets deeper: ozskr.ai is a platform for managing AI agents. Those agents create content. The platform itself was built by AI agents.

We're not just building with AI. We're building AI that builds platforms for AI.

### 11/
Why open source? Because the "AI built this" narrative only works if you can verify it.

MIT licensed. Full git history. Every commit shows which agent contributed.

Transparency isn't optional when you're claiming recursion.

### 12/
We're launching with a 500-person alpha waitlist. Beta starts March 2026.

Want to see what AI agents can build when you give them architectural ownership?

Join: https://ozskr.vercel.app

Built with Claude Code. Open source. Non-custodial. Real.

---

## Tweet Performance Notes

- Tweet 1: Hook with paradox (AI building AI platform)
- Tweet 6: Concrete example (Ayrshare → Twitter direct) shows autonomous decision-making
- Tweet 8: Security message builds trust
- Tweet 10: Recursive narrative - the philosophical hook
- Tweet 12: Clear CTA with URL

## Hashtag Strategy (use sparingly, 1-2 per thread)
- #BuildInPublic
- #AIAgents
- #Solana
- #Web3

## Media Suggestions
- Tweet 1: Screenshot of git history showing "Assisted-by: Claude Code" commits
- Tweet 5: Simple graphic of the numbers
- Tweet 7: Architecture diagram (if available)
- Tweet 12: Screenshot of landing page

---

**Status:** Draft - Ready for review
**Author:** content-writer agent
**Date:** 2026-02-13
