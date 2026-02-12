-- ozskr.ai Phase 3 Trading Schema
-- Migration: 20260211000002_phase3_trading.sql
-- Created: 2026-02-11
-- Description: Trading tables for Jupiter Ultra swaps, watchlists, and token balance caching

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Swap status enum
CREATE TYPE swap_status AS ENUM ('pending', 'simulated', 'confirmed', 'failed');

-- =============================================================================
-- TABLES
-- =============================================================================

-- Swap history table
CREATE TABLE swap_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  input_mint TEXT NOT NULL,
  output_mint TEXT NOT NULL,
  input_amount TEXT NOT NULL,
  output_amount TEXT,
  slippage_bps INTEGER NOT NULL DEFAULT 50,
  priority_fee_lamports TEXT DEFAULT '0',
  jupiter_order_id TEXT,
  transaction_signature TEXT,
  status swap_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  simulation_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

-- Watchlist table
CREATE TABLE watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  token_mint TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_name TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(wallet_address, token_mint)
);

-- Token balances cache table
CREATE TABLE token_balances_cache (
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  token_mint TEXT NOT NULL,
  balance TEXT NOT NULL DEFAULT '0',
  decimals INTEGER NOT NULL DEFAULT 0,
  usd_value DECIMAL(20,8),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(wallet_address, token_mint)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Swap history indexes
CREATE INDEX idx_swap_history_wallet_address ON swap_history(wallet_address, created_at DESC);
CREATE INDEX idx_swap_history_status ON swap_history(status);
CREATE INDEX idx_swap_history_created_at ON swap_history(created_at DESC);

-- Watchlist indexes
CREATE INDEX idx_watchlist_wallet_address ON watchlist(wallet_address);
CREATE INDEX idx_watchlist_token_mint ON watchlist(token_mint);

-- Token balances cache indexes
CREATE INDEX idx_token_balances_cache_wallet_address ON token_balances_cache(wallet_address);
CREATE INDEX idx_token_balances_cache_last_updated ON token_balances_cache(last_updated_at);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE swap_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_balances_cache ENABLE ROW LEVEL SECURITY;

-- Swap history policies
CREATE POLICY "Users can read their own swap history"
  ON swap_history FOR SELECT
  USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Users can insert their own swap records"
  ON swap_history FOR INSERT
  WITH CHECK (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Users can update their own swap records"
  ON swap_history FOR UPDATE
  USING (wallet_address = (auth.jwt() ->> 'wallet_address'))
  WITH CHECK (
    -- Only allow updating specific fields (not wallet_address or mints)
    wallet_address = (auth.jwt() ->> 'wallet_address')
  );

-- Watchlist policies
CREATE POLICY "Users can read their own watchlist"
  ON watchlist FOR SELECT
  USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Users can add to their own watchlist"
  ON watchlist FOR INSERT
  WITH CHECK (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Users can delete from their own watchlist"
  ON watchlist FOR DELETE
  USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

-- Token balances cache policies
CREATE POLICY "Users can read their own token balances"
  ON token_balances_cache FOR SELECT
  USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

-- Service role policies (for background jobs that update balances)
CREATE POLICY "Service role can manage swap history"
  ON swap_history FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage token balances"
  ON token_balances_cache FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE swap_history IS 'Historical record of all Jupiter Ultra swap transactions';
COMMENT ON TABLE watchlist IS 'User watchlist for tracking specific tokens';
COMMENT ON TABLE token_balances_cache IS 'Cached token balances to reduce RPC calls';

COMMENT ON COLUMN swap_history.wallet_address IS 'Solana wallet address initiating the swap';
COMMENT ON COLUMN swap_history.input_mint IS 'Input token mint address';
COMMENT ON COLUMN swap_history.output_mint IS 'Output token mint address';
COMMENT ON COLUMN swap_history.input_amount IS 'Input amount in smallest unit (stringified bigint)';
COMMENT ON COLUMN swap_history.output_amount IS 'Output amount received (stringified bigint, null until confirmed)';
COMMENT ON COLUMN swap_history.slippage_bps IS 'Slippage tolerance in basis points (e.g., 50 = 0.5%)';
COMMENT ON COLUMN swap_history.priority_fee_lamports IS 'Priority fee in lamports (stringified bigint)';
COMMENT ON COLUMN swap_history.jupiter_order_id IS 'Jupiter Ultra order ID for tracking';
COMMENT ON COLUMN swap_history.transaction_signature IS 'Solana transaction signature';
COMMENT ON COLUMN swap_history.status IS 'Current swap status: pending, simulated, confirmed, failed';
COMMENT ON COLUMN swap_history.simulation_result IS 'Result from transaction simulation (JSONB)';

COMMENT ON COLUMN token_balances_cache.balance IS 'Token balance in smallest unit (stringified bigint)';
COMMENT ON COLUMN token_balances_cache.decimals IS 'Token decimals for UI display';
COMMENT ON COLUMN token_balances_cache.usd_value IS 'Estimated USD value at last update';
COMMENT ON COLUMN token_balances_cache.last_updated_at IS 'Timestamp of last balance refresh';
