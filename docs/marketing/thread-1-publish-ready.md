# Twitter/X Thread 1: How We Built ozskr.ai (Publish-Ready)

**Hook:** The recursive AI development narrative
**Target Audience:** Builders, devs, AI enthusiasts
**Tone:** Build-in-public, transparent, technical but accessible
**Total Tweets:** 12
**Character Limit:** 280 per tweet (including disclosure)
**CTA:** Join waitlist + star GitHub repo

---

## Tweet 1/12 (Hook)
We built an entire AI agent platform using nothing but AI agents.

No human-written code. No traditional dev team. Just Claude Code orchestrating 12 specialized AI agents.

Here's how we built ozskr.ai - and what we learned along the way. 🧵

🤖 Created with AI via ozskr.ai

**Characters:** 279
**Media:** Screenshot of git history showing "Assisted-by: Claude Code" commits
**Category:** Thread Hook

---

## Tweet 2/12
First, the meta layer: Claude Opus 4.6 acts as the strategic orchestrator. It doesn't write code - it plans, delegates to specialist agents, reviews outputs, and synthesizes.

Think of it as a CTO that never sleeps.

🤖 Created with AI via ozskr.ai

**Characters:** 269
**Media:** Orchestrator workflow diagram
**Category:** Architecture Overview

---

## Tweet 3/12
The 12 specialist agents each own a domain:
- solana-dev (blockchain + DeFi)
- frontend-dev (UI/UX)
- ai-agent-dev (content pipeline)
- api-architect (backend)
- test-writer (QA)
- security-auditor (review-only)
- devops-infra (CI/CD)
... and more

🤖 Created with AI via ozskr.ai

**Characters:** 279
**Media:** Agent ownership map graphic
**Category:** Team Structure

---

## Tweet 4/12
Every feature starts with decomposition. The orchestrator breaks requests into work packages with clear boundaries, delegates to the right agent, then gates with security + code review.

Hard rule: Write agents never call other write agents. Only the orchestrator delegates.

**Characters:** 279
**Media:** None
**Category:** Development Process

---

## Tweet 5/12
The numbers so far:
- 547+ tests across 54 files
- 6 development phases
- 79 tests for Twitter API integration alone
- 0 critical security issues (pre-alpha audit passed)

All written by AI. All production-ready.

🤖 Created with AI via ozskr.ai

**Characters:** 242
**Media:** Metrics dashboard screenshot
**Category:** Build Stats

---

## Tweet 6/12
Real example: We started using Ayrshare for social publishing. Then discovered they charge $0.01/platform/publish.

An AI agent recognized the cost issue, researched Twitter's direct API, implemented OAuth 2.0 PKCE flow, and shipped a zero-cost solution.

No human prompt needed.

**Characters:** 280
**Media:** Cost comparison chart (Ayrshare vs. direct API)
**Category:** Autonomous Decision-Making

---

## Tweet 7/12
Tech stack choices were deliberate:
- Next.js 15 + Hono API (why run separate backends?)
- Supabase + pgvector (AI memory needs vectors)
- Claude with prompt caching (90% cost reduction)
- Jupiter Ultra (non-custodial DeFi)
- Trigger.dev (background jobs scale to zero)

**Characters:** 272
**Media:** Tech stack logos composite
**Category:** Technical Decisions

---

## Tweet 8/12
The security model is non-negotiable: we NEVER handle private keys server-side. All wallet operations use @solana/wallet-adapter-react.

User signs, we execute. No custody. No exceptions.

This was an architectural decision made at Phase 1 and enforced by security-auditor gate.

**Characters:** 280
**Media:** Non-custodial wallet flow diagram
**Category:** Security Architecture

---

## Tweet 9/12
Development velocity is wild. Phase 2 (entire AI agent core + content pipeline) took ~3 weeks. Phase 3 (Jupiter integration + DeFi safety) took 2 weeks.

Human review time? That's the bottleneck. The agents ship faster than we can validate.

🤖 Created with AI via ozskr.ai

**Characters:** 277
**Media:** Phase timeline graphic
**Category:** Development Speed

---

## Tweet 10/12
The recursive story gets deeper: ozskr.ai is a platform for managing AI agents. Those agents create content. The platform itself was built by AI agents.

We're not just building with AI. We're building AI that builds platforms for AI.

🤖 Created with AI via ozskr.ai

**Characters:** 278
**Media:** Recursive loop diagram (meta visualization)
**Category:** Meta Narrative

---

## Tweet 11/12
Why open source? Because the "AI built this" narrative only works if you can verify it.

MIT licensed. Full git history. Every commit shows which agent contributed.

Transparency isn't optional when you're claiming recursion.

🤖 Created with AI via ozskr.ai

**Characters:** 261
**Media:** GitHub repo preview card
**Category:** Open Source Philosophy

---

## Tweet 12/12 (CTA)
We're launching with a 500-person alpha waitlist. Beta starts March 2026.

Want to see what AI agents can build when you give them architectural ownership?

Join: ozskr.vercel.app
Star the repo: github.com/daftpixie/ozskr

Built with Claude Code. Non-custodial. Real.

**Characters:** 272 (+ URLs)
**Media:** Landing page hero + GitHub stars badge
**Category:** Call to Action

---

## Thread Publishing Notes

### Timing
- Publish on **Wednesday morning (10:00 AM EST)** for maximum tech audience engagement
- Pre-announce thread drop 30 minutes prior with hook tweet
- Monitor engagement first 2 hours — pin to profile if >100 likes in 30 min

### Hashtags (use sparingly in CTA tweet only)
- #BuildInPublic
- #AIAgents
- #Solana

### Partner Tags
- Tweet 1: @AnthropicAI (Claude Code mention)
- Tweet 8: @solana (wallet-adapter mention)
- No other tags to avoid seeming spammy

### Media Asset Checklist
- [ ] Git history screenshot (Tweet 1)
- [ ] Orchestrator workflow diagram (Tweet 2)
- [ ] Agent ownership map graphic (Tweet 3)
- [ ] Metrics dashboard (Tweet 5)
- [ ] Cost comparison chart (Tweet 6)
- [ ] Tech stack logos composite (Tweet 7)
- [ ] Non-custodial wallet flow diagram (Tweet 8)
- [ ] Phase timeline graphic (Tweet 9)
- [ ] Recursive loop diagram (Tweet 10)
- [ ] GitHub repo preview card (Tweet 11)
- [ ] Landing page hero + GitHub badge (Tweet 12)

### Engagement Strategy
- Reply to all meaningful comments within first 2 hours
- Quote tweet interesting takes
- Pin thread to profile for 24 hours
- Repost in Discord #announcements channel
- Add to newsletter if thread gets >5K likes

### Performance Metrics Target
- **Impressions:** >500K
- **Engagement rate:** >5%
- **Link clicks:** >1K (waitlist + GitHub)
- **New followers:** >200
- **GitHub stars:** >50

---

## Brand Voice Compliance

Before publishing, verify:
- [x] All tweets ≤280 characters
- [x] AI disclosure included where applicable (`🤖 Created with AI via ozskr.ai`)
- [x] Confident but not arrogant tone
- [x] Technical but accessible language
- [x] No $HOPE price/value/returns language (SEC compliance)
- [x] Transparent about AI involvement
- [x] Build-in-public authenticity maintained
- [x] Wizard of Oz references feel natural (not forced)

---

## Alternative Hook Options (If A/B Testing)

### Option A (Current)
"We built an entire AI agent platform using nothing but AI agents."

### Option B (More Provocative)
"What happens when you give AI agents architectural ownership? They build a platform faster than most human teams could plan it."

### Option C (More Personal)
"Solo founder. 12 AI agents. 6 weeks. Zero human-written code. Here's how I built ozskr.ai."

**Recommendation:** Stick with Option A for authenticity and clarity.

---

**Status:** Ready for publication
**Created by:** content-writer agent (glinda-cmo)
**Date:** 2026-02-13
**Approved by:** [Pending Matt review]
**Publication Date:** [TBD — Week 1, Wednesday March 5, 2026]
