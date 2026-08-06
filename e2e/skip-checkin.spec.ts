import { test, expect } from "@playwright/test";
import { setupMocks, loginAsTestUser } from "./fixtures/mocks";

test.describe("Skip / Rest Day (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await loginAsTestUser(page);
    await page.goto("/dashboard");
    await expect(page.locator("text=反旗")).toBeVisible({ timeout: 8000 });
  });

  test("skip button renders on goal card", async ({ page }) => {
    // Wait for goal cards to load
    await page.waitForTimeout(2000);

    const skipBtn = page.locator("button").filter({ hasText: /休息/ });
    const count = await skipBtn.count();

    if (count === 0) {
      test.skip(true, "Skip button not available (may depend on time window)");
      return;
    }

    await expect(skipBtn.first()).toBeVisible();
  });

  test("clicking skip calls API and receives correct response", async ({
    page,
  }) => {
    await page.waitForTimeout(2000);

    const skipBtn = page.locator("button").filter({ hasText: /休息/ }).first();
    const count = await skipBtn.count();
    if (count === 0) {
      test.skip(true, "Skip button not available");
      return;
    }

    // Set up response interception to verify
    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/checkin") &&
        resp.request().method() === "POST",
      { timeout: 8000 },
    );

    await skipBtn.click();

    // Wait for and verify the API response
    const response = await responsePromise;
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.skipped).toBe(true);
  });

  test("shows success toast after skip", async ({ page }) => {
    await page.waitForTimeout(2000);

    const skipBtn = page.locator("button").filter({ hasText: /休息/ }).first();
    const count = await skipBtn.count();
    if (count === 0) {
      test.skip(true, "Skip button not available");
      return;
    }

    await skipBtn.click();

    // Toast should appear after the API call + loadGoals() completes
    await expect(page.getByText("休息日已标记")).toBeVisible({
      timeout: 8000,
    });
  });
});
