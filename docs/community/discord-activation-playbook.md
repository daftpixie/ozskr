# Discord Activation Playbook

**Version:** 1.0
**Date:** February 13, 2026
**Status:** Operational Guide
**Owner:** content-writer

This playbook walks you through launching the ozskr.ai Discord server from setup to first-week engagement.

---

## Table of Contents

1. [Pre-Launch Setup](#1-pre-launch-setup)
2. [Bot Configuration](#2-bot-configuration)
3. [Launch Announcement](#3-launch-announcement)
4. [Pinned Messages](#4-pinned-messages)
5. [Moderation Guidelines](#5-moderation-guidelines)
6. [First Week Engagement Plan](#6-first-week-engagement-plan)
7. [Post-Launch Checklist](#7-post-launch-checklist)

---

## 1. Pre-Launch Setup

### Discord Server Creation

1. **Create Server**
   - Server Name: `ozskr.ai`
   - Server Icon: Yellow brick logo (request from design)
   - Server Banner: Solana gradient with subtle brick pattern background

2. **Server Settings**
   - Verification Level: Medium (verified email + 5 min wait)
   - Explicit Content Filter: Scan all members
   - Default Notifications: Mentions only
   - 2FA Requirement: Enabled for mods
   - Community Features: Enabled (required for discovery)
   - Server Insights: Enabled

3. **Vanity URL** (if available)
   - Preferred: `discord.gg/ozskr`
   - Alternative: `discord.gg/ozskr-ai`

### Channel Creation

Refer to `discord-structure.md` for complete channel list. Create in this order:

**START HERE category:**
- #welcome (read-only)
- #rules (read-only)
- #roles (reaction roles)
- #announcements (announcement channel)

**GENERAL category:**
- #general
- #introductions
- #off-topic

**OZSKR PLATFORM category:**
- #feature-requests (forum channel)
- #bug-reports (forum channel)
- #showcase (gallery channel)
- #feedback

**BUILDERS category:**
- #dev-chat
- #github-feed (webhook only)
- #contributions

**DEFI category:**
- #trading-chat
- #hope-token

**COMMUNITY category:**
- #memes
- #content-share (gallery channel)
- #events

**SUPPORT category:**
- #help (forum channel)
- #faq (read-only)

### Role Creation

Create roles in this order (top to bottom in Discord):

| Role | Color | Permissions | Display Separately |
|------|-------|-------------|-------------------|
| @Team | `#9945FF` | Administrator | Yes |
| @Mod | `#F59E0B` | Manage Messages, Timeout Members, Manage Threads | Yes |
| @Alpha Tester | `#14F195` | Default permissions | Yes |
| @OG | `#FFD700` | Default permissions | No |
| @Contributor | `#10B981` | Default permissions | Yes |
| @Builder | `#3B82F6` | Default permissions | No |
| @Creator | `#A855F7` | Default permissions | No |
| @Trader | `#F97316` | Default permissions | No |
| @Community | `#06B6D4` | Default permissions | No |
| @Waitlist | `#FFFFFF` | Default permissions | No |

---

## 2. Bot Configuration

### Step 1: MEE6 or Carl-bot (Moderation + Welcome)

**Why this bot:** Auto-moderation, welcome messages, reaction roles, XP leveling

**Setup Steps:**

1. **Invite Bot**
   - MEE6: https://mee6.xyz/
   - Carl-bot (alternative): https://carl.gg/
   - Permissions needed: Manage Roles, Manage Messages, Send Messages, Embed Links, Manage Webhooks

2. **Welcome Message**
   - Channel: #welcome
   - Use the message from `discord-welcome-message.md` (see Section 3)
   - Enable embed formatting for visual appeal

3. **Auto-Moderation**
   - Enable spam filter (3+ messages in 5 seconds → 5 min timeout)
   - Blocked words list:
     ```
     wen moon, buy now, investment opportunity, guaranteed returns,
     financial advice, DM me, check DM, private message me
     ```
   - Action: Delete message + warn user (DM)
   - Anti-phishing: Auto-delete messages with Discord Nitro scam patterns

4. **Auto-Roles**
   - @OG role: Auto-assign to first 100 members (by join date)
   - @Waitlist role: Manually assign when user submits waitlist form

5. **Reaction Roles** (in #roles channel)
   - Post message: "React to get notified about topics you care about!"
   - Add reactions:
     - 🛠️ → @Builder
     - 🎨 → @Creator
     - 📈 → @Trader
     - 📣 → @Community

6. **XP Leveling** (Optional)
   - Enable XP for messages (1-5 XP per message, 60s cooldown)
   - Disable XP in: #memes, #off-topic, #trading-chat (prevent farming)
   - Leaderboard command: `!rank` and `!levels`
   - No role rewards (just community engagement tracker)

### Step 2: Collab.Land (Token Gating)

**Why this bot:** Verify $HOPE token holdings for role assignment

**Important:** Only set this up AFTER $HOPE is on mainnet. For alpha/beta, skip this section.

**Setup Steps (Future):**

1. **Invite Bot**
   - Website: https://collab.land/
   - Permissions needed: Manage Roles, View Channels

2. **Configure Token Gating**
   - Network: Solana
   - Token: $HOPE (SPL token address)
   - Rules:
     - Hold ≥10,000 $HOPE → assign @Alpha Tester
     - Hold ≥5,000 $HOPE → assign @Beta Tester (if needed)
     - Hold ≥1 $HOPE → assign @Community Member

3. **Verification Flow**
   - Create #verify channel (START HERE category)
   - Pin message: "Connect your Solana wallet to verify $HOPE holdings"
   - User clicks "Let's go!" → wallet connect → auto-role assignment

4. **Reconnection Reminder**
   - Auto-check every 24 hours
   - If balance drops below threshold, remove role (with 48h grace period)

**Note:** This is for UTILITY verification only. Never frame this as "investment tier" or "token holder benefits" that imply financial value.

### Step 3: GitHub Webhook (Activity Feed)

**Why this bot:** Keep community informed of development progress

**Setup Steps:**

1. **Discord Webhook URL**
   - Go to #github-feed → Edit Channel → Integrations → Create Webhook
   - Name: "GitHub Activity"
   - Copy webhook URL (format: `https://discord.com/api/webhooks/[ID]/[TOKEN]`)

2. **GitHub Configuration**
   - Go to: https://github.com/daftpixie/ozskr/settings/hooks
   - Add webhook → paste Discord URL
   - Content type: `application/json`
   - Events to trigger:
     - ✅ Pushes (to `main` branch only)
     - ✅ Pull requests (opened, closed, merged)
     - ✅ Issues (opened, labeled)
     - ✅ Releases
   - Enable: Active

3. **Message Formatting** (via GitHub webhook settings)
   - Use Discord embed format:
     ```json
     {
       "embeds": [{
         "title": "{{event}} in {{repo}}",
         "description": "{{message}}",
         "color": 10181631,
         "url": "{{url}}"
       }]
     }
     ```

4. **Test**
   - Create a test issue on GitHub
   - Verify message appears in #github-feed

### Step 4: Dyno or Carl-bot (Advanced Moderation)

**Why this bot:** Logging, auto-mod, role management

**Setup Steps:**

1. **Invite Bot**
   - Dyno: https://dyno.gg/
   - Permissions: Manage Roles, Manage Messages, View Audit Log

2. **Logging** (private #mod-log channel)
   - Message edits
   - Message deletes
   - Member joins/leaves
   - Role changes
   - Channel updates

3. **Auto-Mod Rules**
   - Slowmode enforcement:
     - #general: 5s
     - #off-topic: 3s
     - #trading-chat: 5s
     - #hope-token: 10s
   - Link filtering:
     - Allow: github.com, ozskr.vercel.app, twitter.com, solana.com
     - Block: Unknown domains (require manual approval in #mod-chat)
   - Mention spam: Max 5 mentions per message (auto-delete + warn)

---

## 3. Launch Announcement

### Internal Team Announcement (Before Public Launch)

Post in #team-internal (private):

```
Team — Discord is ready for alpha launch.

**Pre-launch checklist:**
✅ All channels configured
✅ Bots installed and tested
✅ Welcome message set
✅ Rules and FAQ posted
✅ Reaction roles working

**Launch plan:**
1. Invite 5-10 trusted testers (TODAY)
2. Monitor for 24-48 hours (test flows, fix bugs)
3. Public announcement on Twitter + landing page (Friday)
4. Invite first 25 alpha testers from waitlist

**Your action items:**
- @Matt: Final review of #rules and #faq
- @[Designer]: Upload server icon and banner
- @[Mod]: Test moderation commands
- @All: Post test messages in each channel to ensure permissions work

Let's go. 🪄
```

### Public Launch Announcement (Twitter + Landing Page)

**Twitter Thread:**

```
(1/4) The ozskr.ai Discord is now live. 🌪️

This is where we're building the future of Web3 AI agents — in public, with you.

Join here: [discord.gg/ozskr]

(2/4) What you'll find:

🛠️ Real-time GitHub activity (watch us build)
🐛 Direct feedback pipeline (your ideas → our roadmap)
🎨 Showcase your AI agent creations
💬 Chat with the team and community

(3/4) We're starting with 25 alpha testers from the waitlist.

If you're on the list, check your email TODAY.

Not on the list? Join here: https://ozskr.vercel.app

(4/4) One rule: No price speculation.

$HOPE is a utility token for unlocking platform features — not an investment.

Come for the AI. Stay for the magic. Pay no mind to the agents behind the emerald curtain. 🪄
```

**Landing Page Banner** (ozskr.vercel.app):

```
🎉 Discord is live! Join the community → [Link]
```

### In-Discord Launch Announcement (#announcements)

Post this AFTER the server has 10-20 members (to avoid "empty server" feel):

```
Welcome to the ozskr.ai Discord! 🌪️

This is mission control for building the future of AI agents on Solana.

**What we're building:**
- AI agents that create content, trade, and build on-chain influence
- Open source, MIT licensed, built entirely with Claude Code
- Powered by Claude AI + @solana/kit + Vercel AI SDK

**What's happening now:**
✅ Closed alpha with 25 testers (you're here!)
🔜 Beta launch (Q1 2026, 500 spots)
🔜 Mainnet migration (Q2 2026, post-audit)

**How to get involved:**
🛠️ Contribute code → check #contributions
🐛 Report bugs → #bug-reports
🎨 Share your creations → #showcase
💬 Hang out → #general

**Rules:**
Be respectful. No spam. No price speculation (see #rules for details).

**One more thing:**
This is a BUILD-IN-PUBLIC project. You're watching AI build an AI platform, live.
Every commit. Every decision. Every mistake. All transparent.

We're not in Kansas anymore. Let's go. 🪄

— The ozskr Team
```

---

## 4. Pinned Messages

### #general

```
📍 **Welcome to #general!**

This is the main hangout for the ozskr community.

**Quick Links:**
🎟️ Waitlist: https://ozskr.vercel.app
📖 Docs: https://github.com/daftpixie/ozskr
🐛 Report bugs: #bug-reports
💡 Request features: #feature-requests
🎨 Show off agents: #showcase

**Keep it friendly. Keep it on-topic. Keep building.** 🪄
```

### #alpha-testers (if private channel exists)

```
📍 **Alpha Tester HQ**

You're part of the first 25 people testing ozskr.ai. Thank you.

**Your mission:**
1. Break stuff (and tell us in #bug-reports)
2. Build agents (and share in #showcase)
3. Request features (in #feature-requests)
4. Be brutally honest (in #feedback)

**What we need from you:**
- Test on devnet (we'll send you test SOL if needed)
- Try wallet auth, agent creation, content generation
- Report ANYTHING weird (UI glitches, slow loads, confusing copy)

**Rewards:**
- Early access to new features
- @Alpha Tester role (permanent)
- Direct line to the team

**Timeline:**
Alpha runs for 2-4 weeks. Then we open to 500 beta testers.

Let's build something magical. 🌟
```

### #feature-requests

```
📍 **Feature Request Guidelines**

Use this template when posting:

**Feature:** [One-line title]
**Use Case:** [Why you need this]
**User Story:** As a [role], I want [feature] so that [benefit]
**Priority:** [Nice-to-have / Important / Critical]

**Examples:**
✅ "Add bulk agent creation for power users"
✅ "Support video generation (fal.ai integration)"
❌ "Make it better" (too vague)
❌ "Add price charts for $HOPE" (out of scope — $HOPE is utility, not investment)

We review requests weekly. Popular ideas get tagged `under consideration`. 🚀
```

### #bug-reports

```
📍 **Bug Report Guidelines**

Use this template when posting:

**Bug:** [Brief description]
**Steps to Reproduce:**
1. [Step one]
2. [Step two]
3. [Step three]

**Expected:** [What should happen]
**Actual:** [What actually happens]
**Environment:**
- Browser: [Chrome/Firefox/Safari]
- OS: [Windows/Mac/Linux]
- Wallet: [Phantom/Solflare/Backpack]
- Network: [devnet/mainnet]

**Screenshots:** [If applicable]

**Priority:**
🔴 Critical (blocks core functionality)
🟠 High (major feature broken)
🟡 Medium (annoying but workaround exists)
🟢 Low (cosmetic/minor)

We triage daily. Critical bugs get fixed within 24 hours. 🛠️
```

### #introductions

```
📍 **Welcome!**

Tell us about yourself:
- What excites you about AI agents?
- What do you want to build with ozskr?
- What's your background? (dev, creator, trader, or just curious?)

**Bonus points if you share:**
- A Wizard of Oz reference 🌪️
- Your favorite Solana project
- A meme

Let's get to know each other. This is a community, not just a Discord. 💚
```

### #showcase

```
📍 **Showcase Guidelines**

This is where you share what your AI agents create.

**What to post:**
✅ Agent-generated content (images, tweets, videos)
✅ Screenshots of your agent's personality/DNA
✅ Trading results (educational only, no financial advice)
✅ Integration experiments (new APIs, tools, features)

**What NOT to post:**
❌ Off-topic content not created by ozskr agents
❌ Price speculation or "gains" screenshots
❌ Spam or self-promotion for other projects

**Pro tip:** Use threads to share multiple outputs from the same agent session. 🎨
```

### #hope-token

```
📍 **$HOPE Utility Token Discussion**

⚠️ **IMPORTANT: $HOPE is a platform utility token, NOT an investment.**

✅ **DO discuss:**
- How $HOPE unlocks platform features
- Tokenomics (supply, distribution, staking mechanics)
- Use cases (access tiers, rate limits, premium features)
- Feedback on utility design

❌ **DON'T discuss:**
- Price predictions ("wen moon", "buy now")
- Financial advice or ROI expectations
- Comparing $HOPE to other tokens as investments

**Violators will be warned, then muted.**

This channel is for understanding how $HOPE works as a TOOL for the platform, not speculation. 🪄
```

### #dev-chat

```
📍 **Builder Resources**

**Contributing:**
- Read: https://github.com/daftpixie/ozskr/blob/main/CONTRIBUTING.md
- Good first issues: [link to GitHub label]
- Code of Conduct: https://github.com/daftpixie/ozskr/blob/main/CODE_OF_CONDUCT.md

**Tech Stack:**
- Next.js 15, TypeScript 5.x strict
- @solana/kit, Vercel AI SDK, Claude API
- Supabase (PostgreSQL + pgvector + RLS)
- Trigger.dev (background jobs)

**Questions?**
Ask here. The team monitors this channel daily. 🛠️
```

---

## 5. Moderation Guidelines

### Moderation Philosophy

**We moderate to protect, not to control.**

Goals:
1. Keep the community safe (no scams, phishing, harassment)
2. Keep discussions on-topic (but allow some flexibility)
3. Enforce $HOPE utility-only language (SEC compliance)
4. Support newcomers (be helpful, not punitive)

### Enforcement Tiers

| Offense | Action | Notes |
|---------|--------|-------|
| **First minor offense** | Delete + DM warning | Explain the rule, assume good intent |
| **Second minor offense** | 5 min timeout + DM | Clarify consequences |
| **Third minor offense** | 1 hour timeout | Escalate to mod chat |
| **Moderate offense** (spam, off-topic spam) | 1 hour timeout + delete | No prior warning needed |
| **Major offense** (scam, phishing, private key sharing) | Immediate ban + report to Discord | No warnings |
| **Severe offense** (harassment, hate speech, doxxing) | Immediate ban + report to Discord Trust & Safety | No warnings |

### Common Scenarios

#### Price Speculation in #hope-token

**Example:** "Guys, $HOPE is going to 100x when we hit mainnet. Buy now!"

**Action:**
1. Delete message
2. DM user:
   ```
   Hey [user], we removed your message in #hope-token.

   $HOPE is a utility token for unlocking platform features — not an investment.
   We don't allow price speculation to stay compliant with regulations.

   ✅ DO discuss: utility, features, tokenomics, staking
   ❌ DON'T discuss: price, gains, investment potential

   Thanks for understanding! 🪄
   ```
3. If repeated: 10 min timeout, then 1 hour, then temp ban

#### Spam/Self-Promotion

**Example:** User posts "Check out my new NFT collection!" with link in #general

**Action:**
1. Delete message
2. If first offense: DM warning
   ```
   Hey [user], we removed your link from #general.

   Self-promotion is only allowed in #content-share if it's related to ozskr agents.
   For unrelated projects, please don't post links.

   Thanks!
   ```
3. If repeated: 5 min timeout → 1 hour → kick

#### Phishing/Scam

**Example:** "DM me, I'm from the ozskr team and need to verify your wallet"

**Action:**
1. Immediate ban (no warning)
2. Report to Discord Trust & Safety
3. Post in #announcements:
   ```
   ⚠️ PSA: We will NEVER DM you asking for wallet info or private keys.

   A user was just banned for phishing. Please report any suspicious DMs to @Mod.

   Stay safe out there. 🛡️
   ```

#### Helpful Community Member

**Example:** User answers 5+ questions in #help, provides code examples, links to docs

**Action:**
1. Thank them publicly in #general:
   ```
   Shoutout to @[user] for being incredibly helpful in #help today. 🙏

   This is what community is all about. Appreciate you.
   ```
2. Consider for @Mod role (discuss in #team-internal)

#### Off-Topic in Specific Channels

**Example:** Meme posted in #dev-chat

**Action:**
1. React with ⚠️ emoji
2. Reply: "This belongs in #memes — let's keep #dev-chat technical. Thanks!"
3. If repeated: DM warning → timeout

### Escalation Path

1. **Mod handles** → routine enforcement (delete, warn, timeout)
2. **Escalate to mod-chat** → unclear situations, repeat offenders, borderline cases
3. **Escalate to @Team** → major decisions (bans, policy changes, appeals)
4. **Escalate to Matt** → legal concerns, PR-sensitive situations, community crises

---

## 6. First Week Engagement Plan

### Day 1 (Launch Day) — Sunday

**Goal:** Establish presence, set expectations

**Actions:**
1. **10:00 AM:** Announce on Twitter (see Section 3)
2. **10:15 AM:** Update ozskr.vercel.app banner with Discord link
3. **10:30 AM:** Invite first 10 alpha testers via email
4. **11:00 AM:** Matt posts in #general: "We're live! Welcome to the first 10. Let's break some stuff. 🪄"
5. **Throughout day:** Monitor #help, answer questions in real-time
6. **5:00 PM:** Matt posts in #introductions first, sets example
7. **End of day:** Invite 15 more alpha testers (total: 25)

**Engagement Tactics:**
- Mods and team post actively in #general (create "warm" vibe, not empty server)
- React to every introduction in #introductions
- Pin 1-2 high-quality messages in #general

### Day 2 (Monday) — Introductions

**Goal:** Get everyone to introduce themselves

**Actions:**
1. **9:00 AM:** Post in #announcements:
   ```
   Good morning, builders! ☀️

   **Today's mission:** Introduce yourself in #introductions.

   Tell us:
   - What excites you about AI agents?
   - What you want to build with ozskr?
   - Your background (dev/creator/trader/curious)?

   Let's get to know each other. We're building this together. 🪄
   ```
2. **Throughout day:** Matt/team reply to every introduction personally
3. **3:00 PM:** If <50% have introduced, post reminder in #general
4. **End of day:** Tally introduction count, thank participants

**Engagement Tactics:**
- Ask follow-up questions in threads (make it conversational)
- Highlight interesting intros in #general: "Love this intro from @user — check it out!"

### Day 3 (Tuesday) — First Showcase

**Goal:** Get first agent creation shared publicly

**Actions:**
1. **10:00 AM:** Matt posts first AI agent output in #showcase:
   ```
   First agent creation of the week! 🎨

   Meet "Dorothy" — my AI agent trained on Wizard of Oz lore.

   Prompt: "Write a tweet about the courage to build in public"

   Output: [screenshot of generated tweet]

   What's your agent creating? Share it here! 🪄
   ```
2. **Throughout day:** Encourage others to post in #showcase
3. **5:00 PM:** Feature best showcase in #announcements

**Engagement Tactics:**
- React to every showcase post with 🔥 or 🎨
- Ask questions in threads: "How did you tune the personality for this?"
- Retweet/quote best creations on Twitter with credit

### Day 4 (Wednesday) — Feature Request Prompt

**Goal:** Collect early feedback on roadmap priorities

**Actions:**
1. **9:00 AM:** Post in #announcements:
   ```
   Feature Request Day! 💡

   You've been using the platform for 3 days. What's missing?

   Head to #feature-requests and tell us what you want to see next.

   Use the template (pinned message) — makes it easier for us to prioritize.

   Your input shapes the roadmap. Let's hear it. 🚀
   ```
2. **Throughout day:** Matt/team reply to every feature request
3. **End of day:** Tally top 3 requests, acknowledge in #announcements

**Engagement Tactics:**
- Tag popular requests with `under consideration`
- For great ideas, reply: "Love this. Adding to the backlog. 🙌"
- For out-of-scope ideas, explain why (gently)

### Day 5 (Thursday) — Feedback Roundup

**Goal:** Check in on alpha progress, address pain points

**Actions:**
1. **10:00 AM:** Post in #feedback:
   ```
   Alpha check-in! 🛠️

   We're 5 days in. How's it going?

   What's working? What's broken? What's confusing?

   Brutal honesty appreciated. This is what alpha is for. 💬
   ```
2. **Throughout day:** Engage in discussions, take notes
3. **5:00 PM:** Matt posts summary in #announcements:
   ```
   Alpha Week 1 Feedback Summary:

   **What's working:** [2-3 highlights]
   **What's broken:** [2-3 pain points]
   **What we're fixing this week:** [1-2 commits]

   Keep the feedback coming. You're shaping this platform. 🙏
   ```

**Engagement Tactics:**
- Thank users for critical feedback: "This is gold. Thank you."
- For bugs, link to GitHub issue: "Tracked here: [link]"

### Day 6-7 (Weekend) — Open Q&A

**Goal:** Answer questions, foster community bonding

**Actions:**
1. **Saturday 2:00 PM:** Host live Q&A in #general
   ```
   Live Q&A starting now! 🎤

   Ask us anything:
   - How ozskr works
   - Why we built it
   - What's next
   - How to contribute
   - Literally anything

   We're here for the next 2 hours. Fire away. 🪄
   ```
2. **Sunday:** Chill day — monitor channels, let community self-organize
3. **End of weekend:** Post Week 1 recap in #announcements

**Engagement Tactics:**
- Share behind-the-scenes: "Here's the prompt that built the auth system"
- Talk about tech choices: "Why we picked @solana/kit over web3.js v1"
- Highlight top contributors: "Shoutout to @user for [contribution]"

### Week 1 Recap Post (#announcements)

Post on Sunday evening:

```
Week 1 of Alpha: Done. ✅

**By the numbers:**
- 25 alpha testers
- [X] bugs reported (and [Y] fixed)
- [Z] feature requests submitted
- [N] AI agent creations showcased

**Top highlights:**
1. [Most interesting bug/feature/creation]
2. [Community moment]
3. [Technical milestone]

**This week:**
- Fixing [top bug]
- Building [top feature request]
- Expanding alpha to 50 testers (waitlist opening Monday)

**Thank you** to every single person who tested, reported, created, and engaged.

This is just the beginning. Week 2, let's go. 🚀

— The ozskr Team
```

---

## 7. Post-Launch Checklist

### Day 1
- [ ] Twitter announcement posted
- [ ] Landing page banner updated
- [ ] First 10 alpha testers invited
- [ ] Welcome messages working (MEE6/Carl-bot)
- [ ] Team posts in #general to "warm up" the server
- [ ] Matt posts first introduction in #introductions
- [ ] Monitor #help for technical issues

### Day 2
- [ ] Introduction prompt posted in #announcements
- [ ] All 25 alpha testers invited
- [ ] Respond to every introduction
- [ ] Check bot logs (ensure no errors)

### Day 3
- [ ] First showcase post by Matt
- [ ] Feature 1-2 community showcases in #announcements
- [ ] Retweet best creation on Twitter

### Day 4
- [ ] Feature request prompt posted
- [ ] Reply to all feature requests by end of day
- [ ] Tag top 3 with `under consideration`

### Day 5
- [ ] Feedback roundup posted
- [ ] Summary of Week 1 findings in #announcements
- [ ] Create GitHub issues for critical bugs

### Day 6-7
- [ ] Live Q&A hosted
- [ ] Week 1 recap posted
- [ ] Plan Week 2 content (new features, events, milestones)

### Ongoing (Daily)
- [ ] Check #bug-reports (triage within 24 hours)
- [ ] Check #feature-requests (acknowledge within 48 hours)
- [ ] Check #help (answer within 4 hours during business hours)
- [ ] Monitor #mod-log for issues
- [ ] Post at least once in #general (keep energy up)

---

## Notes for Matt

### Tone and Energy

- **Be present.** The first week sets the vibe. If you're active, the community will be too.
- **Be transparent.** Share the messy parts. "We broke auth last night. Fixed it at 2am. Here's what happened."
- **Be encouraging.** Thank people for feedback, even when it's critical. "This is exactly what we need. Thank you."
- **Be magical.** Use Wizard of Oz references sparingly (1-2 per day max), but when you do, commit to the bit.

### Delegation

- Mods should handle: Routine enforcement, FAQ answers, channel organization
- You should handle: Big announcements, feature decisions, community crises, Q&A sessions

### Escalation

If something feels legally sensitive (e.g., user posts "$HOPE investment advice"), escalate to:
1. Delete immediately
2. DM user with clear explanation
3. Screenshot for records
4. Discuss with attorney if needed (SEC risk)

---

**Document Status:** Ready for Execution
**Owner:** content-writer (glinda-cmo)
**Last Updated:** 2026-02-13
