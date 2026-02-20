/**
 * Wallet Authentication Store
 * Zustand store for client-side auth state management
 */

import { create } from 'zustand';

export interface AuthState {
  token: string | null;
  user: {
    walletAddress: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  isAuthenticated: boolean;
  isWhitelisted: boolean;
  setAuth: (
    token: string,
    user: {
      walletAddress: string;
      displayName: string | null;
      avatarUrl: string | null;
    },
    isWhitelisted?: boolean
  ) => void;
  setIsWhitelisted: (isWhitelisted: boolean) => void;
  clearAuth: () => void;
}

const AUTH_STORAGE_KEY = 'ozskr_auth_token';

/**
 * Auth state store.
 * Persists token to localStorage for session continuity.
 * Sets the JWT itself as the session cookie so edge middleware can decode it.
 */
export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isWhitelisted: false,

  setAuth: (token, user, isWhitelisted = false) => {
    // Persist token to localStorage + set JWT as session cookie for middleware
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, token);
      document.cookie = `ozskr_session=${token}; path=/; max-age=2592000; SameSite=Lax`;
    }

    set({
      token,
      user,
      isAuthenticated: true,
      isWhitelisted,
    });
  },

  setIsWhitelisted: (isWhitelisted) => {
    set({ isWhitelisted });
  },

  clearAuth: () => {
    // Clear token from localStorage + remove session cookie
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      document.cookie = 'ozskr_session=; path=/; max-age=0; SameSite=Lax';
    }

    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isWhitelisted: false,
    });
  },
}));

/**
 * Get stored auth token from localStorage.
 * @returns Token string or null
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(AUTH_STORAGE_KEY);
}
