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
  getAssociatedTokenAddress,
} from '@/lib/solana/spl-delegation';

const DELEGATION_API = '/api/delegation';

/**
 * A single multi-agent delegation account record.
 */
export interface DelegationAccount {
  id: string;
  tokenMint: string;
  tokenAccountAddress: string;
  delegatePubkey: string;
  approvedAmount: string;
  remainingAmount: string;
  delegationStatus: 'active' | 'revoked' | 'depleted' | 'closed';
  version: number;
  reconciliationStatus: 'ok' | 'drift_detected' | 'unverified';
}

/**
 * Shape returned by the legacy top-level fields.
 */
interface LegacyDelegation {
  agentPubkey: string | null;
  delegationStatus: string | null;
  delegationAmount: string | null;
  delegationRemaining: string | null;
  delegationTokenMint: string | null;
  delegationTokenAccount: string | null;
  delegationTxSignature: string | null;
}

/**
 * Raw API response shape from GET /api/delegation/:characterId
 */
interface DelegationApiResponse {
  characterId: string;
  legacyDelegation: LegacyDelegation;
  delegationAccounts: DelegationAccount[];
}

interface DelegationStatus {
  characterId: string;
  agentPubkey: string | null;
  delegationStatus: 'none' | 'pending' | 'active' | 'revoked';
  delegationAmount: string | null;
  delegationRemaining: string | null;
  delegationTokenMint: string | null;
  delegationTokenAccount: string | null;
  delegationTxSignature: string | null;
  /** All multi-agent delegation accounts. */
  delegationAccounts: DelegationAccount[];
  /** ID of the most-recent active account (used for revoke). Null if none. */
  activeDelegationAccountId: string | null;
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
  delegationAccountId?: string;
}

/**
 * Transform the new multi-agent API response into the DelegationStatus shape.
 * The active delegation account takes precedence over legacy fields when present.
 */
function transformApiResponse(raw: DelegationApiResponse): DelegationStatus {
  const { characterId, legacyDelegation, delegationAccounts } = raw;

  // Find the most-recent active account (first in array, assuming API returns newest first)
  const activeAccount = delegationAccounts.find((a) => a.delegationStatus === 'active') ?? null;

  const delegationStatus: 'none' | 'pending' | 'active' | 'revoked' = activeAccount
    ? 'active'
    : (() => {
        const s = legacyDelegation.delegationStatus;
        if (s === 'active' || s === 'pending' || s === 'revoked') return s;
        return 'none';
      })();

  return {
    characterId,
    agentPubkey: legacyDelegation.agentPubkey,
    delegationStatus,
    delegationAmount: activeAccount ? activeAccount.approvedAmount : legacyDelegation.delegationAmount,
    delegationRemaining: activeAccount ? activeAccount.remainingAmount : legacyDelegation.delegationRemaining,
    delegationTokenMint: activeAccount ? activeAccount.tokenMint : legacyDelegation.delegationTokenMint,
    delegationTokenAccount: activeAccount
      ? activeAccount.tokenAccountAddress
      : legacyDelegation.delegationTokenAccount,
    delegationTxSignature: legacyDelegation.delegationTxSignature,
    delegationAccounts,
    activeDelegationAccountId: activeAccount ? activeAccount.id : null,
  };
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

      const raw: DelegationApiResponse = await response.json();
      return transformApiResponse(raw);
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
 * then registers the delegation account with the backend.
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

      // Fetch the agent's public key from the new API shape
      const statusResponse = await fetch(`${DELEGATION_API}/${characterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!statusResponse.ok) {
        throw new Error('Failed to fetch agent info');
      }

      const rawStatus: DelegationApiResponse = await statusResponse.json();
      const agentPubkey = rawStatus.legacyDelegation.agentPubkey;
      if (!agentPubkey) {
        throw new Error('Agent has no public key. Create the agent first.');
      }

      const delegatePubkey = new PublicKey(agentPubkey);
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

      // Derive the user's ATA for the token
      const tokenAccountAddress = getAssociatedTokenAddress(mintPubkey, publicKey).toBase58();

      // Register delegation account with the new backend endpoint
      const updateResponse = await fetch(`${DELEGATION_API}/${characterId}/create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenMint,
          tokenAccountAddress,
          delegatePubkey: agentPubkey,
          approvedAmount: amount.toString(),
          delegationTxSignature: signature,
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
 * then records the revocation with the backend.
 */
export function useRevokeDelegation() {
  const token = useAuthStore((state) => state.token);
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ characterId, tokenMint, delegationAccountId }: RevokeParams) => {
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

      // Only call backend if we have a delegation account ID to update
      if (delegationAccountId) {
        const updateResponse = await fetch(`${DELEGATION_API}/${characterId}/revoke`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            delegationAccountId,
            revocationTxSignature: signature,
          }),
        });

        if (!updateResponse.ok) {
          throw new Error('Delegation revoked on-chain but failed to update backend');
        }
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

interface AgentSpendParams {
  characterId: string;
  /** Recipient wallet address (NOT the ATA — ATA is derived automatically) */
  destinationOwner: string;
  /** Amount in base units (e.g. 100000 = 0.10 USDC) */
  amount: string;
  decimals: number;
  tokenMint: string;
}

interface AgentSpendResult {
  signature: string;
  amount: string;
  explorerUrl: string;
}

/**
 * Execute a delegated agent spend.
 * The agent signs the transaction server-side — no wallet popup.
 */
export function useAgentSpend() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      characterId,
      destinationOwner,
      amount,
      decimals,
      tokenMint,
    }: AgentSpendParams): Promise<AgentSpendResult> => {
      if (!token) throw new Error('Not authenticated');

      // Derive the destination ATA from the recipient's wallet address
      const mintPk = new PublicKey(tokenMint);
      const ownerPk = new PublicKey(destinationOwner);
      const destinationAta = getAssociatedTokenAddress(mintPk, ownerPk);

      const response = await fetch(
        `${DELEGATION_API}/${characterId}/transfer`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            destinationTokenAccount: destinationAta.toBase58(),
            destinationOwner,
            amount,
            decimals,
            tokenMint,
            method: 'demo_agent_spend',
          }),
        },
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Agent spend failed');
      }

      const result = await response.json();

      const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
      const clusterParam = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
      const explorerUrl = `https://explorer.solana.com/tx/${result.signature}${clusterParam}`;

      return {
        signature: result.signature,
        amount: result.amount,
        explorerUrl,
      };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['delegation', variables.characterId],
      });
      queryClient.invalidateQueries({
        queryKey: ['delegation-transactions', variables.characterId],
      });
    },
  });
}
