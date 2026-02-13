-- ozskr.ai Add 'processing' moderation status
-- Migration: 20260212000001_add_processing_moderation_status.sql
-- Created: 2026-02-12
-- Description: Add 'processing' to content_generations.moderation_status CHECK constraint
--              Required for atomic claim (pending → processing) in SSE generation flow

-- Drop the existing CHECK constraint
ALTER TABLE content_generations
  DROP CONSTRAINT content_generations_moderation_status_check;

-- Re-add with 'processing' included
ALTER TABLE content_generations
  ADD CONSTRAINT content_generations_moderation_status_check
  CHECK (moderation_status IN ('pending', 'processing', 'approved', 'flagged', 'rejected'));
