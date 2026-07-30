import { test, expect } from "@playwright/test";
import { setupMocks, loginAsTestUser } from "./fixtures/mocks";

test.describe("Screenshot Share (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the Web Share API
    await page.addInitScript(() => {
      (window as any).navigator.share = () => Promise.resolve();
    });

    await setupMocks(page);
    await loginAsTestUser(page);
    await page.goto("/dashboard");
    await expect(page.locator("text=反旗")).toBeVisible({ timeout: 8000 });
  });

  test("share button appears after check-in feedback", async ({ page }) => {
    // Click the check-in button to trigger AI feedback modal
    const checkinButton = page.getByText("✓ 打了").first();
    const isVisible = await checkinButton.isVisible().catch(() => false);
    if (!isVisible) {
      // Try other checkin button texts
      const altButton = page.locator("button").filter({
        hasText: /打了|提前打了|补打/,
      });
      const count = await altButton.count();
      if (count === 0) {
        test.skip(true, "No check-in button available in current time window");
        return;
      }
      await altButton.first().click();
    } else {
      await checkinButton.click();
    }

    // Wait for AI feedback modal to appear
    await expect(page.getByText("📸 截图分享")).toBeVisible({
      timeout: 8000,
    });
  });

  test("share button clicks without error", async ({ page }) => {
    // Trigger check-in
    const btn = page.locator("button").filter({
      hasText: /打了|提前打了|补打/,
    });
    const count = await btn.count();
    if (count === 0) {
      test.skip(true, "No check-in button available");
      return;
    }
    await btn.first().click();

    // Wait for share button
    await expect(page.getByText("📸 截图分享")).toBeVisible({
      timeout: 8000,
    });

    // Click share - should not error (navigator.share is mocked)
    await page.getByText("📸 截图分享").click();

    // The share should not produce visible errors
    await expect(page.getByText("📸 截图分享")).toBeVisible();
  });
});
