/**
 * Agents E2E Tests
 * Tests for agent creation, management, and lifecycle
 */

import { test, expect } from '@playwright/test';
import { setupWalletMock, mockAuthenticatedSession } from './helpers/wallet-mock';
import { setupApiMocks } from './helpers/api-mocks';

test.describe('Agent Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);
    await setupApiMocks(page);
  });

  test('should display agent list on dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Verify agents section exists
    const agentsHeading = page.getByRole('heading', { name: /your agents/i });
    await expect(agentsHeading).toBeVisible();

    // Verify agent cards render (should have data-testid="agent-card")
    const agentCards = page.getByTestId('agent-card');
    await expect(agentCards.first()).toBeVisible();

    // Verify specific agent names from mock data
    await expect(page.getByText('CryptoWiz')).toBeVisible();
    await expect(page.getByText('MemeLord')).toBeVisible();
  });

  test('should navigate to agents page', async ({ page }) => {
    await page.goto('/dashboard');

    // Click "View All Agents" or navigate to /agents
    const viewAllLink = page.getByRole('link', { name: /view all/i });
    if (await viewAllLink.isVisible()) {
      await viewAllLink.click();
    } else {
      await page.goto('/agents');
    }

    // Verify we're on agents page
    await expect(page).toHaveURL('/agents');

    // Verify agent grid/list displays
    const agentCards = page.getByTestId('agent-card');
    await expect(agentCards.first()).toBeVisible();
  });

  test('should navigate to create agent page', async ({ page }) => {
    await page.goto('/agents');

    // Click create agent button (should have data-testid="create-agent-button")
    const createButton = page.getByRole('button', { name: /create agent/i });
    await expect(createButton).toBeVisible();
    await createButton.click();

    // Verify wizard page loads
    await expect(page).toHaveURL('/agents/create');

    // Verify wizard header
    const wizardHeading = page.getByRole('heading', { name: /create.*agent/i });
    await expect(wizardHeading).toBeVisible();
  });

  test('should show agent creation wizard steps', async ({ page }) => {
    await page.goto('/agents/create');

    // Verify step indicators exist (should have data-testid="wizard-step-1" etc.)
    // Expected steps: 1. Basic Info, 2. Personality, 3. Visual Style, 4. Social
    const step1 = page.getByTestId('wizard-step-1');
    const step2 = page.getByTestId('wizard-step-2');
    const step3 = page.getByTestId('wizard-step-3');
    const step4 = page.getByTestId('wizard-step-4');

    await expect(step1).toBeVisible();
    await expect(step2).toBeVisible();
    await expect(step3).toBeVisible();
    await expect(step4).toBeVisible();

    // Verify first step is active
    const activeStep = page.locator('[data-step-active="true"]');
    await expect(activeStep).toBeVisible();
  });

  test('should create agent through wizard', async ({ page }) => {
    await page.goto('/agents/create');

    // STEP 1: Basic Info
    const nameInput = page.getByLabel(/agent name/i);
    await expect(nameInput).toBeVisible();
    await nameInput.fill('TestAgent');

    const personaTextarea = page.getByLabel(/persona/i);
    await expect(personaTextarea).toBeVisible();
    await personaTextarea.fill('A test agent persona for E2E testing');

    // Click Next
    const nextButton1 = page.getByRole('button', { name: /next/i });
    await nextButton1.click();

    // STEP 2: Personality
    // Verify voice tone selector is visible
    const voiceToneSelect = page.getByLabel(/voice tone/i);
    await expect(voiceToneSelect).toBeVisible();
    await voiceToneSelect.selectOption('friendly');

    // Topic affinity checkboxes
    const topicCheckbox = page.getByLabel(/web3/i);
    if (await topicCheckbox.isVisible()) {
      await topicCheckbox.check();
    }

    const nextButton2 = page.getByRole('button', { name: /next/i });
    await nextButton2.click();

    // STEP 3: Visual Style
    const visualStyleSelect = page.getByLabel(/visual style/i);
    await expect(visualStyleSelect).toBeVisible();
    await visualStyleSelect.selectOption('minimal');

    const nextButton3 = page.getByRole('button', { name: /next/i });
    await nextButton3.click();

    // STEP 4: Social Accounts (optional, can skip)
    // Click Create/Finish button
    const createButton = page.getByRole('button', { name: /create|finish/i });
    await createButton.click();

    // Wait for API response
    await page.waitForResponse('**/api/ai/characters');

    // Verify success message or redirect to agent detail
    const successMessage = page.getByText(/agent created|success/i);
    await expect(successMessage).toBeVisible({ timeout: 5000 });
  });

  test('should show agent detail after creation', async ({ page }) => {
    // Start from agents list page
    await page.goto('/agents');

    // Click on an existing agent card
    const agentCard = page.getByTestId('agent-card').first();
    await agentCard.click();

    // Should navigate to agent detail page
    await expect(page.url()).toMatch(/\/agents\/[a-z0-9-]+/);

    // Verify agent detail sections
    const agentName = page.getByRole('heading', { name: /CryptoWiz/i });
    await expect(agentName).toBeVisible();

    // Verify stats display
    const generationsCount = page.getByText(/42.*generations?/i);
    await expect(generationsCount).toBeVisible();

    // Verify action buttons
    const generateButton = page.getByRole('button', { name: /generate/i });
    await expect(generateButton).toBeVisible();
  });

  test('should show agent edit option', async ({ page }) => {
    await page.goto('/agents');

    // Navigate to agent detail
    const agentCard = page.getByTestId('agent-card').first();
    await agentCard.click();

    // Look for edit button (should have data-testid="edit-agent-button")
    const editButton = page.getByRole('button', { name: /edit/i });
    await expect(editButton).toBeVisible();

    // Click edit button
    await editButton.click();

    // Verify edit form loads (could be modal or separate page)
    const editHeading = page.getByRole('heading', { name: /edit.*agent/i });
    await expect(editHeading).toBeVisible({ timeout: 3000 });
  });
});
