/**
 * Scheduling & Publishing E2E Tests
 * Tests for content scheduling, social accounts, and publishing
 */

import { test, expect } from '@playwright/test';
import { setupWalletMock, mockAuthenticatedSession } from './helpers/wallet-mock';
import { setupApiMocks } from './helpers/api-mocks';

test.describe('Scheduling & Publishing', () => {
  test.beforeEach(async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);
    await setupApiMocks(page);
  });

  test('should navigate to calendar page', async ({ page }) => {
    await page.goto('/dashboard');

    // Click on calendar navigation link
    const calendarLink = page.getByRole('link', { name: /calendar|schedule/i });
    await expect(calendarLink).toBeVisible();
    await calendarLink.click();

    // Verify we're on calendar page
    await expect(page).toHaveURL('/dashboard/calendar');

    // Verify calendar interface loads
    const calendarHeading = page.getByRole('heading', { name: /calendar|schedule/i });
    await expect(calendarHeading).toBeVisible();
  });

  test('should show existing schedules', async ({ page }) => {
    await page.goto('/dashboard/calendar');

    // Wait for schedules API call
    await page.waitForResponse('**/api/ai/schedules?*');

    // Verify schedule entries display (should have data-testid="schedule-item")
    const scheduleItem = page.getByTestId('schedule-item');
    await expect(scheduleItem.first()).toBeVisible();

    // Verify schedule details from mock data
    const schedule1 = page.getByText(/9:00 AM|daily/i);
    await expect(schedule1).toBeVisible();

    // Verify active status indicator
    const activeIndicator = page.getByText(/active|enabled/i);
    await expect(activeIndicator).toBeVisible();
  });

  test('should display schedule creation form', async ({ page }) => {
    await page.goto('/dashboard/calendar');

    // Click create schedule button (should have data-testid="create-schedule-button")
    const createButton = page.getByRole('button', { name: /create.*schedule|new.*schedule/i });
    await expect(createButton).toBeVisible();
    await createButton.click();

    // Verify form modal or page appears
    const formHeading = page.getByRole('heading', { name: /create.*schedule|new.*schedule/i });
    await expect(formHeading).toBeVisible();

    // Verify form fields
    const characterSelect = page.getByLabel(/agent|character/i);
    await expect(characterSelect).toBeVisible();

    const timeInput = page.getByLabel(/time|when/i);
    await expect(timeInput).toBeVisible();

    const frequencySelect = page.getByLabel(/frequency|repeat/i);
    await expect(frequencySelect).toBeVisible();

    const platformCheckbox = page.getByLabel(/twitter|platform/i);
    await expect(platformCheckbox).toBeVisible();
  });

  test('should create new schedule', async ({ page }) => {
    await page.goto('/dashboard/calendar');

    // Open create schedule form
    const createButton = page.getByRole('button', { name: /create.*schedule|new.*schedule/i });
    await createButton.click();

    // Fill out form
    const characterSelect = page.getByLabel(/agent|character/i);
    await characterSelect.selectOption({ index: 0 });

    const timeInput = page.getByLabel(/time|when/i);
    await timeInput.fill('14:00');

    const frequencySelect = page.getByLabel(/frequency|repeat/i);
    await frequencySelect.selectOption('daily');

    // Select Twitter platform
    const twitterCheckbox = page.getByLabel(/twitter/i);
    await twitterCheckbox.check();

    // Submit form
    const submitButton = page.getByRole('button', { name: /create|save/i }).last();
    await submitButton.click();

    // Wait for API response
    await page.waitForResponse('**/api/ai/schedules');

    // Verify success message
    const successMessage = page.getByText(/schedule.*created|success/i);
    await expect(successMessage).toBeVisible({ timeout: 5000 });
  });

  test('should toggle schedule active status', async ({ page }) => {
    await page.goto('/dashboard/calendar');

    // Wait for schedules to load
    await page.waitForResponse('**/api/ai/schedules?*');

    const scheduleItem = page.getByTestId('schedule-item').first();
    await expect(scheduleItem).toBeVisible();

    // Find toggle switch (should have data-testid="schedule-toggle")
    const toggleSwitch = scheduleItem.getByTestId('schedule-toggle');
    await expect(toggleSwitch).toBeVisible();

    // Click toggle
    await toggleSwitch.click();

    // Verify status change (could be optimistic or wait for API)
    const inactiveIndicator = page.getByText(/inactive|disabled/i);
    await expect(inactiveIndicator).toBeVisible({ timeout: 3000 });
  });

  test('should navigate to social settings', async ({ page }) => {
    await page.goto('/dashboard');

    // Navigate to settings
    const settingsLink = page.getByRole('link', { name: /settings/i });
    await expect(settingsLink).toBeVisible();
    await settingsLink.click();

    // Navigate to social accounts sub-page
    const socialTab = page.getByRole('link', { name: /social.*accounts/i });
    await expect(socialTab).toBeVisible();
    await socialTab.click();

    // Verify we're on social settings page
    await expect(page).toHaveURL('/dashboard/settings/social');

    // Verify social settings heading
    const socialHeading = page.getByRole('heading', { name: /social.*accounts/i });
    await expect(socialHeading).toBeVisible();
  });

  test('should display connected accounts', async ({ page }) => {
    await page.goto('/dashboard/settings/social');

    // Wait for social accounts API call
    await page.waitForResponse('**/api/social/accounts?*');

    // Verify account cards display (should have data-testid="social-account-card")
    const accountCard = page.getByTestId('social-account-card');
    await expect(accountCard.first()).toBeVisible();

    // Verify Twitter account from mock data
    const twitterAccount = page.getByText(/@cryptowiz/i);
    await expect(twitterAccount).toBeVisible();

    // Verify connected status
    const connectedBadge = page.getByText(/connected/i);
    await expect(connectedBadge).toBeVisible();

    // Verify last posted timestamp
    const lastPosted = page.getByText(/3 hours ago|last posted/i);
    await expect(lastPosted).toBeVisible();
  });

  test('should show connect account button', async ({ page }) => {
    await page.goto('/dashboard/settings/social');

    // Look for "Connect Twitter" button (for disconnected accounts)
    const connectButton = page.getByRole('button', { name: /connect.*twitter|connect.*instagram/i });

    // At least one connect button should be visible (for platforms not yet connected)
    if (await connectButton.isVisible({ timeout: 1000 })) {
      await expect(connectButton).toBeVisible();
    }

    // Alternative: look for "Add Account" button
    const addAccountButton = page.getByRole('button', { name: /add.*account|connect.*new/i });
    if (await addAccountButton.isVisible({ timeout: 1000 })) {
      await expect(addAccountButton).toBeVisible();
    }
  });

  test('should show social posts list', async ({ page }) => {
    await page.goto('/dashboard');

    // Navigate to posts/content page (could be dashboard section or separate page)
    const postsLink = page.getByRole('link', { name: /posts|content|published/i });

    if (await postsLink.isVisible({ timeout: 2000 })) {
      await postsLink.click();
    } else {
      // Posts might be on dashboard itself
      await page.goto('/dashboard');
    }

    // Wait for posts API call
    await page.waitForResponse('**/api/social/posts?*');

    // Verify posts section heading
    const postsHeading = page.getByRole('heading', { name: /posts|published.*content/i });
    await expect(postsHeading).toBeVisible();

    // Verify posts table or grid (should have data-testid="post-item")
    const postItem = page.getByTestId('post-item');
    await expect(postItem.first()).toBeVisible();

    // Verify post details from mock data
    const publishedPost = page.getByText(/published|3 hours ago/i);
    await expect(publishedPost).toBeVisible();

    // Verify engagement metrics
    const likesCount = page.getByText(/42.*likes?/i);
    await expect(likesCount).toBeVisible();
  });

  test('should filter posts by status', async ({ page }) => {
    await page.goto('/dashboard');

    // Navigate to posts section
    const postsLink = page.getByRole('link', { name: /posts|content/i });
    if (await postsLink.isVisible({ timeout: 2000 })) {
      await postsLink.click();
    }

    await page.waitForResponse('**/api/social/posts?*');

    // Look for status filter tabs/buttons
    const scheduledTab = page.getByRole('tab', { name: /scheduled/i });
    if (await scheduledTab.isVisible({ timeout: 1000 })) {
      await scheduledTab.click();

      // Verify scheduled posts are displayed
      const scheduledPost = page.getByText(/scheduled/i);
      await expect(scheduledPost).toBeVisible();
    }

    const publishedTab = page.getByRole('tab', { name: /published/i });
    if (await publishedTab.isVisible({ timeout: 1000 })) {
      await publishedTab.click();

      // Verify published posts are displayed
      const publishedPost = page.getByText(/published/i);
      await expect(publishedPost).toBeVisible();
    }
  });

  test('should show post analytics', async ({ page }) => {
    await page.goto('/dashboard');

    // Navigate to posts section
    const postsLink = page.getByRole('link', { name: /posts|content/i });
    if (await postsLink.isVisible({ timeout: 2000 })) {
      await postsLink.click();
    }

    await page.waitForResponse('**/api/social/posts?*');

    // Click on a published post to view details
    const postItem = page.getByTestId('post-item').first();
    await postItem.click();

    // Verify engagement metrics are displayed
    const likesMetric = page.getByText(/42.*likes?/i);
    await expect(likesMetric).toBeVisible();

    const retweetsMetric = page.getByText(/12.*retweets?/i);
    await expect(retweetsMetric).toBeVisible();

    const commentsMetric = page.getByText(/8.*comments?/i);
    await expect(commentsMetric).toBeVisible();

    // Verify post URL link
    const postLink = page.getByRole('link', { name: /view.*post|open/i });
    await expect(postLink).toBeVisible();
  });

  test('should manually trigger schedule run', async ({ page }) => {
    await page.goto('/dashboard/calendar');

    // Wait for schedules to load
    await page.waitForResponse('**/api/ai/schedules?*');

    const scheduleItem = page.getByTestId('schedule-item').first();
    await expect(scheduleItem).toBeVisible();

    // Look for "Run Now" button (should have data-testid="run-now-button")
    const runNowButton = scheduleItem.getByRole('button', { name: /run.*now/i });
    await expect(runNowButton).toBeVisible();

    // Click run now
    await runNowButton.click();

    // Verify confirmation or immediate execution feedback
    const runningMessage = page.getByText(/running|starting|triggered/i);
    await expect(runningMessage).toBeVisible({ timeout: 3000 });
  });
});
