'use client';

/**
 * Wallet Authentication Hook
 * Handles full SIWS (Sign-In With Solana) flow with wallet adapter integration
 */

import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { assertIsAddress, address as createAddress } from '@solana/kit';
import { useAuthStore, getStoredToken } from '../store';
import { createSiwsMessage, serializeSiwsMessage } from '@/lib/solana/siws';
import {
  SessionResponseSchema,
  ApiSuccessSchema,
} from '@/types/schemas';

const API_BASE = '/api/auth';

export function useWalletAuth() {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const { token, user, isAuthenticated, isWhitelisted, setAuth, clearAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Sign in with wallet using SIWS flow.
   * Steps:
   * 1. Check wallet is connected
   * 2. Create SIWS message
   * 3. Request wallet signature
   * 4. Submit to API for verification
   * 5. Store JWT token
   */
  const signIn = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Step 1: Validate wallet connection
      if (!connected || !publicKey || !signMessage) {
        throw new Error('Wallet not connected');
      }

      // Validate address format
      const walletAddress = createAddress(publicKey.toBase58());
      assertIsAddress(walletAddress);

      // Step 2: Create SIWS message
      const domain =
        typeof window !== 'undefined' ? window.location.hostname : 'ozskr.ai';
      const message = createSiwsMessage({
        domain,
        address: walletAddress,
      });

      // Step 3: Serialize and sign message
      const serializedMessage = serializeSiwsMessage(message);
      const messageBytes = new TextEncoder().encode(serializedMessage);

      // Request signature from wallet
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);

      // Step 4: Submit to verification API
      const response = await fetch(`${API_BASE}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: serializedMessage,
          signature,
          publicKey: walletAddress,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Authentication failed');
      }

      // Step 5: Parse and store session
      const rawData = await response.json();
      const session = SessionResponseSchema.parse(rawData);
      const whitelisted = !!(rawData as Record<string, unknown>).isWhitelisted;

      setAuth(session.token, session.user, whitelisted);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to sign in';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [connected, publicKey, signMessage, setAuth]);

  /**
   * Sign out: clear session and disconnect wallet.
   */
  const signOut = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Call logout API if we have a token
      if (token) {
        const response = await fetch(`${API_BASE}/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          ApiSuccessSchema.parse(await response.json());
        }
      }

      // Clear local state
      clearAuth();

      // Disconnect wallet
      await disconnect();

      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to sign out';
      setError(errorMessage);

      // Still clear local state even if API call failed
      clearAuth();
      await disconnect();
    } finally {
      setIsLoading(false);
    }
  }, [token, clearAuth, disconnect]);

  /**
   * Validate existing session on mount.
   * Checks localStorage for token and validates with API.
   */
  useEffect(() => {
    const validateSession = async () => {
      const storedToken = getStoredToken();

      if (!storedToken) {
        return;
      }

      setIsLoading(true);

      try {
        const response = await fetch(`${API_BASE}/session`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (!response.ok) {
          // Token invalid or expired - clear it
          clearAuth();
          return;
        }

        const rawData = await response.json();
        const session = SessionResponseSchema.parse(rawData);
        const whitelisted = !!(rawData as Record<string, unknown>).isWhitelisted;

        setAuth(session.token, session.user, whitelisted);
      } catch {
        // Session validation failed - clear auth
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    validateSession();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Handle wallet disconnect: auto sign out.
   */
  useEffect(() => {
    if (!connected && isAuthenticated) {
      clearAuth();
    }
  }, [connected, isAuthenticated, clearAuth]);

  return {
    isAuthenticated,
    isWhitelisted,
    isLoading,
    user,
    token,
    signIn,
    signOut,
    error,
  };
}
