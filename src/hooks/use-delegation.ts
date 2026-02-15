'use client';

/**
 * React hooks for SPL token delegation management.
 * Handles delegation status fetching, approval, and revocation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useAuthStore } from '@/features/wallet/store';
import {
  buildApproveCheckedTransaction,
  buildRevokeTransaction,
} from '@/lib/solana/spl-delegation';

const DELEGATION_API = '/api/delegation';

interface DelegationStatus {
  characterId: string;
  agentPubkey: string | null;
  delegationStatus: 'none' | 'pending' | 'active' | 'revoked';
  delegationAmount: string | null;
  delegationRemaining: string | null;
  delegationTokenMint: string | null;
  delegationTokenAccount: string | null;
  delegationTxSignature: string | null;
}

interface AgentTransaction {
  id: string;
  txSignature: string;
  amount: string;
  tokenMint: string;
  recipient: string;
  url: string | null;
  method: string;
  status: string;
  createdAt: string;
}

interface ApproveParams {
  characterId: string;
  tokenMint: string;
  amount: bigint;
  decimals: number;
}

interface RevokeParams {
  characterId: string;
  tokenMint: string;
}

/**
 * Fetch delegation status for a character's agent.
 */
export function useDelegation(characterId: string | undefined) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['delegation', characterId],
    queryFn: async (): Promise<DelegationStatus> => {
      if (!characterId) throw new Error('Character ID required');

      const response = await fetch(`${DELEGATION_API}/${characterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch delegation status');
      }

      return response.json();
    },
    enabled: !!token && !!characterId,
    staleTime: 30_000,
  });
}

/**
 * Fetch agent transaction history for a character.
 */
export function useDelegationTransactions(characterId: string | undefined) {
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: ['delegation-transactions', characterId],
    queryFn: async (): Promise<{ transactions: AgentTransaction[] }> => {
      if (!characterId) throw new Error('Character ID required');

      const response = await fetch(
        `${DELEGATION_API}/${characterId}/transactions`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch transactions');
      }

      return response.json();
    },
    enabled: !!token && !!characterId,
    staleTime: 30_000,
  });
}

/**
 * Approve SPL token delegation to an agent.
 * Builds the ApproveChecked transaction, sends via wallet adapter,
 * then updates the backend with the confirmed status.
 */
export function useApproveDelegation() {
  const token = useAuthStore((state) => state.token);
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ characterId, tokenMint, amount, decimals }: ApproveParams) => {
      if (!publicKey) throw new Error('Wallet not connected');
      if (!token) throw new Error('Not authenticated');

      // First, fetch the agent's public key
      const statusResponse = await fetch(`${DELEGATION_API}/${characterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!statusResponse.ok) {
        throw new Error('Failed to fetch agent info');
      }

      const status: DelegationStatus = await statusResponse.json();
      if (!status.agentPubkey) {
        throw new Error('Agent has no public key. Create the agent first.');
      }

      const delegatePubkey = new PublicKey(status.agentPubkey);
      const mintPubkey = new PublicKey(tokenMint);

      // Build the ApproveChecked transaction
      const transaction = await buildApproveCheckedTransaction(
        connection,
        publicKey,
        delegatePubkey,
        mintPubkey,
        amount,
        decimals,
      );

      // Send via wallet adapter (Phantom popup)
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });

      // Update backend with delegation status
      const updateResponse = await fetch(`${DELEGATION_API}/${characterId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'active',
          amount: amount.toString(),
          remaining: amount.toString(),
          tokenMint,
          txSignature: signature,
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Delegation approved on-chain but failed to update backend');
      }

      return { signature, amount: amount.toString() };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['delegation', variables.characterId],
      });
      queryClient.invalidateQueries({
        queryKey: ['character', variables.characterId],
      });
    },
  });
}

/**
 * Revoke SPL token delegation from an agent.
 * Builds the Revoke transaction, sends via wallet adapter,
 * then updates the backend.
 */
export function useRevokeDelegation() {
  const token = useAuthStore((state) => state.token);
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ characterId, tokenMint }: RevokeParams) => {
      if (!publicKey) throw new Error('Wallet not connected');
      if (!token) throw new Error('Not authenticated');

      const mintPubkey = new PublicKey(tokenMint);

      // Build the Revoke transaction
      const transaction = await buildRevokeTransaction(
        connection,
        publicKey,
        mintPubkey,
      );

      // Send via wallet adapter (Phantom popup)
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });

      // Update backend
      const updateResponse = await fetch(`${DELEGATION_API}/${characterId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'revoked',
          txSignature: signature,
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Delegation revoked on-chain but failed to update backend');
      }

      return { signature };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['delegation', variables.characterId],
      });
      queryClient.invalidateQueries({
        queryKey: ['character', variables.characterId],
      });
    },
  });
}
