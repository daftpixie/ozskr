# Product Hunt Launch Copy — ozskr.ai

**Status:** Draft — Review before submission
**Target Audience:** Web3 builders, AI enthusiasts, open-source contributors
**Brand Voice:** Confident but not arrogant, technical but accessible, build-in-public transparency
**SEC Compliance:** All $HOPE references use utility-only framing

---

## Product Hunt Listing

### Tagline (60 chars max)
```
AI agents for Solana, built by AI. Open source & MIT.
```
*(57 characters)*

### Description (260 chars max)
```
Create autonomous AI agents that generate content and trade on Solana. Built entirely with Claude Code. 7-stage content pipeline, non-custodial DeFi, 482 tests. Open source platform for Web3 AI influencers. Pay no mind to the agents behind the emerald curtain.
```
*(260 characters)*

### Full Description

ozskr.ai is an open-source platform for building autonomous AI agents on Solana. Each agent has its own personality, content style, and trading strategy — powered by Claude API, Mem0 memory, and Jupiter Ultra.

The platform uses a 7-stage content pipeline with built-in moderation, prompt injection defense, and quality scoring. All trading is non-custodial through @solana/wallet-adapter. Agents can generate text and images (via fal.ai), remember context across sessions, and execute DeFi transactions with mandatory human-in-the-loop approval. 482 tests across 45 files ensure production reliability.

ozskr.ai was built entirely with Claude Code — every line of code, every test, every API route was written by Opus 4.6 and reviewed by humans. The git history shows the real prompts, iterations, and architectural decisions. This is AI building AI infrastructure, in public.

The platform is MIT licensed and deployed at ozskr.vercel.app. We're inviting builders to fork it, extend it, or use it as a reference implementation for Claude Code + Solana + Next.js 15. The codebase demonstrates production patterns for @solana/kit, Mastra agents, Supabase RLS, and TypeScript strict mode.

### Key Features

- **Autonomous AI Agents** — Claude API + Mem0 long-term memory + character DNA system
- **7-Stage Content Pipeline** — Prompt injection defense, quality scoring, content moderation
- **Non-Custodial DeFi** — Jupiter Ultra integration, transaction simulation, slippage guards
- **Production-Grade Testing** — 482 tests, TypeScript strict, Vercel deployment live
- **Built Entirely with Claude Code** — Open git history showing AI-first development
- **Open Source (MIT)** — Full transparency, forkable architecture, contributor-friendly

### Topics/Categories

**Primary Categories:**
- Developer Tools
- Open Source
- Artificial Intelligence
- Blockchain
- Crypto

**Suggested Topics:**
- AI Agents
- Solana
- Web3
- Claude AI
- Next.js
- TypeScript
- DeFi
- Content Generation
- Open Source
- AI Development

---

## Maker Comment

*Post this as Matt (@daftpixie) immediately after launch*

I built ozskr.ai entirely with Claude Code over the past [X] weeks. Every line of code, every test, every API route — written by Opus 4.6 and reviewed by me. The git history is unedited: you can see the real prompts, the failed iterations, the architectural pivots.

This started as an experiment: could AI build a production-grade AI platform? The answer is yes, but with caveats. Claude Code is excellent at implementing well-defined features, mediocre at greenfield architecture, and requires constant human oversight on security decisions. I wrote the PRD and made the hard calls; Claude wrote the code.

The platform lets you create AI agents with persistent memory, content generation, and non-custodial trading on Solana. It's open source (MIT) because I want builders to learn from the patterns — @solana/kit, Mastra agents, Next.js 15 App Router, TypeScript strict mode.

We're in alpha now. The codebase is production-ready but the product is still finding its voice. If you're interested in AI agents, Web3, or just want to see what human-AI collaboration looks like at scale, check out the repo.

Happy to answer questions about the architecture, the Claude Code workflow, or why I chose Wizard of Oz theming.

*(197 words)*

---

## First Comment (from @ozskr_ai account)

*Post this 10-15 minutes after maker comment*

Thank you for checking out ozskr.ai. We're excited to share what happens when AI builds an AI platform.

One technical detail we're proud of: the content pipeline runs 7 sequential stages (parse, context retrieval, enhancement, generation, quality scoring, moderation, storage) with Zod validation at every boundary. It's over-engineered by startup standards, but it's the right architecture for production AI systems.

The full codebase is on GitHub at github.com/daftpixie/ozskr. We're looking for contributors, especially on the DeFi security patterns and content moderation logic. MIT licensed, TypeScript strict, 482 tests to catch regressions.

*(109 words)*

---

## Launch Day Checklist

### Timing
- **Launch Time:** 12:01 AM PST (Product Hunt day starts at midnight Pacific)
- **Best Day:** Tuesday, Wednesday, or Thursday (avoid Monday/Friday)
- **Avoid:** Major crypto events, other high-profile launches, holidays

### Pre-Launch (24 hours before)
- [ ] Finalize tagline, description, and screenshots
- [ ] Upload demo video (1-2 min, show agent creation + content generation)
- [ ] Prepare maker comment (don't post until launch goes live)
- [ ] Notify 5-10 close supporters for immediate upvotes/comments
- [ ] Schedule Twitter thread to post at launch time
- [ ] Prepare FAQ doc for common questions

### Launch Day (Hour 0-2)
- [ ] Post product on Product Hunt at 12:01 AM PST
- [ ] Post maker comment within 5 minutes
- [ ] Share launch link on Twitter (@daftpixie, @ozskr_ai)
- [ ] Post in relevant Discord servers (Solana, Claude AI, Web3 builders)
- [ ] Share in relevant subreddits (r/solana, r/artificial, r/opensource — follow rules)
- [ ] Post @ozskr_ai first comment at T+10 minutes

### Launch Day (Hour 2-12)
- [ ] Respond to every comment within 1 hour
- [ ] Share upvote milestones on Twitter (50, 100, 200)
- [ ] Post technical deep-dive thread at Hour 4
- [ ] Engage with other Product Hunt launches (give upvotes, leave thoughtful comments)
- [ ] Monitor Langfuse for traffic spikes, check error rates

### Launch Day (Hour 12-24)
- [ ] Thank top commenters individually
- [ ] Share "Day in Review" update (upvotes, signups, top question)
- [ ] Post GitHub star count milestone if reached
- [ ] Prepare follow-up blog post for next day

### Social Amplification
- **Twitter:** 3 tweets spread throughout the day (launch announcement, technical thread, thank-you)
- **Discord:** Post in 5-7 relevant servers (Solana, Anthropic, Solana Dev, Web3 Builders)
- **Reddit:** r/solana (check rules), r/artificial (check rules), r/SideProject
- **Hacker News:** Post at Hour 6 if Product Hunt momentum is strong
- **LinkedIn:** Matt's network + Anthropic tag

### Response Templates

**"What's the business model?"**
> We're in alpha and still exploring monetization. The platform will remain open source. We're considering premium features unlocked with $HOPE (our utility token), but the core agent creation and content generation will stay free.

**"Is this safe? Can the AI steal my funds?"**
> All transactions are non-custodial. The platform never holds your private keys — signing happens client-side via Solana wallet adapter. Every DeFi transaction requires explicit user approval. We've run a security audit (see docs/security-audit-pre-alpha.md) and passed with 0 critical issues.

**"Can I use this to make money?"**
> The agents can trade on Solana DEXs, but this is not financial advice. You're responsible for your own trading decisions. The AI provides tools; you make the calls.

**"How much of this is actually AI-written?"**
> ~95% of the code was written by Claude Code (Opus 4.6). I (Matt) wrote the PRD, made architectural decisions, reviewed all security-critical code, and manually tested every feature. The git history is unedited — you can see the real prompts.

**"Can I contribute?"**
> Yes. See CONTRIBUTING.md in the repo. We're especially looking for help on DeFi security patterns, content moderation logic, and test coverage. All contributions go through PR review.

**"Why Solana?"**
> Speed and cost. Agent transactions need sub-second confirmation and near-zero fees. Solana's average confirmation time is 400ms and transaction cost is $0.00025. Ethereum L1 would cost $5-50 per agent action.

**"Why open source?"**
> Because AI tooling should be transparent. If you're going to trust an AI agent with your wallet, you should be able to audit the code. Also, I want builders to learn from the patterns — this is a reference implementation for Claude Code + Solana + Next.js 15.

**"What's with the Wizard of Oz theme?"**
> "Pay no mind to the agents behind the emerald curtain." It's a metaphor for AI operating autonomously while humans retain control. Also, it's fun.

---

## Post-Launch Follow-Up

### Week 1
- [ ] Publish "Launch Retrospective" blog post (metrics, learnings, top feedback)
- [ ] Address top 3 feature requests in GitHub issues
- [ ] Schedule AMA in Discord (if community interest is high)
- [ ] Thank all contributors/supporters publicly

### Week 2-4
- [ ] Implement quick wins from Product Hunt feedback
- [ ] Ship v0.2 with improvements
- [ ] Write case study: "What we learned launching an AI product built by AI"

---

## Notes for Matt

- Product Hunt favors authentic builder stories over polished marketing — lean into the Claude Code narrative
- The "AI built by AI" angle is unique — emphasize the open git history as proof
- Be honest about alpha status — don't oversell
- Engage genuinely with every comment, especially skeptics
- If asked about $HOPE value/price, redirect to utility framing: "It unlocks premium features, not an investment"
- The security audit passing is a strong trust signal — mention it proactively
- Consider doing a live demo/AMA during peak hours (10 AM - 2 PM PST)

---

**File Owner:** `content-writer`
**Last Updated:** 2026-02-13
**Approval Status:** Draft — requires Matt's review before Product Hunt submission
