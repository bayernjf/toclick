/**
 * Landing page E2E tests.
 *
 * No auth cookie — the landing page is for unauthenticated users.
 */
import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any cookies to ensure unauthenticated state
    await page.context().clearCookies();
  });

  test("renders the landing page with app name", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("反旗")).toBeVisible();
    // Landing page shows call-to-action links to /login
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();
  });

  test("call-to-action link points to /login", async ({ page }) => {
    await page.goto("/");
    const startLink = page.locator('a[href="/login"]').first();
    await expect(startLink).toBeVisible();
  });

  test("page shows marketing copy", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText(/立 flag 的人千千万|嘴毒心软|AI 损友/i).first(),
    ).toBeVisible();
  });
});
