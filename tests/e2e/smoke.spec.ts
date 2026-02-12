/**
 * Smoke Tests
 * Basic E2E tests to verify the application loads correctly
 */

import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should load the landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
  });

  test("should have correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ozskr\.ai/);
  });

  test("should display hero text", async ({ page }) => {
    await page.goto("/");
    const heroText = page.locator("text=ozskr.ai");
    await expect(heroText.first()).toBeVisible();
  });
});

test.describe("Health API", () => {
  test("should return ok status", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const json = await response.json();
    expect(json).toHaveProperty("status", "ok");
  });
});
