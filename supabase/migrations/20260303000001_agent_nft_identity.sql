-- ozskr.ai: Agent NFT Identity + Working Memory Migration
-- Adds ERC-8004-compatible on-chain identity fields to characters table
-- Adds working_memory_template for Mastra-native runtime memory

-- NFT Identity columns
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS nft_mint_address TEXT,
  ADD COLUMN IF NOT EXISTS nft_metadata_uri TEXT,
  ADD COLUMN IF NOT EXISTS registry_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS is_transferable BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS reputation_score DECIMAL(4,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS capabilities TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS transfer_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_transferred_at TIMESTAMPTZ;

-- Mastra runtime memory template (nullable, per-agent customization)
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS working_memory_template TEXT;

-- Deprecation comment for mem0_namespace (kept for backward compat, not used at runtime)
COMMENT ON COLUMN characters.mem0_namespace IS
  'DEPRECATED for runtime use. Retained for dev workflow compatibility only. Runtime agent memory now uses Mastra Memory with characters.id as resourceId.';

-- Indexes for NFT lookups
CREATE INDEX IF NOT EXISTS idx_characters_nft_mint ON characters(nft_mint_address) WHERE nft_mint_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_characters_registry_id ON characters(registry_agent_id) WHERE registry_agent_id IS NOT NULL;

-- Comments
COMMENT ON COLUMN characters.nft_mint_address IS 'Solana NFT mint address — null until user mints agent identity';
COMMENT ON COLUMN characters.registry_agent_id IS 'CAIP-2 format agent ID: solana:<genesis-hash>/<mint-address>';
COMMENT ON COLUMN characters.is_transferable IS 'Whether this agent NFT can be transferred to another wallet';
COMMENT ON COLUMN characters.reputation_score IS 'Platform reputation score 0.00-9.99, updated by platform activity';
COMMENT ON COLUMN characters.capabilities IS 'Array of declared capability strings (content-generation, social-publishing, etc)';
COMMENT ON COLUMN characters.working_memory_template IS 'XML template for Mastra Working Memory — null uses platform default';
