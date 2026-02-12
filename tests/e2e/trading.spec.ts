/**
 * Trading E2E Tests
 * Tests for Jupiter Ultra integration and token swaps
 */

import { test, expect } from '@playwright/test';
import { setupWalletMock, mockAuthenticatedSession } from './helpers/wallet-mock';
import { setupApiMocks } from './helpers/api-mocks';

test.describe('Trading', () => {
  test.beforeEach(async ({ page }) => {
    await setupWalletMock(page);
    await mockAuthenticatedSession(page);
    await setupApiMocks(page);
  });

  test('should navigate to trade page', async ({ page }) => {
    await page.goto('/dashboard');

    // Click on trade navigation link
    const tradeLink = page.getByRole('link', { name: /trade|swap/i });
    await expect(tradeLink).toBeVisible();
    await tradeLink.click();

    // Verify we're on trade page
    await expect(page).toHaveURL('/dashboard/trade');

    // Verify trade interface loads
    const tradeHeading = page.getByRole('heading', { name: /trade|swap/i });
    await expect(tradeHeading).toBeVisible();
  });

  test('should display token pair selector', async ({ page }) => {
    await page.goto('/dashboard/trade');

    // Verify input token selector (should have data-testid="input-token-select")
    const inputTokenSelect = page.getByTestId('input-token-select');
    await expect(inputTokenSelect).toBeVisible();

    // Verify output token selector (should have data-testid="output-token-select")
    const outputTokenSelect = page.getByTestId('output-token-select');
    await expect(outputTokenSelect).toBeVisible();

    // Verify swap direction button exists
    const swapDirectionButton = page.getByRole('button', { name: /swap direction|reverse/i });
    await expect(swapDirectionButton).toBeVisible();
  });

  test('should get swap quote when amount entered', async ({ page }) => {
    await page.goto('/dashboard/trade');

    // Enter amount to swap (should have data-testid="swap-amount-input")
    const amountInput = page.getByTestId('swap-amount-input');
    await expect(amountInput).toBeVisible();
    await amountInput.fill('1.5');

    // Wait for quote API call
    const quoteResponse = page.waitForResponse('**/api/trading/quote*');

    // Trigger quote fetch (may happen automatically on input change)
    await page.keyboard.press('Tab');

    // Wait for quote response
    await quoteResponse;

    // Verify quote preview renders (should have data-testid="quote-preview")
    const quotePreview = page.getByTestId('quote-preview');
    await expect(quotePreview).toBeVisible({ timeout: 3000 });

    // Verify estimated output amount is displayed
    const outputAmount = page.getByText(/you.*receive|estimated output/i);
    await expect(outputAmount).toBeVisible();
  });

  test('should show quote details', async ({ page }) => {
    await page.goto('/dashboard/trade');

    // Enter amount and get quote
    const amountInput = page.getByTestId('swap-amount-input');
    await amountInput.fill('2.0');

    // Wait for quote
    await page.waitForResponse('**/api/trading/quote*');

    const quotePreview = page.getByTestId('quote-preview');
    await expect(quotePreview).toBeVisible({ timeout: 3000 });

    // Verify slippage display
    const slippageInfo = page.getByText(/slippage.*50.*bps|0\.5%/i);
    await expect(slippageInfo).toBeVisible();

    // Verify fee display
    const feeInfo = page.getByText(/fee.*0\.05/i);
    await expect(feeInfo).toBeVisible();

    // Verify minimum received display
    const minReceived = page.getByText(/minimum.*received/i);
    await expect(minReceived).toBeVisible();

    // Verify price impact display
    const priceImpact = page.getByText(/price.*impact.*0\.12%/i);
    await expect(priceImpact).toBeVisible();
  });

  test('should show slippage settings', async ({ page }) => {
    await page.goto('/dashboard/trade');

    // Look for settings/slippage button (should have data-testid="slippage-settings-button")
    const settingsButton = page.getByTestId('slippage-settings-button');
    await expect(settingsButton).toBeVisible();

    // Click to open slippage settings
    await settingsButton.click();

    // Verify slippage input or preset options
    const slippageInput = page.getByLabel(/slippage.*tolerance/i);
    await expect(slippageInput).toBeVisible();

    // Verify preset slippage buttons (0.1%, 0.5%, 1%)
    const preset05 = page.getByRole('button', { name: /0\.5%/i });
    await expect(preset05).toBeVisible();
  });

  test('should execute swap transaction', async ({ page }) => {
    await page.goto('/dashboard/trade');

    // Enter amount and get quote
    const amountInput = page.getByTestId('swap-amount-input');
    await amountInput.fill('1.0');

    await page.waitForResponse('**/api/trading/quote*');

    // Wait for quote to load
    const quotePreview = page.getByTestId('quote-preview');
    await expect(quotePreview).toBeVisible({ timeout: 3000 });

    // Click swap button (should have data-testid="execute-swap-button")
    const swapButton = page.getByRole('button', { name: /swap|execute/i });
    await expect(swapButton).toBeEnabled();
    await swapButton.click();

    // Verify confirmation modal appears
    const confirmModal = page.getByRole('dialog', { name: /confirm.*swap/i });
    await expect(confirmModal).toBeVisible();

    // Verify swap details in confirmation
    const confirmDetails = page.getByText(/you.*pay.*1\.0/i);
    await expect(confirmDetails).toBeVisible();

    // Click confirm button in modal
    const confirmButton = page.getByRole('button', { name: /confirm|approve/i }).last();
    await confirmButton.click();

    // Wait for swap API call
    await page.waitForResponse('**/api/trading/swap');

    // Verify success message or transaction status
    const successMessage = page.getByText(/swap.*submitted|transaction.*pending/i);
    await expect(successMessage).toBeVisible({ timeout: 5000 });
  });

  test('should show swap history', async ({ page }) => {
    await page.goto('/dashboard/trade');

    // Look for history section (should have data-testid="swap-history")
    const historySection = page.getByTestId('swap-history');

    // History might be in a tab or separate section
    if (!(await historySection.isVisible({ timeout: 1000 }))) {
      const historyTab = page.getByRole('tab', { name: /history/i });
      if (await historyTab.isVisible({ timeout: 1000 })) {
        await historyTab.click();
        await expect(historySection).toBeVisible();
      }
    }

    // Verify history table columns
    const transactionColumn = page.getByText(/transaction|signature/i);
    const statusColumn = page.getByText(/status/i);
    const amountColumn = page.getByText(/amount|input/i);

    await expect(transactionColumn).toBeVisible();
    await expect(statusColumn).toBeVisible();
    await expect(amountColumn).toBeVisible();
  });

  test('should display portfolio balances', async ({ page }) => {
    await page.goto('/dashboard');

    // Navigate to portfolio page
    const portfolioLink = page.getByRole('link', { name: /portfolio/i });
    await expect(portfolioLink).toBeVisible();
    await portfolioLink.click();

    // Verify we're on portfolio page
    await expect(page).toHaveURL('/dashboard/portfolio');

    // Wait for portfolio API call
    await page.waitForResponse('**/api/trading/portfolio');

    // Verify portfolio heading
    const portfolioHeading = page.getByRole('heading', { name: /portfolio|your.*tokens/i });
    await expect(portfolioHeading).toBeVisible();

    // Verify token balance cards/rows (should have data-testid="token-balance-item")
    const tokenBalanceItem = page.getByTestId('token-balance-item').first();
    await expect(tokenBalanceItem).toBeVisible();

    // Verify SOL balance is displayed
    const solBalance = page.getByText(/SOL.*5\.0/i);
    await expect(solBalance).toBeVisible();

    // Verify USDC balance is displayed
    const usdcBalance = page.getByText(/USDC.*1,?500/i);
    await expect(usdcBalance).toBeVisible();

    // Verify total portfolio value
    const totalValue = page.getByText(/total.*value.*2,?000/i);
    await expect(totalValue).toBeVisible();
  });

  test('should show insufficient balance warning', async ({ page }) => {
    await page.goto('/dashboard/trade');

    // Enter amount higher than available balance
    const amountInput = page.getByTestId('swap-amount-input');
    await amountInput.fill('999999');

    // Trigger validation
    await page.keyboard.press('Tab');

    // Verify error message appears
    const errorMessage = page.getByText(/insufficient.*balance/i);
    await expect(errorMessage).toBeVisible({ timeout: 2000 });

    // Verify swap button is disabled
    const swapButton = page.getByRole('button', { name: /swap|execute/i });
    await expect(swapButton).toBeDisabled();
  });

  test('should refresh quote periodically', async ({ page }) => {
    await page.goto('/dashboard/trade');

    // Enter amount to get initial quote
    const amountInput = page.getByTestId('swap-amount-input');
    await amountInput.fill('1.0');

    // Wait for first quote
    await page.waitForResponse('**/api/trading/quote*');

    const quotePreview = page.getByTestId('quote-preview');
    await expect(quotePreview).toBeVisible();

    // Verify refresh indicator or countdown
    const refreshIndicator = page.getByText(/refresh.*in|updating/i);
    if (await refreshIndicator.isVisible({ timeout: 1000 })) {
      await expect(refreshIndicator).toBeVisible();
    }

    // Wait for auto-refresh to trigger another quote request
    const secondQuote = page.waitForResponse('**/api/trading/quote*', { timeout: 15000 });
    await secondQuote;

    // Verify quote is still displayed after refresh
    await expect(quotePreview).toBeVisible();
  });
});
