-- Migration: Agent NFT Identity
-- Adds ERC-8004-compatible NFT identity fields to the characters table.
-- Phase 7.M: WP-C Agent NFT Identity + Solana Agent Registry
--
-- New columns:
--   nft_mint_address   — SPL token mint address (base58, null until minted)
--   nft_metadata_uri   — R2 URL for Metaplex-standard metadata JSON
--   registry_agent_id  — CAIP-2 agent ID: "solana:<genesis>/<mint-address>"
--   registry_url       — R2 URL for ERC-8004 registration file
--
-- Each is nullable — agents work fully without minting an NFT.
-- NFT is optional and adds on-chain identity/tradability (Phase 9 marketplace).

-- Add NFT identity columns to characters table
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS nft_mint_address TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nft_metadata_uri TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS registry_agent_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS registry_url TEXT DEFAULT NULL;

-- Unique constraint: each mint address can only be associated with one agent
-- This prevents a mint address from being claimed by multiple characters.
ALTER TABLE public.characters
  ADD CONSTRAINT characters_nft_mint_address_unique
    UNIQUE (nft_mint_address);

-- Index for registry lookups by CAIP-2 agent ID
CREATE INDEX IF NOT EXISTS idx_characters_registry_agent_id
  ON public.characters (registry_agent_id)
  WHERE registry_agent_id IS NOT NULL;

-- Index for mint address lookups
CREATE INDEX IF NOT EXISTS idx_characters_nft_mint_address
  ON public.characters (nft_mint_address)
  WHERE nft_mint_address IS NOT NULL;

-- Comment columns for documentation
COMMENT ON COLUMN public.characters.nft_mint_address IS
  'SPL token mint address for agent identity NFT. Null until minted. Supply is permanently 1.';

COMMENT ON COLUMN public.characters.nft_metadata_uri IS
  'Cloudflare R2 URL for Metaplex-standard NFT metadata JSON.';

COMMENT ON COLUMN public.characters.registry_agent_id IS
  'CAIP-2 agent identity: "solana:<genesis-hash>/<mint-address>". Used for Solana Agent Registry.';

COMMENT ON COLUMN public.characters.registry_url IS
  'Cloudflare R2 URL for ERC-8004-compatible agent registration file (agents/<id>/registry.json).';
