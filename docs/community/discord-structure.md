# Discord Server Structure

**Server Name:** ozskr.ai
**Handle:** ozskr-ai
**Theme:** Wizard of Oz meets Web3 AI

## Server Description

> Build AI agents that trade, create, and influence — all on Solana. Open source. MIT licensed. Pay no mind to the agents behind the emerald curtain.

(For Discord directory: "Web3 AI agent platform on Solana. Create autonomous AI influencers. Build in public. Open source.")

---

## Roles

| Role | Color | Description | Assignment |
|------|-------|-------------|------------|
| @Team | `#9945FF` (Solana Purple) | ozskr core team | Manual |
| @Mod | `#F59E0B` (Brick Gold) | Community moderators | Manual |
| @Alpha Tester | `#14F195` (Solana Green) | Active alpha testers | Manual (via waitlist → access) |
| @OG | `#FFD700` (Gold) | First 100 server members | Auto (MEE6/Carl-bot) |
| @Contributor | `#10B981` (Green) | GitHub contributors (merged PR) | Manual (verified via GitHub) |
| @Builder | `#3B82F6` (Blue) | Active in dev channels | Self-assign (reaction role) |
| @Waitlist | `#FFFFFF` (White) | Signed up for beta | Auto (via form integration) |

---

## Channel Structure

### 📍 START HERE

#### #welcome
- **Type:** Text (read-only, except @Team)
- **Purpose:** Auto-greet new members
- **Permissions:** @everyone can read, only @Team can post
- **Content:** Welcome message (see below)

#### #rules
- **Type:** Text (read-only)
- **Purpose:** Server rules and code of conduct
- **Permissions:** @everyone can read, only @Team can post
- **Content:**
  ```
  1. Be respectful — no harassment, hate speech, or personal attacks
  2. No spam or unsolicited self-promotion
  3. Keep price speculation and financial advice out — $HOPE is a utility token, not an investment
  4. No phishing, scams, or sharing of private keys/seed phrases
  5. Stay on-topic in channels
  6. Use English in main channels (regional channels may differ)
  7. Follow Discord TOS and Community Guidelines
  8. Moderators have final say — respect their decisions
  ```

#### #roles
- **Type:** Text (reaction roles)
- **Purpose:** Self-assign interest roles
- **Permissions:** @everyone can read/react
- **Roles available:**
  - 🛠️ @Builder (interested in contributing code)
  - 🎨 @Creator (interested in agent content creation)
  - 📈 @Trader (interested in DeFi features)
  - 📣 @Community (interested in events/outreach)

#### #announcements
- **Type:** Announcement channel
- **Purpose:** Major platform updates, feature launches, events
- **Permissions:** @Team only can post, @everyone can read/react
- **Auto-publish:** Enabled (cross-post to following servers)

---

### 💬 GENERAL

#### #general
- **Type:** Text
- **Purpose:** Main community chat
- **Permissions:** @everyone (slow mode: 5s)

#### #introductions
- **Type:** Text
- **Purpose:** New member introductions
- **Permissions:** @everyone
- **Prompt:** "Welcome to ozskr.ai! Tell us: What excites you about AI agents? What are you hoping to build?"

#### #off-topic
- **Type:** Text
- **Purpose:** Non-ozskr discussion (memes, Solana ecosystem, AI news)
- **Permissions:** @everyone (slow mode: 3s)

---

### 🤖 OZSKR PLATFORM

#### #feature-requests
- **Type:** Forum channel
- **Purpose:** Suggest new platform features
- **Permissions:** @everyone can post, @Team/@Mod can tag
- **Tags:** `ui`, `agents`, `trading`, `content`, `integrations`
- **Template:**
  ```
  **Feature:** [Brief title]
  **Use Case:** [Why you need this]
  **User Story:** As a [role], I want [feature] so that [benefit]
  ```

#### #bug-reports
- **Type:** Forum channel
- **Purpose:** Report platform bugs (triaged to GitHub)
- **Permissions:** @everyone can post, @Team/@Mod can tag
- **Tags:** `critical`, `high`, `medium`, `low`, `fixed`, `duplicate`
- **Template:**
  ```
  **Bug:** [Brief description]
  **Steps to Reproduce:** [Numbered steps]
  **Expected:** [What should happen]
  **Actual:** [What actually happens]
  **Environment:** [Browser/OS, wallet adapter, network]
  ```

#### #showcase
- **Type:** Gallery channel
- **Purpose:** Share agent creations, content, screenshots
- **Permissions:** @everyone can post (slow mode: 30s)
- **Auto-thread:** Enabled (each post creates a thread)

#### #feedback
- **Type:** Text
- **Purpose:** General product feedback (not formal bug reports)
- **Permissions:** @everyone

---

### 🛠️ BUILDERS

#### #dev-chat
- **Type:** Text
- **Purpose:** Technical discussions, architecture, contributing
- **Permissions:** @everyone (recommended for @Builder role)
- **Topics:** Code reviews, implementation ideas, OSS best practices

#### #github-feed
- **Type:** Text (read-only, webhook)
- **Purpose:** Live feed of GitHub activity
- **Permissions:** Webhook posts, @everyone can read
- **Events:** commits to `main`, new PRs, PR merges, new issues, releases

#### #contributions
- **Type:** Text
- **Purpose:** Coordinate contributions (planning, RFC discussions, first-time contributors)
- **Permissions:** @everyone
- **Pinned:** Link to CONTRIBUTING.md, good first issues, contributor guidelines

---

### 💎 DEFI

#### #trading-chat
- **Type:** Text
- **Purpose:** Discuss agent trading strategies, DeFi integrations, Jupiter/Raydium
- **Permissions:** @everyone (slow mode: 5s)
- **Note:** Keep technical and educational — no "buy X token" or market manipulation

#### #hope-token
- **Type:** Text
- **Purpose:** Discuss $HOPE utility, tokenomics, platform tiers
- **Permissions:** @everyone (slow mode: 10s)
- **Rules (pinned):**
  ```
  ⚠️ $HOPE is a platform utility token, NOT an investment.

  ✅ DO discuss: utility, features, use cases, staking mechanics
  ❌ DON'T discuss: price predictions, "wen moon", investment advice

  This channel is for understanding how $HOPE unlocks platform features,
  not for financial speculation. Violators will be muted.
  ```

---

### 🌐 COMMUNITY

#### #memes
- **Type:** Text
- **Purpose:** Wizard of Oz memes, AI memes, ozskr humor
- **Permissions:** @everyone (slow mode: 5s)

#### #content-share
- **Type:** Gallery channel
- **Purpose:** Share content created BY ozskr agents (tweets, images, videos)
- **Permissions:** @everyone (slow mode: 30s)

#### #events
- **Type:** Text
- **Purpose:** Announce and discuss community events (Twitter Spaces, AMAs, hackathons)
- **Permissions:** @Team can create events, @everyone can discuss

---

### 🆘 SUPPORT

#### #help
- **Type:** Forum channel
- **Purpose:** Get help with the platform (wallet connection, agent setup, etc.)
- **Permissions:** @everyone can post, @Team/@Mod/@Alpha Tester can answer
- **Tags:** `wallet`, `agents`, `trading`, `resolved`
- **Auto-archive:** 24 hours after marked resolved

#### #faq
- **Type:** Text (read-only)
- **Purpose:** Common questions and answers
- **Permissions:** @everyone can read, @Team can post
- **Content:**
  ```
  **Q: What is ozskr.ai?**
  A: An open-source Web3 platform for creating AI agents that generate content,
     trade on Solana DEXs, and build on-chain influence. Built with Claude Code.

  **Q: Is this free?**
  A: The platform is free during alpha. Future tiers may require $HOPE tokens
     to unlock premium features (not an investment, utility only).

  **Q: What is $HOPE?**
  A: A Solana SPL utility token that unlocks platform features like advanced
     agent memory, higher rate limits, and priority content generation.

  **Q: Can I contribute?**
  A: Yes! We're open source (MIT). Check github.com/daftpixie/ozskr and
     read CONTRIBUTING.md.

  **Q: Which wallets are supported?**
  A: Phantom, Solflare, Backpack, and any wallet supporting @solana/wallet-adapter.

  **Q: Is this on mainnet?**
  A: Currently devnet. Mainnet launch post-audit (Q2 2026).

  **Q: How do I report a bug?**
  A: Post in #bug-reports (Discord) or open an issue on GitHub.
  ```

---

## Welcome Message

Auto-posted in #welcome when a new member joins:

```
Welcome to ozskr.ai, {user}! 🌪️

You've just stepped into the Emerald City of Web3 AI.

**What is ozskr?**
We're building the first open-source platform where you can create AI agents
that trade on Solana, generate content, and build on-chain influence.
All powered by Claude AI. All MIT licensed.

**Getting Started:**
🎟️ Join the waitlist → https://ozskr.vercel.app
📖 Read the docs → github.com/daftpixie/ozskr
🛠️ See what we're building → #announcements
💬 Introduce yourself → #introductions
🐛 Found a bug? → #bug-reports
🎨 Show off your agents → #showcase

**Important Rules:**
✅ Be respectful and helpful
❌ No price speculation (see #rules)
❌ No financial advice

**Grab Your Roles:**
Head to #roles and react to get pings for topics you care about.

Pay no mind to the agents behind the emerald curtain. 🪄

— The ozskr Team
```

---

## Bot Configuration

### Moderation Bot (MEE6 or Carl-bot)

**Auto-moderation:**
- Delete messages with common scam patterns (e.g., "DM me for support", phishing links)
- Auto-timeout users who spam (3+ messages in 5 seconds → 5 min timeout)
- Detect and warn for banned words (list includes: "wen moon", "buy now", "investment opportunity")

**Auto-roles:**
- Assign @OG to first 100 members (tracked by join date)
- Assign @Waitlist when user reacts to waitlist announcement

**Leveling (optional):**
- XP for chat activity (not used for permissions, just community engagement)
- Leaderboard in #general

### GitHub Webhook

- **Endpoint:** `https://discord.com/api/webhooks/[ID]/[TOKEN]`
- **Events:** push (main only), pull_request (opened, merged), issues (opened, labeled `good first issue`), release
- **Channel:** #github-feed

### Collab.Land (Token Gating) — Future

When $HOPE launches on mainnet:
- **Rule:** Hold ≥1000 $HOPE → auto-assign @Holder role
- **Channel:** #hope-holders (exclusive)

---

## Moderation Guidelines

### Enforcement Tiers

1. **Warning** (DM from mod)
   - First offense (minor)
   - Clarify the rule

2. **Timeout** (5 min → 1 hour → 24 hours)
   - Repeated minor offenses
   - Single moderate offense (spam, off-topic in wrong channel)

3. **Kick** (can rejoin)
   - Repeated moderate offenses
   - Ignoring mod warnings

4. **Ban** (permanent)
   - Scamming, phishing, posting private keys
   - Harassment, hate speech, doxxing
   - Ban evasion

### Common Scenarios

| Scenario | Action |
|----------|--------|
| Price speculation about $HOPE in #hope-token | Delete message + warning (DM) |
| Spamming links in #general | 5 min timeout + delete |
| Phishing DM reported | Immediate ban + report to Discord |
| Off-topic in #dev-chat | Move to #off-topic (warn if repeated) |
| Arguing with mods | 1 hour timeout + DM (escalate if continues) |
| Helpful community member | Thank in #general, consider for @Mod |

### Mod Tools

- **Dyno or Carl-bot:** Logging (message edits, deletes, joins, leaves) to private #mod-log
- **Private channels:** #mod-chat (mod coordination), #team-internal (team only)

---

## Server Settings

- **Verification Level:** Medium (verified email + 5 min wait)
- **Explicit Content Filter:** Scan all members
- **Default Notifications:** Mentions only
- **2FA Requirement:** Enabled for mods
- **Community Features:** Enabled (for discovery)
- **Server Insights:** Enabled (track growth metrics)

---

## Launch Checklist

- [ ] Create all channels and categories
- [ ] Configure role colors and permissions
- [ ] Set up MEE6/Carl-bot with auto-mod rules
- [ ] Add GitHub webhook to #github-feed
- [ ] Write and pin welcome message in #welcome
- [ ] Write and pin rules in #rules
- [ ] Write and pin FAQ in #faq
- [ ] Write and pin $HOPE guidelines in #hope-token
- [ ] Create reaction roles in #roles
- [ ] Invite core team and assign @Team role
- [ ] Test all webhooks and bots
- [ ] Enable community features for Discord discovery
- [ ] Announce launch in Twitter + ozskr.vercel.app

---

**Document Owner:** content-writer
**Last Updated:** 2026-02-13
**Status:** Draft (ready for review)
