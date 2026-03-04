'use client';

/**
 * useAgentNFT — hooks for NFT identity minting and registry
 *
 * The mint flow has three steps:
 * 1. POST /characters/:id/mint-nft  → receive unsigned transactionBase64 + mintAddress + metadataUri
 * 2. Decode the transaction, sign via wallet-adapter, submit to chain
 * 3. POST /characters/:id/confirm-mint with the on-chain signature
 *
 * Uses @solana/web3.js Transaction.from() because wallet-adapter requires
 * the legacy web3.js Transaction type for signTransaction / sendRawTransaction.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
// web3.js legacy Transaction — required by wallet-adapter signing interface
import { Transaction } from '@solana/web3.js';
import { useAuthStore } from '@/features/wallet/store';

const API_BASE = '/api/ai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MintNFTResult {
  mintAddress: string;
  metadataUri: string;
  transactionSignature: string;
}

export interface AgentRegistryFile {
  agentId: string;
  mintAddress: string;
  metadataUri: string;
  registeredAt: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// useMintAgentNFT
// ---------------------------------------------------------------------------

/**
 * Initiate NFT mint for an agent character.
 *
 * On success, invalidates the ['character', characterId] query so the hero
 * section re-fetches and the MintIdentityCard unmounts.
 */
export function useMintAgentNFT(characterId: string) {
  const { signTransaction } = useWallet();
  const { connection } = useConnection();
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation<MintNFTResult, Error>({
    mutationFn: async () => {
      if (!token) throw new Error('Not authenticated');
      if (!signTransaction) throw new Error('Wallet not connected or does not support signing');

      // Step 1 — ask the server to prepare an unsigned mint transaction
      const prepareRes = await fetch(`${API_BASE}/characters/${characterId}/mint-nft`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!prepareRes.ok) {
        const errBody: unknown = await prepareRes.json();
        const errMsg =
          typeof errBody === 'object' && errBody !== null && 'error' in errBody
            ? String((errBody as Record<string, unknown>).error)
            : 'Failed to prepare mint transaction';
        throw new Error(errMsg);
      }

      const prepareBody: unknown = await prepareRes.json();
      if (
        typeof prepareBody !== 'object' ||
        prepareBody === null ||
        !('transactionBase64' in prepareBody) ||
        !('mintAddress' in prepareBody) ||
        !('metadataUri' in prepareBody)
      ) {
        throw new Error('Invalid mint-nft response shape');
      }

      const { transactionBase64, mintAddress, metadataUri } = prepareBody as {
        transactionBase64: string;
        mintAddress: string;
        metadataUri: string;
      };

      // Step 2 — decode, sign via wallet-adapter, submit to chain
      const tx = Transaction.from(Buffer.from(transactionBase64, 'base64'));
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, 'confirmed');

      // Step 3 — confirm with server so it persists the mint details
      const confirmRes = await fetch(`${API_BASE}/characters/${characterId}/confirm-mint`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mintAddress,
          transactionSignature: sig,
          metadataUri,
        }),
      });

      if (!confirmRes.ok) {
        const errBody: unknown = await confirmRes.json();
        const errMsg =
          typeof errBody === 'object' && errBody !== null && 'error' in errBody
            ? String((errBody as Record<string, unknown>).error)
            : 'Failed to confirm mint';
        throw new Error(errMsg);
      }

      return {
        mintAddress,
        metadataUri,
        transactionSignature: sig,
      };
    },
    onSuccess: () => {
      // Refresh character data so nftMintAddress appears in the hero section
      queryClient.invalidateQueries({ queryKey: ['character', characterId] });
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useAgentRegistry
// ---------------------------------------------------------------------------

/**
 * Fetch the registry file for a minted agent.
 * Returns null when no registry exists (404) — callers should treat null
 * as a non-error "not minted" state.
 */
export function useAgentRegistry(characterId: string) {
  const token = useAuthStore((state) => state.token);

  return useQuery<AgentRegistryFile | null, Error>({
    queryKey: ['agent-registry', characterId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/characters/${characterId}/registry`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });

      if (res.status === 404) return null;

      if (!res.ok) {
        throw new Error('Failed to fetch agent registry');
      }

      const body: unknown = await res.json();
      return body as AgentRegistryFile;
    },
    enabled: !!token && !!characterId,
  });
}
