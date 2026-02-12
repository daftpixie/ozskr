/**
 * Wallet Mock Helpers for E2E Tests
 * Sets up mock wallet adapter state for Playwright
 */

import type { Page } from '@playwright/test';

export const TEST_WALLET_ADDRESS = 'TestWa11etAddress1111111111111111111111111';
export const TEST_JWT_TOKEN = 'test-jwt-token-for-e2e';

/**
 * Setup mock wallet adapter on the page.
 * Mocks window.solana and wallet adapter context.
 */
export async function setupWalletMock(page: Page): Promise<void> {
  await page.addInitScript((walletAddress: string) => {
    // Mock window.solana (Phantom-like interface)
    (window as unknown as Record<string, unknown>).solana = {
      publicKey: { toString: () => walletAddress },
      isConnected: true,
      connect: async () => ({ publicKey: { toString: () => walletAddress } }),
      disconnect: async () => {},
      signMessage: async () => new Uint8Array(64),
      signTransaction: async (tx: unknown) => tx,
      signAllTransactions: async (txs: unknown[]) => txs,
    };

    // Mock wallet adapter context (React context injection)
    (window as unknown as Record<string, unknown>).__WALLET_MOCK__ = {
      publicKey: walletAddress,
      connected: true,
      connecting: false,
    };
  }, TEST_WALLET_ADDRESS);
}

/**
 * Inject authenticated session into localStorage/Zustand to bypass auth flow.
 * Sets JWT token and wallet address directly in auth store.
 */
export async function mockAuthenticatedSession(page: Page): Promise<void> {
  await page.addInitScript(
    ({ walletAddress, jwtToken }: { walletAddress: string; jwtToken: string }) => {
      // Mock localStorage auth token
      localStorage.setItem('ozskr_auth_token', jwtToken);
      localStorage.setItem('ozskr_wallet_address', walletAddress);

      // Mock Zustand auth store
      const authState = {
        state: {
          token: jwtToken,
          walletAddress: walletAddress,
          isAuthenticated: true,
          user: {
            walletAddress: walletAddress,
            displayName: null,
            avatarUrl: null,
          },
        },
        version: 0,
      };

      localStorage.setItem('ozskr-auth-storage', JSON.stringify(authState));
    },
    { walletAddress: TEST_WALLET_ADDRESS, jwtToken: TEST_JWT_TOKEN }
  );
}
