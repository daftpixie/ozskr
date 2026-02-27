-- Migration: fix_users_sessions_service_role
-- Date: 2026-02-27
--
-- Problem:
--   POST /api/auth/verify fails with "Failed to create or update user".
--
--   The `users` and `sessions` tables are the only tables in the schema that
--   have NO service_role RLS policy.  Every other table (characters, agent_runs,
--   content, alpha_whitelist, etc.) explicitly grants service_role full access.
--
--   During a Supabase upsert via PostgREST, the engine evaluates BOTH the INSERT
--   and UPDATE policies.  The existing INSERT policy on `users` is:
--
--     WITH CHECK (wallet_address = (auth.jwt() ->> 'wallet_address'))
--
--   When the client key is misconfigured, the JWT secret rotated, or Supabase's
--   GoTrue does not recognise the service role claim, auth.jwt() returns NULL and
--   the WITH CHECK evaluates to (wallet_address = NULL) → false, blocking every
--   new-user INSERT even though service_role is supposed to bypass RLS.
--
--   Adding explicit service_role policies:
--   1. Closes the gap vs. every other table in the schema.
--   2. Makes the bypass explicit and auditable.
--   3. Ensures the upsert succeeds even under edge-case JWT parsing failures.
--
-- Additional fix:
--   The `sessions` table also lacks a service_role policy.  The auth route uses
--   the service role client for nonce checks (SELECT), session INSERT, and session
--   DELETE — all of which were relying on implicit bypass rather than an explicit
--   policy.  This migration adds it for consistency and safety.
--
-- Backward-compatible: adds policies only, no schema changes.

-- ---------------------------------------------------------------------------
-- users table — service role full access
-- ---------------------------------------------------------------------------

CREATE POLICY "Service role can manage all users"
  ON users FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- sessions table — service role full access
-- ---------------------------------------------------------------------------

CREATE POLICY "Service role can manage all sessions"
  ON sessions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
