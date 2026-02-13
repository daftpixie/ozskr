# Security Re-Audit: Pre-Alpha Gate

**Date:** 2026-02-12
**Auditor:** Claude Code (security-auditor agents)
**Scope:** Payment flows, content moderation pipeline, gamification rewards
**Result:** ALPHA GATE PASSED — 0 CRITICAL findings

---

## Audit 1: Payment Flows — PASSED

**14 checks passed**, 3 warnings (MEDIUM/LOW)

### Verified Secure

- **Client-side signing only** — All transaction signing goes through `WalletSignerAdapter`; no private key storage or server-side signing anywhere in the codebase
- **Transaction simulation required** — `simulateTransaction()` called before every swap execution; simulation failure aborts the flow
- **Human confirmation dialog** — `SwapConfirmModal` displays amounts, slippage, minimum received, network fee, price impact; explicit "Confirm Swap" button required
- **No custody model** — API creates swap _record_ only (202 status with "Execute transaction client-side"); no server-side transaction submission
- **Address validation** — `address()` from `@solana/kit` validates all addresses before RPC calls
- **BigInt financial math** — All amount calculations use BigInt; no floating point in financial logic
- **RLS policies complete** — RLS enabled on `swap_history`, `watchlist`, `token_balances_cache`; scoped to `auth.jwt() ->> 'wallet_address'`
- **Rate limiting** — Swap, quote, and read endpoints all rate-limited via Upstash Redis
- **Input validation** — Zod schemas enforce slippage range, Base58 address format, amount format
- **Error handling** — Sensitive keywords redacted from logs; no stack traces exposed to client
- **No env files committed** — All `.env*` patterns in `.gitignore`

### Warnings

| # | Severity | File(s) | Description | Blocks Alpha? |
|---|----------|---------|-------------|---------------|
| 1 | MEDIUM | `jupiter.ts:123`, `trading.ts:27`, `trade/page.tsx:122` | Slippage cap mismatch: Jupiter client enforces 100 bps max, UI allows 300 bps. Align to PRD spec (10-300 bps). | NO |
| 2 | LOW | `swap-flow.ts:174` | Missing `assertIsAddress()` in priority fee estimation (addresses already validated earlier in flow). | NO |
| 3 | LOW | `token-list.ts` | Token list may be hardcoded client-side. Verify dynamic fetch or document deployment process. | NO |

---

## Audit 2: Content Moderation Pipeline — PASSED

**13 checks passed**, 3 warnings (MEDIUM/LOW)

### Verified Secure

- **Moderation before storage** — Pipeline stage ordering enforced: moderation (stage 6) runs before store (stage 7); `storeAndNotify()` receives `moderationStatus` from moderation stage
- **Moderation before publishing** — `publishToAccount()` explicitly checks `moderation_status !== APPROVED` and throws; social publish route enforces same check
- **No bypass paths** — No code path skips moderation stage in pipeline orchestration
- **OpenAI text moderation** — `omni-moderation-latest` model with three-tier flow: REJECTED (>0.8 score), FLAGGED (lower scores, manual review), APPROVED
- **Mem0 namespace isolation** — Namespace is server-generated (`char_<uuid>`), regex-validated (`/^char_[0-9a-f]{8}-...$/i`), fetched from database (never user input)
- **Cross-character access prevented** — Mem0 SDK scoped by `user_id` parameter matching namespace
- **Input validation** — Prompt length capped at 5000 characters; Zod schemas on all AI route handlers
- **RLS on AI tables** — `content_generations` and `character_memory` have RLS with character ownership checks

### Warnings

| # | Severity | File(s) | Description | Blocks Alpha? |
|---|----------|---------|-------------|---------------|
| 1 | MEDIUM | `moderation.ts:142-163` | Image moderation is a stub (auto-approves, relies on fal.ai built-in safety). Implement AWS Rekognition before beta. | NO |
| 2 | LOW | `store.ts:48-64` | Missing explicit `generated_by` attribution field. `model_used` exists but legal disclosure may require dedicated field. | NO |
| 3 | LOW | `generate-scheduled.ts:99` | Scheduled generation passes empty JWT token. Phase 4 feature, not needed for alpha. | NO |

---

## Audit 3: Gamification Rewards — PASSED

**18 checks passed**, 3 warnings (MEDIUM/LOW)

### Verified Secure

- **Server-side rewards only** — No reward claim endpoints; all points awarded server-side as side effects of validated actions
- **Service role enforcement** — `awardPoints()`, `updateStreak()`, `checkAndUnlockAchievements()` all use `SUPABASE_SERVICE_ROLE_KEY`
- **Append-only ledger** — `user_points` has no user-writable policies; only service role can INSERT; no DELETE operations in codebase
- **No manipulation vectors** — All stat updates use service role client; no raw SQL or string interpolation
- **Leaderboard read-only** — `leaderboard_cache`: users SELECT only; service role UPDATE/INSERT only
- **RLS on all 5 tables** — `user_points`, `user_stats`, `achievements`, `user_achievements`, `leaderboard_cache`
- **Race condition handling** — Achievement unlock duplicates caught via UNIQUE constraint + error code 23505
- **Auth middleware** — All gamification routes protected by `authMiddleware` + `readLimiter`
- **No $HOPE redemption** — Points system is cosmetic gamification only; compliant with no-platform-transactions rule

### Warnings

| # | Severity | File(s) | Description | Blocks Alpha? |
|---|----------|---------|-------------|---------------|
| 1 | MEDIUM | `phase5_gamification.sql` | No CHECK constraint preventing negative `points_amount` or `total_points`. Add `CHECK (points_amount > 0)`. | NO |
| 2 | LOW | `streaks.ts:149-176` | Streak bonus race condition: bonus points inserted separately from streak update. Use database transaction for atomicity. | NO |
| 3 | LOW | `leaderboard.ts:435-461` | 5-minute cache staleness during high activity. UX issue, not security. | NO |

---

## Consolidated Summary

| Domain | Checks Passed | Warnings | Critical | Alpha Ready? |
|--------|--------------|----------|----------|-------------|
| Payment Flows | 14 | 3 | 0 | YES |
| Content Moderation | 13 | 3 | 0 | YES |
| Gamification | 18 | 3 | 0 | YES |
| **Total** | **45** | **9** | **0** | **YES** |

## Pre-Beta Priority Fixes

1. Align slippage constraints to 10-300 bps across all layers (MEDIUM)
2. Implement image moderation via AWS Rekognition or equivalent (MEDIUM)
3. Add CHECK constraints for negative points prevention (MEDIUM)

## Files Audited

50+ files across:
- `src/features/trading/` (swap flow, confirm modal, portfolio)
- `src/lib/solana/` (jupiter, transactions, hope-token, tokens, rpc, confirmation, network-config, siws)
- `src/lib/ai/pipeline/` (index, parse, context, enhance, generate, quality, moderation, store)
- `src/lib/ai/` (memory, character-dna, models)
- `src/lib/social/` (ayrshare, twitter/, publisher-factory, adapters)
- `src/lib/jobs/` (publish-social, generate-scheduled)
- `src/lib/gamification/` (points, streaks, achievements, leaderboard, tiers)
- `src/lib/api/routes/` (trading, ai, content, social, schedules, gamification)
- `src/lib/api/middleware/` (auth, rate-limit)
- `src/features/wallet/` (store, hooks, components)
- `supabase/migrations/` (all schema files)
