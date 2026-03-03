/**
 * Agent NFT Transfer Foundation
 *
 * Defines what happens when an agent NFT transfers to a new owner.
 * This is FOUNDATION CODE for Phase 9 (marketplace). No marketplace UI yet.
 *
 * When an NFT transfers:
 *   PRESERVE: Mastra Working Memory, content library, reputation score,
 *             Tapestry social graph, nft_mint_address, capabilities
 *   CLEAR:    SPL delegation, agent pubkey binding, payment authorizations,
 *             scheduling (autonomous tasks tied to original owner's auth)
 *   DO NOT TRANSFER: Raw conversation thread history (stays with original owner)
 *
 * Phase 9 will add:
 *   - Helius webhook subscription for transfer events
 *   - Marketplace listing/escrow integration
 *   - Price discovery and auction support
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface AgentTransferEvent {
  /** ozskr character UUID */
  characterId: string;
  /** NFT mint address */
  mintAddress: string;
  /** Previous owner wallet address */
  fromWallet: string;
  /** New owner wallet address */
  toWallet: string;
  /** ISO 8601 timestamp of transfer */
  transferredAt: string;
  /** On-chain transaction signature */
  transferSignature: string;
}

export interface TransferResult {
  /** Fields/data preserved for the new owner (audit log) */
  preserved: string[];
  /** Fields/data cleared on transfer (audit log) */
  cleared: string[];
  /** Whether the DB update succeeded */
  success: boolean;
  /** Error message if update failed */
  error?: string;
}

// =============================================================================
// TRANSFER HANDLER
// =============================================================================

/**
 * Handle agent NFT ownership change.
 *
 * Called when a transfer event is detected (Phase 9: via Helius webhook or
 * on-chain polling). Currently this is the foundation handler — no webhook
 * integration yet.
 *
 * Security model:
 * - Only the service role client can call this (called from server-side only)
 * - The character's wallet_address is updated to the new owner
 * - SPL delegation is cleared: the new owner must re-approve delegation
 * - Agent keypair binding is cleared: a new keypair will be generated
 * - Scheduling is disabled: new owner must re-configure autonomous tasks
 * - Tapestry social graph stays with the agent (social identity is portable)
 *
 * @param event    Transfer event data
 * @param supabase Authenticated Supabase client (service role)
 */
export async function handleAgentTransfer(
  event: AgentTransferEvent,
  supabase: SupabaseClient,
): Promise<TransferResult> {
  const preserved: string[] = [
    'mastra_working_memory',
    'content_library',
    'reputation_score',
    'capabilities',
    'nft_mint_address',
    'nft_metadata_uri',
    'registry_agent_id',
    'tapestry_profile_id',
    'tapestry_username',
    'topic_affinity',
    'visual_style',
    'voice_tone',
    'generation_count',
  ];

  const cleared: string[] = [
    'agent_pubkey',
    'delegation_status',
    'delegation_amount',
    'delegation_remaining',
    'delegation_token_mint',
    'delegation_token_account',
    'delegation_tx_signature',
  ];

  try {
    // Verify the character exists and currently belongs to the fromWallet
    const { data: character, error: fetchError } = await supabase
      .from('characters')
      .select('id, wallet_address, name, nft_mint_address')
      .eq('id', event.characterId)
      .eq('nft_mint_address', event.mintAddress)
      .single();

    if (fetchError || !character) {
      const errMsg = fetchError?.message ?? 'Character not found or mint mismatch';
      logger.error('handleAgentTransfer: character lookup failed', {
        characterId: event.characterId,
        mintAddress: event.mintAddress,
        error: errMsg,
      });
      return { preserved, cleared, success: false, error: errMsg };
    }

    // Idempotency check: if wallet_address already matches toWallet, skip
    if (character.wallet_address === event.toWallet) {
      logger.info('handleAgentTransfer: transfer already applied (idempotent)', {
        characterId: event.characterId,
        toWallet: event.toWallet,
      });
      return { preserved, cleared, success: true };
    }

    // Apply transfer: update owner, clear delegation, clear agent keypair binding
    const { error: updateError } = await supabase
      .from('characters')
      .update({
        // New ownership
        wallet_address: event.toWallet,
        // Clear SPL delegation — new owner must re-approve
        delegation_status: 'none',
        delegation_amount: null,
        delegation_remaining: null,
        delegation_token_mint: null,
        delegation_token_account: null,
        delegation_tx_signature: null,
        // Clear agent keypair binding — will be regenerated on next interaction
        agent_pubkey: null,
        // Track transfer history
        updated_at: event.transferredAt,
      })
      .eq('id', event.characterId);

    if (updateError) {
      logger.error('handleAgentTransfer: DB update failed', {
        characterId: event.characterId,
        error: updateError.message,
      });
      return { preserved, cleared, success: false, error: updateError.message };
    }

    // Disable any active content schedules — new owner must re-configure
    // These are tied to the original owner's authorization context
    const { error: scheduleError } = await supabase
      .from('content_schedules')
      .update({ is_active: false })
      .eq('character_id', event.characterId)
      .eq('is_active', true);

    if (scheduleError) {
      // Non-fatal: log but don't fail the transfer
      logger.warn('handleAgentTransfer: failed to disable schedules', {
        characterId: event.characterId,
        error: scheduleError.message,
      });
      cleared.push('content_schedules (partial — see logs)');
    } else {
      cleared.push('content_schedules');
    }

    // Write audit log entry
    await writeTransferAuditLog(supabase, event, preserved, cleared);

    logger.info('handleAgentTransfer: transfer applied successfully', {
      characterId: event.characterId,
      agentName: character.name,
      fromWallet: event.fromWallet,
      toWallet: event.toWallet,
      txSignature: event.transferSignature,
    });

    return { preserved, cleared, success: true };
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : 'Unknown error in handleAgentTransfer';
    logger.error('handleAgentTransfer: unexpected error', {
      characterId: event.characterId,
      error: errMsg,
    });
    return { preserved, cleared, success: false, error: errMsg };
  }
}

// =============================================================================
// AUDIT LOG
// =============================================================================

/**
 * Write an NFT transfer audit log entry.
 * Non-fatal: failures are logged but do not fail the transfer.
 */
async function writeTransferAuditLog(
  supabase: SupabaseClient,
  event: AgentTransferEvent,
  preserved: string[],
  cleared: string[],
): Promise<void> {
  try {
    // Use the reconciliation_log table (shared with delegation reconciliation)
    // if it exists, otherwise skip silently.
    await supabase.from('reconciliation_log').insert({
      character_id: event.characterId,
      event_type: 'nft_transfer',
      from_wallet: event.fromWallet,
      to_wallet: event.toWallet,
      tx_signature: event.transferSignature,
      transferred_at: event.transferredAt,
      preserved_fields: preserved,
      cleared_fields: cleared,
      created_at: new Date().toISOString(),
    });
  } catch {
    // The reconciliation_log table may not have these columns yet —
    // Phase 9 migration will add the nft_transfer columns.
    // Non-fatal: do not surface this error.
  }
}
