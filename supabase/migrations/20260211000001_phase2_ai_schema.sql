-- ozskr.ai Phase 2 AI Schema Extension
-- Migration: 20260211000001_phase2_ai_schema.sql
-- Created: 2026-02-11
-- Description: Extend characters table and add content_generations, character_memory tables

-- =============================================================================
-- EXTEND EXISTING TABLES
-- =============================================================================

-- Add new columns to characters table for Phase 2
ALTER TABLE characters
  ADD COLUMN visual_style_params JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN social_accounts JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN generation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN last_generated_at TIMESTAMPTZ;

-- Add comments for new columns
COMMENT ON COLUMN characters.visual_style_params IS 'JSONB structure for visual generation parameters (style, color palette, composition)';
COMMENT ON COLUMN characters.social_accounts IS 'JSONB structure for connected social media accounts';
COMMENT ON COLUMN characters.generation_count IS 'Total number of content generations for this character';
COMMENT ON COLUMN characters.last_generated_at IS 'Timestamp of most recent content generation';

-- =============================================================================
-- NEW TABLES
-- =============================================================================

-- Content generations table (AI model invocations and outputs)
CREATE TABLE content_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  generation_type TEXT NOT NULL CHECK (generation_type IN ('text', 'image', 'video')),
  input_prompt TEXT NOT NULL,
  enhanced_prompt TEXT,
  model_used TEXT NOT NULL,
  model_params JSONB DEFAULT '{}'::jsonb,
  output_url TEXT,
  output_text TEXT,
  quality_score DOUBLE PRECISION,
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'rejected')),
  moderation_details JSONB,
  token_usage JSONB DEFAULT '{}'::jsonb,
  cost_usd DECIMAL(10,6),
  latency_ms INTEGER,
  cache_hit BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Character memory table (Mem0 namespace tracking)
CREATE TABLE character_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  mem0_namespace TEXT NOT NULL UNIQUE,
  memory_count INTEGER NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  total_retrievals INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Content generations indexes
CREATE INDEX idx_content_generations_character_id ON content_generations(character_id);
CREATE INDEX idx_content_generations_generation_type ON content_generations(generation_type);
CREATE INDEX idx_content_generations_moderation_status ON content_generations(moderation_status);
CREATE INDEX idx_content_generations_created_at ON content_generations(created_at DESC);

-- Character memory indexes
CREATE INDEX idx_character_memory_character_id ON character_memory(character_id);
CREATE INDEX idx_character_memory_mem0_namespace ON character_memory(mem0_namespace);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at for character_memory
CREATE TRIGGER update_character_memory_updated_at
  BEFORE UPDATE ON character_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE content_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_memory ENABLE ROW LEVEL SECURITY;

-- Content generations policies (access via character ownership)
CREATE POLICY "Users can read generations for their characters"
  ON content_generations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = content_generations.character_id
      AND characters.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "Users can create generations for their characters"
  ON content_generations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = content_generations.character_id
      AND characters.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "Users can update generations for their characters"
  ON content_generations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = content_generations.character_id
      AND characters.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

-- Character memory policies (access via character ownership)
CREATE POLICY "Users can read memory for their characters"
  ON character_memory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = character_memory.character_id
      AND characters.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "Users can create memory for their characters"
  ON character_memory FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = character_memory.character_id
      AND characters.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "Users can update memory for their characters"
  ON character_memory FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM characters
      WHERE characters.id = character_memory.character_id
      AND characters.wallet_address = (auth.jwt() ->> 'wallet_address')
    )
  );

-- Service role policies for background jobs (Trigger.dev)
CREATE POLICY "Service role can manage all content generations"
  ON content_generations FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all character memory"
  ON character_memory FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE content_generations IS 'AI content generation records with model metadata and moderation status';
COMMENT ON TABLE character_memory IS 'Mem0 namespace tracking and memory retrieval statistics';

COMMENT ON COLUMN content_generations.generation_type IS 'Type of content generated: text, image, or video';
COMMENT ON COLUMN content_generations.input_prompt IS 'Original user-provided or system-generated prompt';
COMMENT ON COLUMN content_generations.enhanced_prompt IS 'Prompt after enhancement/expansion by AI';
COMMENT ON COLUMN content_generations.model_used IS 'AI model identifier (e.g., claude-opus-4-6, fal-ai/flux-lora)';
COMMENT ON COLUMN content_generations.model_params IS 'JSONB structure with generation parameters (temperature, max_tokens, etc.)';
COMMENT ON COLUMN content_generations.token_usage IS 'JSONB structure: {input, output, cached} token counts';
COMMENT ON COLUMN content_generations.cost_usd IS 'Estimated cost in USD for this generation';
COMMENT ON COLUMN content_generations.latency_ms IS 'Generation latency in milliseconds';
COMMENT ON COLUMN content_generations.cache_hit IS 'Whether prompt cache was used (Claude prompt caching)';
COMMENT ON COLUMN character_memory.mem0_namespace IS 'Unique Mem0 namespace for character memory isolation';
COMMENT ON COLUMN character_memory.memory_count IS 'Total number of memories stored in Mem0';
COMMENT ON COLUMN character_memory.total_retrievals IS 'Total number of memory retrieval operations';
