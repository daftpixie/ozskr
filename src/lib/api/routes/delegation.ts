/**
 * Delegation Routes
 * Agent delegation management (approve/revoke status tracking + transfer execution)
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { createAuthenticatedClient } from '../supabase';
import { UuidSchema, WalletAddressSchema } from '@/types/schemas';
import { logger } from '@/lib/utils/logger';

type DelegationEnv = {
  Variables: {
    walletAddress: string;
    jwtToken: string;
  };
};

const delegation = new Hono<DelegationEnv>();

delegation.use('/*', authMiddleware);

function getAuthContext(c: { get: (key: string) => unknown }) {
  const walletAddress = c.get('walletAddress');
  const jwtToken = c.get('jwtToken');
  if (typeof walletAddress !== 'string' || typeof jwtToken !== 'string') return null;
  return { walletAddress, jwtToken };
}

/**
 * GET /api/delegation/:characterId
 * Get delegation status for a character's agent
 */
delegation.get('/:characterId', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);

  const characterId = c.req.param('characterId');
  const validation = UuidSchema.safeParse(characterId);
  if (!validation.success) {
    return c.json({ error: 'Invalid character ID', code: 'VALIDATION_ERROR' }, 400);
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);
    const { data: character, error } = await supabase
      .from('characters')
      .select('id, agent_pubkey, delegation_status, delegation_amount, delegation_remaining, delegation_token_mint, delegation_token_account, delegation_tx_signature')
      .eq('id', characterId)
      .eq('wallet_address', auth.walletAddress)
      .single();

    if (error || !character) {
      return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
    }

    return c.json({
      characterId: character.id,
      agentPubkey: character.agent_pubkey,
      delegationStatus: character.delegation_status || 'none',
      delegationAmount: character.delegation_amount,
      delegationRemaining: character.delegation_remaining,
      delegationTokenMint: character.delegation_token_mint,
      delegationTokenAccount: character.delegation_token_account,
      delegationTxSignature: character.delegation_tx_signature,
    }, 200);
  } catch {
    return c.json({ error: 'Failed to fetch delegation status', code: 'INTERNAL_ERROR' }, 500);
  }
});

const DelegationUpdateSchema = z.object({
  status: z.enum(['pending', 'active', 'revoked']),
  amount: z.string().optional(),
  remaining: z.string().optional(),
  tokenMint: z.string().optional(),
  tokenAccount: z.string().optional(),
  txSignature: z.string().optional(),
});

/**
 * POST /api/delegation/:characterId
 * Update delegation status after Phantom transaction confirms.
 * Called by the client after the user approves/revokes in Phantom.
 */
delegation.post(
  '/:characterId',
  zValidator('json', DelegationUpdateSchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);

    const characterId = c.req.param('characterId');
    const validation = UuidSchema.safeParse(characterId);
    if (!validation.success) {
      return c.json({ error: 'Invalid character ID', code: 'VALIDATION_ERROR' }, 400);
    }

    const input = c.req.valid('json');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Verify ownership
      const { data: existing, error: verifyError } = await supabase
        .from('characters')
        .select('id')
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (verifyError || !existing) {
        return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
      }

      const updateData: Record<string, unknown> = {
        delegation_status: input.status,
      };
      if (input.amount !== undefined) updateData.delegation_amount = input.amount;
      if (input.remaining !== undefined) updateData.delegation_remaining = input.remaining;
      if (input.tokenMint !== undefined) updateData.delegation_token_mint = input.tokenMint;
      if (input.tokenAccount !== undefined) updateData.delegation_token_account = input.tokenAccount;
      if (input.txSignature !== undefined) updateData.delegation_tx_signature = input.txSignature;

      // On revocation, clear delegation fields
      if (input.status === 'revoked') {
        updateData.delegation_remaining = null;
      }

      const { error: updateError } = await supabase
        .from('characters')
        .update(updateData)
        .eq('id', characterId);

      if (updateError) {
        return c.json({ error: 'Failed to update delegation', code: 'DATABASE_ERROR' }, 500);
      }

      return c.json({ success: true, status: input.status }, 200);
    } catch {
      return c.json({ error: 'Failed to update delegation', code: 'INTERNAL_ERROR' }, 500);
    }
  }
);

/**
 * GET /api/delegation/:characterId/transactions
 * Get agent transaction history
 */
delegation.get('/:characterId/transactions', async (c) => {
  const auth = getAuthContext(c);
  if (!auth) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);

  const characterId = c.req.param('characterId');
  const validation = UuidSchema.safeParse(characterId);
  if (!validation.success) {
    return c.json({ error: 'Invalid character ID', code: 'VALIDATION_ERROR' }, 400);
  }

  try {
    const supabase = createAuthenticatedClient(auth.jwtToken);

    // Verify ownership
    const { data: character, error: verifyError } = await supabase
      .from('characters')
      .select('id')
      .eq('id', characterId)
      .eq('wallet_address', auth.walletAddress)
      .single();

    if (verifyError || !character) {
      return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
    }

    const { data: transactions, error } = await supabase
      .from('agent_transactions')
      .select('*')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return c.json({ error: 'Failed to fetch transactions', code: 'DATABASE_ERROR' }, 500);
    }

    return c.json({
      transactions: (transactions || []).map((tx) => ({
        id: tx.id,
        txSignature: tx.tx_signature,
        amount: tx.amount,
        tokenMint: tx.token_mint,
        recipient: tx.recipient,
        url: tx.url,
        method: tx.method,
        status: tx.status,
        createdAt: tx.created_at,
      })),
    }, 200);
  } catch {
    return c.json({ error: 'Failed to fetch transactions', code: 'INTERNAL_ERROR' }, 500);
  }
});

const TransferSchema = z.object({
  destinationTokenAccount: WalletAddressSchema,
  destinationOwner: WalletAddressSchema.optional(),
  amount: z.string().regex(/^\d+$/, 'Amount must be a positive integer string'),
  decimals: z.number().int().min(0).max(18),
  tokenMint: WalletAddressSchema,
  url: z.string().url().optional(),
  method: z.string().max(50).optional(),
});

/**
 * POST /api/delegation/:characterId/transfer
 * Execute a delegated transfer from the agent.
 * The agent signs the transaction server-side using its encrypted keypair.
 */
delegation.post(
  '/:characterId/transfer',
  zValidator('json', TransferSchema),
  async (c) => {
    const auth = getAuthContext(c);
    if (!auth) return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);

    const characterId = c.req.param('characterId');
    const validation = UuidSchema.safeParse(characterId);
    if (!validation.success) {
      return c.json({ error: 'Invalid character ID', code: 'VALIDATION_ERROR' }, 400);
    }

    const input = c.req.valid('json');

    try {
      const supabase = createAuthenticatedClient(auth.jwtToken);

      // Verify ownership + get delegation info
      const { data: character, error: verifyError } = await supabase
        .from('characters')
        .select('id, agent_pubkey, delegation_status, delegation_token_mint, delegation_token_account, delegation_remaining, wallet_address')
        .eq('id', characterId)
        .eq('wallet_address', auth.walletAddress)
        .single();

      if (verifyError || !character) {
        return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404);
      }

      if (character.delegation_status !== 'active') {
        return c.json({ error: 'No active delegation', code: 'DELEGATION_INACTIVE' }, 400);
      }

      if (!character.agent_pubkey) {
        return c.json({ error: 'Agent has no keypair', code: 'NO_AGENT_KEY' }, 400);
      }

      // Execute the transfer via agent's keypair
      const { executeAgentTransfer } = await import('@/lib/agent-wallet/transfer');
      const result = await executeAgentTransfer({
        characterId,
        ownerAddress: character.wallet_address,
        destinationTokenAccount: input.destinationTokenAccount,
        destinationOwner: input.destinationOwner,
        amount: BigInt(input.amount),
        decimals: input.decimals,
        tokenMint: input.tokenMint,
      });

      // Record the transaction
      await supabase.from('agent_transactions').insert({
        character_id: characterId,
        tx_signature: result.signature,
        amount: input.amount,
        token_mint: input.tokenMint,
        recipient: input.destinationTokenAccount,
        url: input.url || null,
        method: input.method || 'delegation_transfer',
        status: 'confirmed',
      });

      // Update delegation_remaining (optimistic: subtract spent amount)
      const currentRemaining = character.delegation_remaining
        ? BigInt(character.delegation_remaining)
        : null;
      if (currentRemaining !== null) {
        const spent = BigInt(input.amount);
        const newRemaining = currentRemaining > spent ? currentRemaining - spent : 0n;
        await supabase
          .from('characters')
          .update({ delegation_remaining: newRemaining.toString() })
          .eq('id', characterId);
      }

      logger.info('Agent transfer executed', {
        characterId,
        signature: result.signature,
        amount: input.amount,
        tokenMint: input.tokenMint,
      });

      return c.json({
        success: true,
        signature: result.signature,
        amount: result.amount,
      }, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transfer failed';
      logger.error('Agent transfer failed', {
        characterId,
        error: message,
      });
      return c.json({ error: message, code: 'TRANSFER_FAILED' }, 500);
    }
  }
);

export { delegation };
