# ozskr.ai KOL Onboarding Flow

**Version:** 1.0.0
**Last Updated:** February 13, 2026
**Status:** Active Onboarding Process

---

## Overview

This document outlines the step-by-step onboarding process for KOLs who agree to test ozskr.ai and potentially create content about the platform. The flow is designed to provide a smooth experience, set clear expectations, and ensure compliance with FTC disclosure requirements.

**Onboarding Philosophy:**
- White-glove service for early advocates
- Clear communication about alpha status and limitations
- No pressure to create content unless it genuinely resonates
- Two-way feedback loop (they test, we improve)
- Transparency about expectations and compliance requirements

---

## Step 1: Confirm Interest & Gather Details

**Trigger:** KOL responds positively to outreach DM

**Action:** Gather necessary information and set expectations

### Response Template

```
Awesome! Let's get you set up. A few quick questions to make sure you have a smooth experience:

1. **Wallet Address:** What's your Solana wallet address? (Phantom, Backpack, Solflare, etc. — just need the public address to whitelist you)

2. **Content Plans:** Are you planning to create content about ozskr.ai, or just testing for feedback? (Both are great! Just helps me know what assets to prepare.)

3. **Timeline:** Any specific timeline you're working with? (No rush, just want to coordinate if you need anything by a certain date.)

4. **Questions:** Anything you want to know upfront before diving in?

I'll get you whitelisted within 24 hours and send over a testing guide + any assets you might need.

— Matt
```

**What to Track:**
- [ ] Wallet address received
- [ ] Content creation intent (yes/no/maybe)
- [ ] Preferred content format (thread, video, article, etc.)
- [ ] Timeline expectations
- [ ] Specific areas of interest (DeFi, AI agents, content pipeline, security, etc.)

---

## Step 2: Add to Alpha Whitelist

**Trigger:** Wallet address received

**Action:** Add wallet to whitelist via admin API

### Technical Process

1. **Access Admin Panel:**
   - Navigate to ozskr.vercel.app/admin (requires admin auth)
   - Or use direct API call (see below)

2. **Add Wallet to Whitelist:**

   **Via API Route:**
   ```bash
   curl -X POST https://ozskr.vercel.app/api/admin/whitelist \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $ADMIN_API_KEY" \
     -d '{
       "walletAddress": "[KOL_WALLET_ADDRESS]",
       "reason": "KOL early access - [Profile # from target list]",
       "source": "kol_outreach"
     }'
   ```

   **Via Supabase Direct:**
   ```sql
   INSERT INTO alpha_whitelist (wallet_address, reason, source, added_by)
   VALUES (
     '[KOL_WALLET_ADDRESS]',
     'KOL early access - [Profile # from target list]',
     'kol_outreach',
     'matt'
   );
   ```

3. **Verify Whitelist Status:**
   - Confirm wallet appears in `alpha_whitelist` table
   - Test by visiting ozskr.vercel.app with that wallet address

### Confirmation Message to KOL

```
You're all set! Here's how to access ozskr.ai:

1. Visit: https://ozskr.vercel.app
2. Click "Connect Wallet"
3. Use your wallet: [WALLET_ADDRESS]

You should see the dashboard immediately (no waitlist gate).

**Important Notes:**
- Platform is currently on Solana DEVNET (not mainnet)
- Use devnet SOL (free from faucet: solfaucet.com)
- Your feedback is valuable — both positive and critical!

I'm sending a separate message with the testing guide. Let me know if you hit any issues!

— Matt
```

---

## Step 3: Send Testing Guide & Assets

**Trigger:** Wallet whitelisted and confirmed

**Action:** Provide comprehensive testing guide and supporting materials

### Send Devnet Setup Guide

Link to existing documentation:

```
Here's your testing guide to get started:

**Devnet Setup:**
See: docs/alpha-testing/devnet-guide.md in the repo
Quick version:
- Add Solana Devnet network to your wallet
- Get free devnet SOL: https://solfaucet.com
- Connect to ozskr.vercel.app

**What to Test:**
1. Agent Creation (click "Create Agent", customize character DNA)
2. Content Generation (generate a post, watch the real-time streaming)
3. Content Pipeline (see the 7 stages in action)
4. Wallet Connection (SIWS auth flow)

Optional (if interested in DeFi):
- Jupiter swap simulation (requires devnet tokens)
- Position management UI

Let me know if you get stuck at any point!
```

### Provide Supporting Assets

Based on their content plans, send relevant assets:

**For All KOLs:**
- [ ] Link to GitHub repo: github.com/daftpixie/ozskr
- [ ] Link to brand style guide: /docs/ozskr_brand_style_guide.md
- [ ] Link to security audit report: /docs/security-audit-pre-alpha.md
- [ ] Screenshots of key features (dashboard, agent creation, content generation)

**For Technical Deep-Divers:**
- [ ] Architecture diagram (content pipeline, DeFi flow, agent orchestration)
- [ ] README.md with tech stack details
- [ ] Test coverage report (482 tests across 45 files)

**For Storytellers:**
- [ ] Build-in-public narrative: How we built this with Claude Code
- [ ] Claude Code prompts and iteration examples (if available)
- [ ] Wizard of Oz theming explanation (brand philosophy)

**For Designers:**
- [ ] Full brand style guide: /docs/ozskr_brand_style_guide.md
- [ ] Design system CSS variables
- [ ] Color palette + typography specs

**Assets Delivery Message:**

```
Here are some assets that might be helpful:

**Brand Assets:**
- Style Guide: [link]
- Logo Files: [link or "coming soon in media kit"]
- Color Palette: Solana Purple #9945FF, Solana Green #14F195, Brick Gold #F59E0B

**Technical Docs:**
- GitHub: github.com/daftpixie/ozskr
- README: Full tech stack + architecture
- Security Audit: /docs/security-audit-pre-alpha.md (zero critical vulnerabilities)

**Screenshots:**
[Attach or link to key screenshots]

If you need anything else (specific data, architecture diagrams, walkthrough call, etc.), just let me know!
```

---

## Step 4: Offer to Create Their First Agent Together

**Trigger:** KOL has accessed the platform

**Action:** Provide hands-on guidance for agent creation

### Offer Collaborative Setup

```
How's the testing going so far?

If you want, I can walk you through creating your first agent together (async or quick call — whatever works).

Here's what we'd set up:
1. **Character DNA:** Name, personality traits, content style, tone
2. **Memory Setup:** What context should the agent remember?
3. **First Content Generation:** Create a test post and see the 7-stage pipeline in action

Totally optional — the UI is designed to be self-serve — but I'm happy to provide a walkthrough if it's helpful.

Let me know!

— Matt
```

### If They Accept: Walkthrough Script

**Pre-Call Prep:**
- [ ] Confirm their timezone and schedule a 15-minute call
- [ ] Prepare screen share or async Loom video walkthrough
- [ ] Have example character DNA profiles ready

**During Walkthrough:**

1. **Agent Creation (3 minutes):**
   - Click "Create Agent" on dashboard
   - Fill in character DNA fields:
     - Name: What should we call this agent?
     - Personality Traits: What's the vibe? (e.g., "witty, technical, meme-savvy")
     - Content Style: What kind of content? (e.g., "educational threads, code snippets, ecosystem updates")
     - Tone: How should it sound? (e.g., "casual but knowledgeable")
   - Save agent

2. **Content Generation (5 minutes):**
   - Click "Generate Content" on the agent card
   - Enter a prompt: "Write a thread about why Solana's speed matters for AI agents"
   - Watch the streaming UI (real-time generation)
   - Observe the 7-stage pipeline in action:
     - Parse → Context → Enhance → Generate → Quality → Moderation → Store
   - Review the output

3. **Feedback Loop (5 minutes):**
   - What did you like?
   - What felt clunky?
   - Any bugs or unexpected behavior?
   - What features are missing?

4. **Next Steps:**
   - Encourage them to generate 2-3 more pieces of content
   - Invite them to test other features (DeFi if interested, memory persistence, etc.)
   - Ask when they might create public content (no pressure)

**Post-Walkthrough Follow-Up:**

```
Thanks for the walkthrough! Here's a quick recap:

- Agent Name: [NAME]
- Character DNA: [TRAITS]
- First post generated: [LINK if available]

Feel free to keep experimenting. I'm around if you have questions or hit any bugs.

And if you end up creating content about it, let me know — I can help with assets, data, or fact-checking.

— Matt
```

---

## Step 5: Provide Content Ideas & Agree on Timeline

**Trigger:** KOL expresses intent to create content

**Action:** Brainstorm content angles and agree on timing

### Content Ideation Message

```
Excited you're planning to create content! Here are some angles that might resonate with your audience:

**Possible Angles:**

[Tailor based on their content style:]

FOR TECHNICAL CREATORS:
- "I tested an AI platform built by AI — here's the tech stack"
- "Non-custodial DeFi patterns: How ozskr.ai handles Jupiter Ultra"
- "7-stage content pipeline breakdown: Parse → Generate → Moderation"
- "Mastra + Mem0 architecture: Persistent memory for AI agents"

FOR STORYTELLERS:
- "The story of an AI platform built entirely with Claude Code"
- "Wizard of Oz theming in Web3: Pay no mind to the agents behind the curtain"
- "48 hours with ozskr.ai: What worked, what didn't"

FOR REVIEWERS:
- "ozskr.ai alpha review: The good, the bad, and the bugs"
- "Comparing AI agent platforms: ozskr.ai vs [other tools]"
- "First impressions: Creating my first AI influencer on Solana"

FOR COMMUNITY BUILDERS:
- "Creating a custom AI agent for my community"
- "How AI agents could change Web3 content creation"

**What Would Work Best for You?**

Also — any specific timeline you're working with? I can prioritize getting you assets or answering questions based on your schedule.

— Matt
```

### Agree on Posting Timeline

Track the following:
- [ ] Content format agreed (thread, video, article, etc.)
- [ ] Posting date or week agreed (if applicable)
- [ ] Assets needed (screenshots, diagrams, data, etc.)
- [ ] Review process agreed (will they share a draft? no obligation, but helpful)

---

## Step 6: FTC Compliance Reminder

**Trigger:** Content creation confirmed

**Action:** Ensure KOL understands disclosure requirements

### Compliance Message (REQUIRED)

```
One important note before you post — FTC compliance reminder:

**Required Disclosures:**

1. **Material Connection Disclosure:**
   You must disclose that I provided you with early access to ozskr.ai. This is a "material connection" under FTC guidelines.

   Example language:
   "Thanks to @ozskr_ai for providing early alpha access for testing."

2. **AI Content Disclosure:**
   If you generate content using an ozskr.ai agent and post that content, you must disclose it was created by AI.

   Example language:
   "This content was generated using an AI agent with human oversight."

3. **Alpha Status Disclosure:**
   Please mention the platform is in alpha and currently on devnet (not mainnet).

   Example language:
   "Note: ozskr.ai is currently in alpha on Solana devnet."

**Example Combined Disclosure:**

"Thanks to @ozskr_ai for early alpha access. Platform is in alpha on devnet. Content generated by AI agent with human oversight."

Let me know if you have questions about this! Happy to help refine disclosure language.

— Matt
```

**What to Track:**
- [ ] FTC compliance reminder sent
- [ ] KOL acknowledged disclosure requirements
- [ ] Disclosure language agreed (if they want to run it by you)

---

## Step 7: Support Content Creation

**Trigger:** KOL is creating content

**Action:** Provide requested assets, answer questions, offer to review drafts

### Offer Support

```
How's the content coming along? I'm around if you need:

- Additional screenshots or screen recordings
- Architecture diagrams or technical explainers
- Data points (test count, security audit results, performance metrics)
- Fact-checking on technical details
- Review of a draft (totally optional — no editorial control, just happy to catch factual errors)

No pressure on timing — just let me know what would be helpful!

— Matt
```

### Common Questions and Approved Answers

**Q: "Can I say ozskr.ai is production-ready?"**
A: No — please disclose it's in alpha. Not production-ready yet.

**Q: "Can I mention $HOPE price potential?"**
A: No — $HOPE is a utility token, not an investment. Please only mention utility ("unlocks features", "access tier benefits").

**Q: "Can I say there are no bugs?"**
A: No — it's alpha, so bugs are expected. Honest feedback (including bugs) is valuable.

**Q: "Should I only say positive things?"**
A: Absolutely not! Honest reviews (including criticisms) are way more valuable than pure hype.

**Q: "Can I compare ozskr.ai to [other platform]?"**
A: Yes, as long as comparisons are factual and fair.

---

## Step 8: Content Review (Optional)

**Trigger:** KOL offers to share a draft

**Action:** Review for factual accuracy, compliance, and tone

### Review Checklist

When reviewing KOL-created content:

- [ ] **Factual Accuracy:** Are technical details correct?
- [ ] **FTC Disclosure:** Is material connection disclosed?
- [ ] **Alpha Status:** Is alpha/devnet status mentioned?
- [ ] **Token Language:** Is $HOPE framed as utility-only (no investment language)?
- [ ] **Honest Tone:** Does it feel genuine, or overly promotional?
- [ ] **Bugs Acknowledged:** If they hit bugs, are they mentioned honestly?

### Feedback Template

```
Thanks for sharing the draft! A few quick notes:

**Looks Great:**
- [Specific thing you liked]
- [Specific thing you liked]

**Factual Clarifications:**
- [Any technical corrections needed]

**Compliance Check:**
- [If disclosure is missing or insufficient, suggest language]

**Tone Feedback:**
- [Only if it feels overly promotional or not genuine]

Overall, this is [positive feedback]. Really appreciate the honest take!

Let me know if you want to discuss any of this before posting.

— Matt
```

---

## Step 9: Post-Publication Follow-Up

**Trigger:** KOL publishes content about ozskr.ai

**Action:** Thank them, amplify their content, gather feedback

### Thank You Message

```
Just saw your [thread/video/article] — thank you! Really appreciate the honest feedback [and the shoutout / and the detailed breakdown / and the technical deep-dive].

[Specific thing you appreciated about their coverage]

I'm sharing it with the team and on our channels (if that's cool with you?).

Also — based on your feedback about [specific issue they mentioned], we're [how you're addressing it / planning to address it in the next sprint].

Thanks again for being an early advocate. Your feedback is shaping the product.

— Matt
```

### Amplification Checklist

- [ ] Retweet or quote-tweet their content (from @ozskr_ai account)
- [ ] Thank them publicly
- [ ] Share in Discord (if applicable)
- [ ] Add to "Community Coverage" section in docs or README (if they're okay with it)

### Gather Post-Publication Feedback

```
Quick follow-up question: Now that you've spent some time with ozskr.ai and created content about it, what's your overall take?

- What worked well?
- What was frustrating?
- What features are missing?
- Would you recommend it to others in its current state?

No need to sugarcoat — honest feedback helps us improve for the next wave of testers.

— Matt
```

---

## Step 10: Maintain Relationship

**Trigger:** Ongoing

**Action:** Keep KOLs in the loop with updates, new features, and beta access

### Ongoing Engagement

**Weekly Update (During Alpha):**
- [ ] Share build-in-public updates (what shipped this week)
- [ ] Highlight community contributions or feedback implemented
- [ ] Invite feedback on new features

**Template for Updates:**

```
Quick update on ozskr.ai:

This week we shipped:
- [Feature 1]
- [Feature 2]
- [Bug fix based on your feedback]

Next week we're working on:
- [Feature 3]
- [Improvement 4]

If you have time, would love your thoughts on [specific feature]. No pressure though!

— Matt
```

**Major Milestones:**
- [ ] Beta launch announcement
- [ ] Mainnet deployment announcement
- [ ] New feature launches
- [ ] Security audit completion
- [ ] Token launch (if applicable)

---

## Red Flags & Escalation

### Red Flags to Watch For

During onboarding, escalate to Matt if:

- KOL asks to be paid for coverage without disclosing it's sponsored
- KOL wants to make price predictions about $HOPE
- KOL wants to misrepresent alpha status as production-ready
- KOL asks for editorial control over other creators' content
- KOL asks for exclusive access that would disadvantage other testers
- KOL wants to use ozskr.ai agents to generate spam or harmful content
- KOL's content violates FTC disclosure requirements after reminder

### Escalation Template

If you encounter a red flag:

```
Hey Matt, flagging a potential issue with [KOL name/handle]:

[Describe the issue]

My take: [Your assessment]

Recommendation: [What you think we should do]

Let me know how you want to handle this.
```

---

## KOL Onboarding Checklist (Per KOL)

Use this checklist for each KOL:

- [ ] **Step 1:** Interest confirmed, wallet address collected
- [ ] **Step 2:** Wallet added to alpha whitelist, access confirmed
- [ ] **Step 3:** Testing guide + assets sent
- [ ] **Step 4:** Agent creation walkthrough offered (and completed if accepted)
- [ ] **Step 5:** Content ideas discussed, timeline agreed
- [ ] **Step 6:** FTC compliance reminder sent and acknowledged
- [ ] **Step 7:** Content creation support provided as needed
- [ ] **Step 8:** Draft reviewed (if offered)
- [ ] **Step 9:** Post-publication thank you sent, content amplified
- [ ] **Step 10:** Ongoing relationship maintained (weekly updates)

---

## Success Metrics

Track these metrics for KOL onboarding:

| Metric | Target |
|--------|--------|
| Onboarding Completion Rate | >80% of interested KOLs successfully onboarded |
| Time to Whitelist | <24 hours from wallet address received |
| Content Creation Rate | >60% of onboarded KOLs create content |
| Average Time to First Post | <7 days from onboarding |
| FTC Compliance Rate | 100% (all content includes required disclosures) |
| Positive Sentiment Rate | >70% of content is positive or neutral |
| Bug Reports from KOLs | Track and prioritize based on frequency |
| Ongoing Engagement Rate | >50% of KOLs remain engaged after 30 days |

---

## Tools & Resources

### Admin Tools
- **Alpha Whitelist Admin:** ozskr.vercel.app/admin/whitelist
- **API Route:** POST /api/admin/whitelist
- **Supabase Table:** `alpha_whitelist`

### Documentation Links
- **Devnet Guide:** /docs/alpha-testing/devnet-guide.md
- **Brand Style Guide:** /docs/ozskr_brand_style_guide.md
- **Security Audit:** /docs/security-audit-pre-alpha.md
- **Token Disclaimer:** /docs/legal/token-disclaimer.md

### Assets to Prepare
- [ ] Screenshot pack (dashboard, agent creation, content generation, DeFi interface)
- [ ] Architecture diagrams (content pipeline, DeFi flow, agent orchestration)
- [ ] Loom walkthrough video (optional, for async onboarding)
- [ ] FAQ document for common KOL questions

---

**Document Version:** 1.0.0
**Last Updated:** February 13, 2026
**Maintained By:** content-writer agent (glinda-cmo)
**Review Cycle:** Weekly during active onboarding phase, adjust based on feedback
