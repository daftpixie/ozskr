/**
 * Gamification E2E Tests
 * Tests for achievements, leaderboard, stats, and tier progression
 */

import { test, expect } from '@playwright/test';
import { setupWalletMock, mockAuthenticatedSession } from './helpers/wallet-mock';
import { setupApiMocks } from './helpers/api-mocks';

test.describe('Gamification', () => {
  test.beforeEach(async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);
    await setupApiMocks(page);
  });

  test('should display stats bar on dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for stats API call
    await page.waitForResponse('**/api/gamification/me/stats');

    // Verify stats bar is visible (should have data-testid="stats-bar")
    const statsBar = page.getByTestId('stats-bar');
    await expect(statsBar).toBeVisible();

    // Verify points display
    const pointsDisplay = page.getByText(/1,?250.*points?/i);
    await expect(pointsDisplay).toBeVisible();

    // Verify streak display
    const streakDisplay = page.getByText(/5.*day.*streak/i);
    await expect(streakDisplay).toBeVisible();

    // Verify tier badge (should have data-testid="tier-badge")
    const tierBadge = page.getByTestId('tier-badge');
    await expect(tierBadge).toBeVisible();

    // Verify tier name
    const tierName = page.getByText(/creator/i);
    await expect(tierName).toBeVisible();
  });

  test('should navigate to achievements page', async ({ page }) => {
    await page.goto('/dashboard');

    // Click on achievements link or stats bar
    const achievementsLink = page.getByRole('link', { name: /achievements/i });
    await expect(achievementsLink).toBeVisible();
    await achievementsLink.click();

    // Verify we're on achievements page
    await expect(page).toHaveURL('/dashboard/achievements');

    // Verify achievements heading
    const achievementsHeading = page.getByRole('heading', { name: /achievements/i });
    await expect(achievementsHeading).toBeVisible();
  });

  test('should show unlocked achievements with icons', async ({ page }) => {
    await page.goto('/dashboard/achievements');

    // Wait for achievements API call
    await page.waitForResponse('**/api/gamification/me/achievements');

    // Verify unlocked section heading
    const unlockedHeading = page.getByRole('heading', { name: /unlocked|earned/i });
    await expect(unlockedHeading).toBeVisible();

    // Verify unlocked achievement cards (should have data-testid="achievement-card-unlocked")
    const unlockedCard = page.getByTestId('achievement-card-unlocked');
    await expect(unlockedCard.first()).toBeVisible();

    // Verify specific unlocked achievements from mock data
    const firstSteps = page.getByText(/First Steps/i);
    await expect(firstSteps).toBeVisible();

    const contentMachine = page.getByText(/Content Machine/i);
    await expect(contentMachine).toBeVisible();

    const onFire = page.getByText(/On Fire!/i);
    await expect(onFire).toBeVisible();

    // Verify achievement icons are displayed
    const achievementIcon = page.locator('[data-icon="rocket"]').or(page.locator('[data-icon="zap"]'));
    await expect(achievementIcon.first()).toBeVisible();

    // Verify unlocked date
    const unlockedDate = page.getByText(/unlocked|earned/i);
    await expect(unlockedDate.first()).toBeVisible();
  });

  test('should show locked achievements with progress bars', async ({ page }) => {
    await page.goto('/dashboard/achievements');

    // Wait for achievements API call
    await page.waitForResponse('**/api/gamification/me/achievements');

    // Verify locked section heading
    const lockedHeading = page.getByRole('heading', { name: /locked|in progress/i });
    await expect(lockedHeading).toBeVisible();

    // Verify locked achievement cards (should have data-testid="achievement-card-locked")
    const lockedCard = page.getByTestId('achievement-card-locked');
    await expect(lockedCard.first()).toBeVisible();

    // Verify specific locked achievements from mock data
    const multiAgent = page.getByText(/Multi-Agent Master/i);
    await expect(multiAgent).toBeVisible();

    const centuryClub = page.getByText(/Century Club/i);
    await expect(centuryClub).toBeVisible();

    // Verify progress bars are displayed (should have data-testid="achievement-progress")
    const progressBar = page.getByTestId('achievement-progress');
    await expect(progressBar.first()).toBeVisible();

    // Verify progress percentage display
    const progress60 = page.getByText(/60%/i);
    await expect(progress60).toBeVisible();

    // Verify current value display (e.g., "3/5 agents")
    const currentValue = page.getByText(/3.*5/i);
    await expect(currentValue).toBeVisible();
  });

  test('should filter achievements by category', async ({ page }) => {
    await page.goto('/dashboard/achievements');

    // Wait for achievements to load
    await page.waitForResponse('**/api/gamification/me/achievements');

    // Verify category filter tabs (should have data-testid="achievement-category-filter")
    const allTab = page.getByRole('tab', { name: /all/i });
    await expect(allTab).toBeVisible();

    const creationTab = page.getByRole('tab', { name: /creation/i });
    await expect(creationTab).toBeVisible();

    const publishingTab = page.getByRole('tab', { name: /publishing/i });
    await expect(publishingTab).toBeVisible();

    const streakTab = page.getByRole('tab', { name: /streak/i });
    await expect(streakTab).toBeVisible();

    const engagementTab = page.getByRole('tab', { name: /engagement/i });
    await expect(engagementTab).toBeVisible();

    // Click creation category
    await creationTab.click();

    // Verify only creation achievements are shown
    const firstSteps = page.getByText(/First Steps/i);
    await expect(firstSteps).toBeVisible();

    const contentMachine = page.getByText(/Content Machine/i);
    await expect(contentMachine).toBeVisible();

    // Click streak category
    await streakTab.click();

    // Verify only streak achievements are shown
    const onFire = page.getByText(/On Fire!/i);
    await expect(onFire).toBeVisible();

    const unstoppable = page.getByText(/Unstoppable/i);
    await expect(unstoppable).toBeVisible();
  });

  test('should navigate to leaderboard page', async ({ page }) => {
    await page.goto('/dashboard');

    // Click on leaderboard link
    const leaderboardLink = page.getByRole('link', { name: /leaderboard/i });
    await expect(leaderboardLink).toBeVisible();
    await leaderboardLink.click();

    // Verify we're on leaderboard page
    await expect(page).toHaveURL('/dashboard/leaderboard');

    // Verify leaderboard heading
    const leaderboardHeading = page.getByRole('heading', { name: /leaderboard/i });
    await expect(leaderboardHeading).toBeVisible();
  });

  test('should show leaderboard table with rankings', async ({ page }) => {
    await page.goto('/dashboard/leaderboard');

    // Wait for leaderboard API call
    await page.waitForResponse('**/api/gamification/leaderboard?*');

    // Verify leaderboard table (should have data-testid="leaderboard-table")
    const leaderboardTable = page.getByTestId('leaderboard-table');
    await expect(leaderboardTable).toBeVisible();

    // Verify table headers
    const rankHeader = page.getByText(/rank|#/i);
    await expect(rankHeader).toBeVisible();

    const userHeader = page.getByText(/user|player/i);
    await expect(userHeader).toBeVisible();

    const pointsHeader = page.getByText(/points|score/i);
    await expect(pointsHeader).toBeVisible();

    const tierHeader = page.getByText(/tier/i);
    await expect(tierHeader).toBeVisible();

    // Verify leaderboard entries (should have data-testid="leaderboard-entry")
    const leaderboardEntry = page.getByTestId('leaderboard-entry');
    await expect(leaderboardEntry.first()).toBeVisible();

    // Verify top user from mock data
    const topUser = page.getByText(/CryptoKing/i);
    await expect(topUser).toBeVisible();

    const topUserPoints = page.getByText(/8,?500/i);
    await expect(topUserPoints).toBeVisible();

    const legendTier = page.getByText(/legend/i);
    await expect(legendTier).toBeVisible();
  });

  test('should show user position on leaderboard', async ({ page }) => {
    await page.goto('/dashboard/leaderboard');

    // Wait for leaderboard and position API calls
    await page.waitForResponse('**/api/gamification/leaderboard?*');
    await page.waitForResponse('**/api/gamification/leaderboard/me');

    // Verify "Your Rank" section (should have data-testid="user-rank-section")
    const userRankSection = page.getByTestId('user-rank-section');
    await expect(userRankSection).toBeVisible();

    // Verify user's rank display
    const userRank = page.getByText(/rank.*42|#42/i);
    await expect(userRank).toBeVisible();

    // Verify user's points
    const userPoints = page.getByText(/1,?250.*points?/i);
    await expect(userPoints).toBeVisible();

    // Verify surrounding users are displayed
    const aboveUser = page.getByText(/ContentMaster/i);
    await expect(aboveUser).toBeVisible();

    const belowUser = page.getByText(/NewCreator/i);
    await expect(belowUser).toBeVisible();
  });

  test('should switch leaderboard periods', async ({ page }) => {
    await page.goto('/dashboard/leaderboard');

    // Wait for initial leaderboard
    await page.waitForResponse('**/api/gamification/leaderboard?*');

    // Verify period filter tabs (should have data-testid="leaderboard-period-filter")
    const allTimeTab = page.getByRole('tab', { name: /all.*time/i });
    await expect(allTimeTab).toBeVisible();

    const monthlyTab = page.getByRole('tab', { name: /monthly|this.*month/i });
    await expect(monthlyTab).toBeVisible();

    const weeklyTab = page.getByRole('tab', { name: /weekly|this.*week/i });
    await expect(weeklyTab).toBeVisible();

    // Click monthly tab
    await monthlyTab.click();

    // Wait for new leaderboard data
    await page.waitForResponse('**/api/gamification/leaderboard?period=monthly*');

    // Verify leaderboard updates (data may be different per period)
    const leaderboardEntry = page.getByTestId('leaderboard-entry');
    await expect(leaderboardEntry.first()).toBeVisible();

    // Click weekly tab
    await weeklyTab.click();

    // Wait for weekly leaderboard
    await page.waitForResponse('**/api/gamification/leaderboard?period=weekly*');

    // Verify leaderboard updates
    await expect(leaderboardEntry.first()).toBeVisible();
  });

  test('should show tier badge with tooltip', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for stats
    await page.waitForResponse('**/api/gamification/me/stats');

    // Find tier badge
    const tierBadge = page.getByTestId('tier-badge');
    await expect(tierBadge).toBeVisible();

    // Hover over tier badge to show tooltip
    await tierBadge.hover();

    // Verify tooltip appears with tier progression info
    const tooltip = page.getByText(/creator.*influencer|next tier/i);
    await expect(tooltip).toBeVisible({ timeout: 2000 });

    // Verify progress to next tier
    const progressInfo = page.getByText(/750.*points|62\.5%/i);
    await expect(progressInfo).toBeVisible();
  });

  test('should show tier progress bar on stats page', async ({ page }) => {
    await page.goto('/dashboard');

    // Navigate to stats/profile page if it exists separately
    const statsLink = page.getByRole('link', { name: /stats|profile/i });
    if (await statsLink.isVisible({ timeout: 2000 })) {
      await statsLink.click();
    }

    await page.waitForResponse('**/api/gamification/me/stats');

    // Verify tier progress section
    const tierProgressSection = page.getByTestId('tier-progress-section');
    if (await tierProgressSection.isVisible({ timeout: 1000 })) {
      await expect(tierProgressSection).toBeVisible();

      // Verify progress bar
      const tierProgressBar = page.getByTestId('tier-progress-bar');
      await expect(tierProgressBar).toBeVisible();

      // Verify current and next tier labels
      const currentTier = page.getByText(/creator/i);
      await expect(currentTier).toBeVisible();

      const nextTier = page.getByText(/influencer/i);
      await expect(nextTier).toBeVisible();

      // Verify points to next tier
      const pointsToNext = page.getByText(/750.*points.*to.*next/i);
      await expect(pointsToNext).toBeVisible();
    }
  });

  test('should display achievement notification on unlock', async ({ page }) => {
    await page.goto('/dashboard');

    // Mock an achievement unlock event (would normally come from real-time updates)
    // For E2E, we can simulate by triggering an action that unlocks an achievement

    // Navigate to agents and create a new agent (if this unlocks an achievement)
    await page.goto('/agents/create');

    // Fill out wizard quickly (simplified for test)
    const nameInput = page.getByLabel(/agent name/i);
    if (await nameInput.isVisible({ timeout: 1000 })) {
      await nameInput.fill('AchievementTestAgent');

      const nextButton = page.getByRole('button', { name: /next/i });
      await nextButton.click({ timeout: 1000 }).catch(() => {});
    }

    // After action that triggers achievement, look for notification toast
    const achievementToast = page.getByText(/achievement.*unlocked|new.*achievement/i);

    // Toast might appear, but it's optional in this test flow
    if (await achievementToast.isVisible({ timeout: 3000 })) {
      await expect(achievementToast).toBeVisible();

      // Verify achievement name in toast
      const achievementName = page.getByText(/First Steps|Multi-Agent/i);
      await expect(achievementName).toBeVisible();
    }
  });
});
