/**
 * Content Generation E2E Tests
 * Tests for AI content generation flow with SSE streaming
 */

import { test, expect } from '@playwright/test';
import { setupWalletMock, mockAuthenticatedSession } from './helpers/wallet-mock';
import { setupApiMocks } from './helpers/api-mocks';

test.describe('Content Generation', () => {
  test.beforeEach(async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);
    await setupApiMocks(page);
  });

  test('should show generation interface on agent page', async ({ page }) => {
    await page.goto('/agents');

    // Navigate to agent detail
    const agentCard = page.getByTestId('agent-card').first();
    await agentCard.click();

    // Verify generate button exists
    const generateButton = page.getByRole('button', { name: /generate/i });
    await expect(generateButton).toBeVisible();
  });

  test('should open generation modal', async ({ page }) => {
    await page.goto('/agents');

    // Navigate to agent detail
    const agentCard = page.getByTestId('agent-card').first();
    await agentCard.click();

    // Click generate button
    const generateButton = page.getByRole('button', { name: /generate/i });
    await generateButton.click();

    // Verify modal opens (should have data-testid="generation-modal")
    const modal = page.getByTestId('generation-modal');
    await expect(modal).toBeVisible();

    // Verify modal has generation type selector
    const typeSelector = page.getByLabel(/content type|generation type/i);
    await expect(typeSelector).toBeVisible();

    // Verify modal has prompt input
    const promptInput = page.getByLabel(/prompt|what.*generate/i);
    await expect(promptInput).toBeVisible();
  });

  test('should show streaming progress during generation', async ({ page }) => {
    await page.goto('/agents');

    // Navigate to agent detail and open generation modal
    const agentCard = page.getByTestId('agent-card').first();
    await agentCard.click();

    const generateButton = page.getByRole('button', { name: /generate/i });
    await generateButton.click();

    // Fill in generation form
    const promptInput = page.getByLabel(/prompt|what.*generate/i);
    await promptInput.fill('Generate a crypto market update post');

    // Submit generation
    const submitButton = page.getByRole('button', { name: /generate|start/i }).last();
    await submitButton.click();

    // Wait for API call to start
    const responsePromise = page.waitForResponse('**/api/ai/generate');

    // Verify progress stages appear (should have data-testid="generation-progress")
    const progressContainer = page.getByTestId('generation-progress');
    await expect(progressContainer).toBeVisible({ timeout: 2000 });

    // Verify specific stage messages appear in sequence
    // Stage 1: Loading character
    const loadingStage = page.getByText(/loading.*character/i);
    await expect(loadingStage).toBeVisible({ timeout: 3000 });

    // Stage 2: Enhancing prompt
    const enhancingStage = page.getByText(/enhancing.*prompt/i);
    await expect(enhancingStage).toBeVisible({ timeout: 3000 });

    // Stage 3: Generating content
    const generatingStage = page.getByText(/generating.*content/i);
    await expect(generatingStage).toBeVisible({ timeout: 3000 });

    // Stage 4: Quality check
    const qualityStage = page.getByText(/quality.*check/i);
    await expect(qualityStage).toBeVisible({ timeout: 3000 });

    // Wait for response to complete
    await responsePromise;

    // Stage 5: Complete
    const completeStage = page.getByText(/complete|done|success/i);
    await expect(completeStage).toBeVisible({ timeout: 3000 });
  });

  test('should display generation result', async ({ page }) => {
    await page.goto('/agents');

    // Navigate to agent detail and open generation modal
    const agentCard = page.getByTestId('agent-card').first();
    await agentCard.click();

    const generateButton = page.getByRole('button', { name: /generate/i });
    await generateButton.click();

    // Fill and submit generation
    const promptInput = page.getByLabel(/prompt|what.*generate/i);
    await promptInput.fill('Create a meme about Solana');

    const submitButton = page.getByRole('button', { name: /generate|start/i }).last();
    await submitButton.click();

    // Wait for generation to complete
    await page.waitForResponse('**/api/ai/generate');

    // Wait for complete stage
    const completeStage = page.getByText(/complete|done|success/i);
    await expect(completeStage).toBeVisible({ timeout: 10000 });

    // Verify result display (should have data-testid="generation-result")
    const resultContainer = page.getByTestId('generation-result');
    await expect(resultContainer).toBeVisible({ timeout: 3000 });

    // Verify generated text or image is displayed
    const generatedContent = page.getByText(/This is the generated content text/i);
    await expect(generatedContent).toBeVisible();

    // Verify action buttons (publish, regenerate, etc.)
    const publishButton = page.getByRole('button', { name: /publish|share/i });
    await expect(publishButton).toBeVisible();
  });

  test('should allow regeneration after completion', async ({ page }) => {
    await page.goto('/agents');

    // Navigate to agent detail and generate content
    const agentCard = page.getByTestId('agent-card').first();
    await agentCard.click();

    const generateButton = page.getByRole('button', { name: /generate/i });
    await generateButton.click();

    const promptInput = page.getByLabel(/prompt|what.*generate/i);
    await promptInput.fill('Test regeneration prompt');

    const submitButton = page.getByRole('button', { name: /generate|start/i }).last();
    await submitButton.click();

    // Wait for first generation to complete
    await page.waitForResponse('**/api/ai/generate');
    const completeStage = page.getByText(/complete|done|success/i);
    await expect(completeStage).toBeVisible({ timeout: 10000 });

    // Look for regenerate button
    const regenerateButton = page.getByRole('button', { name: /regenerate|try again/i });
    await expect(regenerateButton).toBeVisible();

    // Click regenerate
    await regenerateButton.click();

    // Verify progress resets and starts again
    const loadingStage = page.getByText(/loading.*character/i);
    await expect(loadingStage).toBeVisible({ timeout: 3000 });
  });

  test('should show generation history', async ({ page }) => {
    await page.goto('/agents');

    // Navigate to agent detail
    const agentCard = page.getByTestId('agent-card').first();
    await agentCard.click();

    // Look for history/previous generations section
    const historySection = page.getByRole('heading', { name: /history|previous|recent/i });
    await expect(historySection).toBeVisible();

    // Verify generation count is displayed
    const generationCount = page.getByText(/42.*generations?/i);
    await expect(generationCount).toBeVisible();

    // Verify history items are clickable
    const historyItem = page.getByTestId('generation-history-item').first();
    if (await historyItem.isVisible({ timeout: 1000 })) {
      await expect(historyItem).toBeVisible();
    }
  });

  test('should cancel generation in progress', async ({ page }) => {
    await page.goto('/agents');

    // Navigate to agent detail and start generation
    const agentCard = page.getByTestId('agent-card').first();
    await agentCard.click();

    const generateButton = page.getByRole('button', { name: /generate/i });
    await generateButton.click();

    const promptInput = page.getByLabel(/prompt|what.*generate/i);
    await promptInput.fill('Test cancellation');

    const submitButton = page.getByRole('button', { name: /generate|start/i }).last();
    await submitButton.click();

    // Wait for progress to start
    const progressContainer = page.getByTestId('generation-progress');
    await expect(progressContainer).toBeVisible({ timeout: 2000 });

    // Look for cancel button
    const cancelButton = page.getByRole('button', { name: /cancel|stop/i });
    await expect(cancelButton).toBeVisible();

    // Click cancel
    await cancelButton.click();

    // Verify generation stops (progress container disappears or shows cancelled state)
    const cancelledMessage = page.getByText(/cancel|stopped/i);
    await expect(cancelledMessage).toBeVisible({ timeout: 3000 });
  });
});
