-- ---------------------------------------------------------------------------
-- Migration: agent_service_usage
-- Records every AI service request for billing reconciliation and audit.
-- Identity model: wallet_address (not Supabase auth.uid).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_service_usage (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id         UUID        NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  wallet_address       TEXT        NOT NULL,

  -- Content category and model selection
  category             TEXT        NOT NULL
    CHECK (category IN ('text', 'image', 'image-text', 'video', 'video-text')),
  prompt               TEXT,
  text_model           TEXT,
  image_model          TEXT,
  video_model          TEXT,

  -- Cost fields (USD, 6 decimal places)
  base_cost_usd        NUMERIC(10, 6) NOT NULL,
  markup_percent       NUMERIC(5, 2)  NOT NULL DEFAULT 20.00,
  platform_cost_usd    NUMERIC(10, 6) NOT NULL,

  -- Payment tracking
  tx_hash              TEXT,
  payer_address        TEXT        NOT NULL,
  payment_status       TEXT        NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'verified', 'failed', 'bypassed')),

  -- Provider request IDs for cross-reference and debugging
  fal_request_id       TEXT,
  anthropic_request_id TEXT,
  token_usage_input    INTEGER,
  token_usage_output   INTEGER,

  -- Generation result
  result_status        TEXT        NOT NULL DEFAULT 'pending'
    CHECK (result_status IN ('pending', 'generating', 'moderating', 'complete', 'failed', 'rejected')),
  result_media_urls    TEXT[],
  result_text          TEXT,
  moderation_passed    BOOLEAN,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at         TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE agent_service_usage ENABLE ROW LEVEL SECURITY;

-- Users can view usage records that belong to characters they own.
-- Ownership is resolved via the sessions table (JWT token stored there).
CREATE POLICY "Users can view own agent usage"
  ON agent_service_usage FOR SELECT
  USING (
    character_id IN (
      SELECT id FROM characters WHERE wallet_address = (
        SELECT wallet_address FROM sessions WHERE jwt_token = current_setting('request.jwt', true)
      )
    )
  );

-- Background jobs (Trigger.dev via service role) can insert new records.
CREATE POLICY "Service role can insert"
  ON agent_service_usage FOR INSERT
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_agent_service_usage_character
  ON agent_service_usage(character_id);

CREATE INDEX IF NOT EXISTS idx_agent_service_usage_wallet
  ON agent_service_usage(wallet_address);

CREATE INDEX IF NOT EXISTS idx_agent_service_usage_created
  ON agent_service_usage(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_service_usage_tx
  ON agent_service_usage(tx_hash)
  WHERE tx_hash IS NOT NULL;
