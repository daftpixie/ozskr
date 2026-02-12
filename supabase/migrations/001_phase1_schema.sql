-- ozskr.ai Phase 1 Foundation Schema
-- Migration: 001_phase1_schema.sql
-- Created: 2026-02-11
-- Description: Core tables for users, sessions, characters, agent runs, and content

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLES
-- =============================================================================

-- Users table
CREATE TABLE users (
  wallet_address TEXT PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  jwt_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Characters table
CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
  name TEXT NOT NULL,
  persona TEXT NOT NULL,
  visual_style TEXT NOT NULL,
  voice_tone TEXT NOT NULL,
  guardrails TEXT[] NOT NULL DEFAULT '{}',
  topic_affinity TEXT[] NOT NULL DEFAULT '{}',
  mem0_namespace TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent runs table
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL CHECK (run_type IN ('content_generation', 'engagement', 'analysis', 'trading')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Content table
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('tweet', 'thread', 'image', 'video', 'meme')),
  prompt_used TEXT NOT NULL,
  output_text TEXT,
  output_url TEXT,
  quality_score REAL CHECK (quality_score >= 0 AND quality_score <= 1),
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Sessions indexes
CREATE INDEX idx_sessions_wallet_address ON sessions(wallet_address);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Characters indexes
CREATE INDEX idx_characters_wallet_address ON characters(wallet_address);
CREATE INDEX idx_characters_status ON characters(status);
CREATE INDEX idx_characters_mem0_namespace ON characters(mem0_namespace);

-- Agent runs indexes
CREATE INDEX idx_agent_runs_character_id ON agent_runs(character_id);
CREATE INDEX idx_agent_runs_run_type ON agent_runs(run_type);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);
CREATE INDEX idx_agent_runs_created_at ON agent_runs(created_at DESC);

-- Content indexes
CREATE INDEX idx_content_character_id ON content(character_id);
CREATE INDEX idx_content_content_type ON content(content_type);
CREATE INDEX idx_content_moderation_status ON content(moderation_status);
CREATE INDEX idx_content_created_at ON content(created_at DESC);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_characters_updated_at
  BEFORE UPDATE ON characters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_runs_updated_at
  BEFORE UPDATE ON agent_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read their own row"
  ON users FOR SELECT
  USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Users can update their own row"
  ON users FOR UPDATE
  USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Users can insert their own row"
  ON users FOR INSERT
  WITH CHECK (wallet_address = (auth.jwt() ->> 'wallet_address'));

-- Sessions policies
CREATE POLICY "Users can read their own sessions"
  ON sessions FOR SELECT
  USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Users can insert their own sessions"
  ON sessions FOR INSERT
  WITH CHECK (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Users can delete their own sessions"
  ON sessions FOR DELETE
  USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

-- Characters policies
CREATE POLICY "Users can read their own characters"
  ON characters FOR SELECT
  USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Users can insert their own characters"
  ON characters FOR INSERT
  WITH CHECK (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Users can update their own characters"
  ON characters FOR UPDATE
  USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Users can delete their own characters"
  ON characters FOR DELETE
  USING (wallet_address = (auth.jwt() ->> 'wallet_address'));

-- Agent runs policies
CREATE POLICY "Users can read runs for their characters"
  ON agent_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = agent_runs.character_id
      AND characters.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "Users can create runs for their characters"
  ON agent_runs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = agent_runs.character_id
      AND characters.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

-- Content policies
CREATE POLICY "Users can read content for their characters"
  ON content FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = content.character_id
      AND characters.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "Users can create content for their characters"
  ON content FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = content.character_id
      AND characters.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

-- Service role policies (for background jobs like Trigger.dev)
CREATE POLICY "Service role can manage all characters"
  ON characters FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all agent runs"
  ON agent_runs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all content"
  ON content FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE users IS 'User accounts linked to Solana wallet addresses';
COMMENT ON TABLE sessions IS 'JWT session records for authentication';
COMMENT ON TABLE characters IS 'AI agent characters/personas created by users';
COMMENT ON TABLE agent_runs IS 'Execution history of agent tasks';
COMMENT ON TABLE content IS 'Generated content (tweets, images, videos) by agents';

COMMENT ON COLUMN users.wallet_address IS 'Solana wallet address (base58 encoded)';
COMMENT ON COLUMN characters.mem0_namespace IS 'Unique namespace for Mem0 AI memory isolation';
COMMENT ON COLUMN content.quality_score IS 'Normalized quality score (0-1) from AI evaluation';
COMMENT ON COLUMN content.moderation_status IS 'Content moderation pipeline status';
