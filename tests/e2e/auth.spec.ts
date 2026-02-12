/**
 * Auth E2E Tests
 * Tests for wallet connection and SIWS authentication flow
 */

import { test, expect } from '@playwright/test';
import { setupWalletMock, mockAuthenticatedSession } from './helpers/wallet-mock';
import { setupApiMocks } from './helpers/api-mocks';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('should display landing page with connect wallet button', async ({ page }) => {
    await page.goto('/');

    // Verify landing page loads
    await expect(page).toHaveURL('/');

    // Look for connect wallet CTA (should have data-testid="connect-wallet-button")
    const connectButton = page.getByRole('button', { name: /connect/i });
    await expect(connectButton).toBeVisible();
  });

  test('should redirect to dashboard after wallet connect', async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);

    // Navigate to dashboard with authenticated session
    await page.goto('/dashboard');

    // Should stay on dashboard (not redirect to landing)
    await expect(page).toHaveURL('/dashboard');

    // Verify dashboard content loads
    const dashboardHeading = page.getByRole('heading', { name: /dashboard/i });
    await expect(dashboardHeading).toBeVisible();
  });

  test('should redirect to landing when not authenticated', async ({ page }) => {
    // Try to access protected route without auth
    await page.goto('/dashboard');

    // Should redirect to landing page
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });

  test('should show wallet address in dashboard', async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);

    await page.goto('/dashboard');

    // Verify truncated wallet address is displayed
    // Pattern matches "TestW...11111" format
    const walletDisplay = page.locator('text=/TestW.*11111/i');
    await expect(walletDisplay).toBeVisible();
  });

  test('should show disconnect option when wallet connected', async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);

    await page.goto('/dashboard');

    // Look for wallet menu trigger (should have data-testid="wallet-menu")
    const walletMenu = page.getByTestId('wallet-menu');
    await expect(walletMenu).toBeVisible();

    // Click to open menu
    await walletMenu.click();

    // Verify disconnect option appears
    const disconnectButton = page.getByRole('button', { name: /disconnect/i });
    await expect(disconnectButton).toBeVisible();
  });
});
