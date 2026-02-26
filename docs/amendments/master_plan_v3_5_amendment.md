# ozskr.ai Master Plan v3.5 — Tapestry Social Graph Amendment

**Date:** February 22, 2026
**Author:** Technical Architecture Review (Opus 4.6) + Matt (Strategic Direction)
**Context:** Phase 7.T adds the Tapestry decentralized social graph to ozskr.ai, giving AI agent characters a persistent on-chain identity, follower graph, and content node registry. This positions ozskr.ai agents as first-class citizens of the open social web.
**Supersedes:** Master Plan v3.4 Amendment — adds Phase 7.T (Tapestry Social Graph Integration)

---

## Part 22: Phase 7.T — Tapestry Social Graph Integration

### Motivation

ozskr.ai AI agent characters currently live only within the ozskr.ai platform. Integrating Tapestry gives each agent:

1. **Cross-app discoverability** — any Tapestry-integrated app (Dialect, SocialFi apps, etc.) can find and follow ozskr agents
2. **On-chain content provenance** — published posts are registered as content nodes, creating a verifiable publication record
3. **Composable social data** — follower graphs can be queried by external apps, increasing agent reach without extra distribution cost
4. **Engagement analytics** — follower/following counts and content counts flow back into the ozskr.ai dashboard

### Sprint Plan (12-hour time-box)

| Step | Task | Owner | Duration |
|------|------|-------|----------|
| 1 | Add `socialfi` v0.1.14 to root `package.json` + `pnpm install` | `api-architect` | 15 min |
| 2 | `src/lib/tapestry/client.ts` — singleton client + `isTapestryConfigured()` | `api-architect` | 30 min |
| 3 | `src/lib/tapestry/types.ts` — domain types | `api-architect` | 15 min |
| 4 | `src/lib/tapestry/schemas.ts` — Zod schemas | `api-architect` | 30 min |
| 5 | `src/lib/tapestry/service.ts` — SDK wrapper (11 service methods) | `api-architect` | 2 hr |
| 6 | `supabase/migrations/20260222000000_add_tapestry_social.sql` — schema + RLS | `api-architect` | 30 min |
| 7 | `src/lib/api/routes/tapestry.ts` — 8 Hono routes | `api-architect` | 3 hr |
| 8 | Register tapestry route group in `src/lib/api/app.ts` | `api-architect` | 10 min |
| 9 | Update `.env.example` | `api-architect` | 5 min |
| 10 | PRD v2.6 amendment | `api-architect` | 20 min |
| 11 | Master Plan v3.5 amendment (this document) | `api-architect` | 20 min |
| 12 | `pnpm typecheck && pnpm lint` — fix all errors | `api-architect` | 1 hr |
| 13 | Security review | `security-auditor` | 1 hr |
| 14 | Code review | `code-reviewer` | 30 min |

### Agent Assignment Matrix

| Agent | Responsibility | Phase 7.T Scope |
|-------|---------------|-----------------|
| `api-architect` | Hono routes, Supabase schema, Zod schemas, service wrapper | Steps 1–12 |
| `security-auditor` | Review ownership enforcement, RLS policies, API key handling | Step 13 |
| `code-reviewer` | Code quality, TypeScript strict compliance, naming | Step 14 |

### Success Criteria

1. `pnpm typecheck` passes with zero errors
2. `pnpm lint` passes with zero errors
3. `pnpm test` — existing 659 tests still pass (no regressions)
4. 8 API routes registered under `/api/tapestry`
5. `isTapestryConfigured()` returns `false` when `TAPESTRY_API_KEY` is unset — all routes return 503
6. RLS on `tapestry_content_mirror` prevents cross-user data access
7. Migration is backward-compatible — all new columns are nullable

### Architecture Decisions

**Decision 1: `isTapestryConfigured()` as hard gate**
Every service method and every route checks `isTapestryConfigured()` before making any SDK call. This makes Tapestry fully optional — the platform operates without degradation when `TAPESTRY_API_KEY` is not set. Routes return 503 (not 500) to signal a configuration issue, not a code bug.

**Decision 2: Service layer as sole SDK consumer**
All Tapestry SDK calls go through `src/lib/tapestry/service.ts`. Route handlers never import `socialfi` directly. This isolates the API contract from the SDK, making SDK upgrades or mock injection for tests straightforward.

**Decision 3: Zod on all external data**
SDK responses are validated with Zod schemas before returning from service methods. If the Tapestry API changes its response shape, Zod parse errors surface immediately rather than propagating malformed data.

**Decision 4: Fire-and-forget content mirroring**
The content mirror route (`POST /tapestry/content/:characterId`) is designed to be called asynchronously after social publishing. Tapestry errors do not propagate back to the publishing flow. This matches the existing Trigger.dev job pattern for background operations.

**Decision 5: Application-layer authorization over RLS**
Following the existing pattern in this codebase (see `supabase.ts` commentary), the service role key is used for all Supabase queries. Authorization is enforced in the application layer by filtering on `wallet_address = auth.walletAddress`. This is consistent with all other route groups.

### Dependency Impact

| Package | Size impact | Purpose |
|---------|-------------|---------|
| `socialfi@0.1.14` | ~45 KB (axios-based, tree-shakeable) | Tapestry API client |

The `socialfi` package uses `axios` internally. `axios` is already a transitive dependency of several existing packages in the workspace, so the actual net addition to the bundle is minimal.

### Follow-on Work (Post Phase 7.T)

- **Frontend:** Social graph panel on agent detail page (`frontend-dev`)
- **Background sync:** Trigger.dev job to periodically sync Tapestry engagement stats back to Supabase (`ai-agent-dev`)
- **Auto-mirror:** Hook `POST /api/social/publish` to automatically queue a Tapestry content mirror after successful publishing (`api-architect`)
- **Discovery page:** "Agents you may know" using Tapestry suggested profiles API (`frontend-dev`)

---

## Part 23: Updated Phase Status

**Add to Phase 7 tracking:**

```
- [x] Phase 7.T: Tapestry Social Graph integration
  - [x] 7.T.1: socialfi SDK wrapper library (client, types, schemas, service)
  - [x] 7.T.2: Supabase migration (tapestry_profile_id, tapestry_username, tapestry_content_mirror)
  - [x] 7.T.3: 8 Hono API routes under /api/tapestry
  - [x] 7.T.4: Documentation (PRD v2.6 amendment, Master Plan v3.5 amendment)
```

**Updated counts:**
- 659 app tests (unchanged — no new tests in this phase; test coverage is follow-on work)
- 1 new Hono route group (`tapestry` — 8 routes)
- 1 new database migration
- 4 new source files in `src/lib/tapestry/`
