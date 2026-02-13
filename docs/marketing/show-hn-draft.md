# Show HN Draft: ozskr.ai

**Post Date:** March 17, 2026
**Target:** Hacker News frontpage
**Tone:** Technical, understated, substance-first

---

## Title

**Show HN: ozskr.ai – AI agents that create and publish social media content (built with Claude Code)**

---

## Body

ozskr.ai is a platform for building AI agents that generate social content, navigate Solana DeFi, and publish autonomously. Built entirely with Claude Code (Opus 4.6 orchestrating 12 specialized agents).

**The recursive part:** The platform that creates AI agents was created by AI agents. Every feature — from the content generation pipeline to the Jupiter swap integration to the Twitter OAuth flow — was implemented by specialized AI agents (solana-dev, frontend-dev, ai-agent-dev, etc.) coordinated by Opus 4.6 as orchestrator. 587 tests, 58 test files. Full git history shows the work: https://github.com/daftpixie/ozskr

**The technical substance:** Next.js 15 with TypeScript strict mode. Non-custodial Solana wallet integration via wallet-adapter (users keep their keys, platform never signs transactions). 7-stage content pipeline: parse → context → enhance → generate → quality → moderation → store. Claude API with prompt caching (90% cost reduction). Jupiter Ultra for DeFi swaps. Supabase with pgvector for AI memory and RLS for multi-tenant isolation. SocialPublisher abstraction replaced $108K/year in API costs with direct Twitter integration (OAuth PKCE, 300 posts/3hr rate limiting). Trigger.dev for background jobs. MIT licensed.

**Try it:** Live at https://ozskr.vercel.app (waitlist-gated alpha). Read the architecture deep-dive: https://github.com/daftpixie/ozskr/blob/main/docs/marketing/blog-2-architecture-deepdive.md

---

## Expected Questions and Answers

**Q: Did AI really build this, or is that marketing?**
A: Full git history is public. Every commit from Phase 2 onward has "Assisted-by: Claude Code" trailers. CLAUDE.md shows the agent ownership map. Orchestrator delegates to specialists, reviews outputs, gates with security-auditor. It's real.

**Q: How does non-custodial DeFi work?**
A: Platform constructs unsigned transactions client-side. User approves in their wallet (Phantom/Backpack/Solflare). Wallet signs, broadcasts to Solana. Platform never sees private keys, never signs transactions, never holds funds. Code: src/lib/solana/

**Q: Why Solana?**
A: Sub-400ms finality, sub-cent fees, Jupiter's swap routing is best-in-class. @solana/kit functional APIs are far cleaner than web3.js class constructors. When AI agents need to interact with DeFi in real-time, Solana's speed matters.

**Q: What's the unit economics?**
A: 100 users, 10 posts/day each = $311.50/mo infrastructure cost = $3.11/user/mo. Target pricing $19.99/mo = 85% gross margin. Claude prompt caching + Twitter direct API integration make it viable.

**Q: What can't it do?**
A: AI agents can't sign transactions on behalf of users (by design). Human-in-the-loop approval required for all DeFi actions. Content moderation catches obvious issues but isn't perfect. Character personality drift happens without memory tuning (Mem0 helps but isn't magic).

**Q: Why open-source?**
A: Transparency around AI-built code. Let people fork it, learn from it, improve it. If AI is building software, the work should be auditable.

---

## Meta Information

- **Target score:** 100+ points (frontpage)
- **Engagement strategy:** Matt monitors thread, answers technical questions, links to relevant code
- **Avoid:** Hype language, vague claims, "we're disrupting X" nonsense
- **Lead with:** Working code, real costs, architectural decisions, honest limitations

---

**Status:** Ready for posting
**Created by:** content-writer agent (glinda-cmo)
**Date:** 2026-02-13
