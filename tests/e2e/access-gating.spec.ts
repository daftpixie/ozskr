/**
 * Access Gating E2E Tests
 * Tests tier-based feature gating and access controls
 */

import { test, expect } from '@playwright/test';
import { setupWalletMock, mockAuthenticatedSession } from './helpers/wallet-mock';
import { setupApiMocks } from './helpers/api-mocks';

test.describe('Access Gating', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('unauthenticated users see landing page', async ({ page }) => {
    await page.goto('/');

    // Should show landing page with CTA
    const connectButton = page.getByRole('button', { name: /connect|follow/i });
    await expect(connectButton).toBeVisible();
  });

  test('unauthenticated users cannot access dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to landing
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });

  test('unauthenticated users cannot access agents page', async ({ page }) => {
    await page.goto('/agents');

    // Should redirect to landing
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });

  test('unauthenticated users cannot access settings', async ({ page }) => {
    await page.goto('/settings');

    // Should redirect to landing
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });

  test('authenticated users can access protected routes', async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);

    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');

    // Verify page content loads (not just URL)
    const content = page.locator('main');
    await expect(content).toBeVisible();
  });

  test('admin endpoints return 401 without auth', async ({ page }) => {
    // Call admin API without auth
    const response = await page.request.get('/api/admin/metrics/summary');
    expect(response.status()).toBe(401);
  });

  test('non-admin wallet gets rejected from admin endpoints', async ({ page }) => {
    // Mock API with non-admin JWT
    await page.route('**/api/admin/**', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forbidden', code: 'FORBIDDEN' }),
      });
    });

    const response = await page.request.get('/api/admin/metrics/summary', {
      headers: { Authorization: 'Bearer non-admin-token' },
    });

    // Admin metrics returns 403, whitelist returns 404
    expect([403, 404]).toContain(response.status());
  });

  test('authenticated user sees dashboard content', async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);

    await page.goto('/dashboard');

    // Should show welcome heading
    const welcomeHeading = page.getByRole('heading', { level: 1 });
    await expect(welcomeHeading).toBeVisible();

    // Should show wallet address somewhere
    const walletText = page.locator('text=/TestW/i');
    await expect(walletText).toBeVisible();
  });
});
