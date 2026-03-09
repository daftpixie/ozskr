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
  const { token, user, isAuthenticated, isWhitelisted, isAdmin, setAuth, clearAuth } = useAuthStore();
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
        const detail = (errorData as Record<string, unknown>).detail;
        const msg = errorData.error || 'Authentication failed';
        throw new Error(detail ? `${msg}: ${detail}` : msg);
      }

      // Step 5: Parse and store session
      const rawData = await response.json();
      const session = SessionResponseSchema.parse(rawData);
      const raw = rawData as Record<string, unknown>;
      const whitelisted = !!raw.isWhitelisted;
      const admin = !!raw.isAdmin;

      setAuth(session.token, session.user, whitelisted, admin);
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
   *
   * Only clears auth on definitive auth failures (401/403). Transient errors
   * (5xx, network failures) leave the stored token intact so the user is not
   * logged out due to a momentary server or connectivity issue.
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
          // Only clear auth on definitive authentication failures (401/403).
          // A 5xx or network error is transient — do not log the user out.
          if (response.status === 401 || response.status === 403) {
            clearAuth();
          }
          return;
        }

        const rawData = await response.json();
        const session = SessionResponseSchema.parse(rawData);
        const raw = rawData as Record<string, unknown>;
        const whitelisted = !!raw.isWhitelisted;
        const admin = !!raw.isAdmin;

        setAuth(session.token, session.user, whitelisted, admin);
      } catch {
        // Network-level failure (fetch threw) — do not clear auth.
        // The user will be re-validated on the next mount or interaction.
      } finally {
        setIsLoading(false);
      }
    };

    validateSession();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NOTE: We intentionally do NOT auto-sign-out on wallet adapter disconnect.
  // The wallet adapter briefly reports connected=false during Fast Refresh and
  // extension re-hydration, which previously caused spurious sign-outs.
  // Auth is governed by the JWT session (validated on mount via /api/auth/session)
  // and cleared only by explicit sign-out or a server-side 401.

  return {
    isAuthenticated,
    isWhitelisted,
    isAdmin,
    isLoading,
    user,
    token,
    signIn,
    signOut,
    error,
  };
}
