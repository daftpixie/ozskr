/**
 * Alpha User Journey E2E Tests
 * Tests the complete flow from landing to agent creation for alpha testers
 */

import { test, expect } from '@playwright/test';
import { setupWalletMock, mockAuthenticatedSession, TEST_WALLET_ADDRESS } from './helpers/wallet-mock';
import { setupApiMocks } from './helpers/api-mocks';

test.describe('Alpha User Journey', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('landing page shows connect wallet CTA', async ({ page }) => {
    await page.goto('/');

    // Landing page should have a connect/follow CTA
    const cta = page.getByRole('button', { name: /connect|follow/i });
    await expect(cta).toBeVisible();
  });

  test('authenticated user can access dashboard', async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);

    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');

    // Dashboard should load with welcome content
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
  });

  test('dashboard shows agent creation CTA when no agents', async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);

    // Mock empty agents response
    await page.route('**/api/ai/characters?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        }),
      });
    });

    await page.goto('/dashboard');

    // Should show a create agent CTA
    const createLink = page.getByRole('link', { name: /create|start|bring/i });
    await expect(createLink).toBeVisible();
  });

  test('can navigate to agents page', async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);

    await page.goto('/agents');
    await expect(page).toHaveURL('/agents');

    // Should show agents page heading
    const heading = page.getByRole('heading', { name: /agent/i });
    await expect(heading).toBeVisible();
  });

  test('can navigate to agent creation form', async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);

    await page.goto('/agents/create');
    await expect(page).toHaveURL('/agents/create');

    // Should show creation form with step indicator
    const nameInput = page.getByPlaceholder(/solana|crypto|pixel|wizard|oracle/i);
    await expect(nameInput).toBeVisible();
  });

  test('can navigate to agent detail page', async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);

    await page.goto('/agents/char-001');
    await expect(page).toHaveURL('/agents/char-001');

    // Should show agent name
    const agentName = page.getByText('CryptoWiz');
    await expect(agentName).toBeVisible();
  });

  test('can view portfolio page', async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);

    await page.goto('/portfolio');

    // Should show portfolio heading and balances
    const heading = page.getByRole('heading', { name: /portfolio/i });
    await expect(heading).toBeVisible();
  });

  test('sidebar navigation works between pages', async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);

    await page.goto('/dashboard');

    // Navigate via sidebar to agents
    const agentsLink = page.getByRole('link', { name: /agent/i }).first();
    await agentsLink.click();
    await expect(page).toHaveURL('/agents');

    // Navigate to analytics
    const analyticsLink = page.getByRole('link', { name: /analytics/i }).first();
    await analyticsLink.click();
    await expect(page).toHaveURL('/analytics');
  });
});
