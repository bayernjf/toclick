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
    // GoalCard 在未打卡目标上固定渲染「🌴 今天休息」，
    // mock 的 goal-002 永不含今日记录，按钮必然存在。
    const skipBtn = page.getByRole("button", { name: /休息/ }).first();
    await expect(skipBtn).toBeVisible({ timeout: 8000 });
  });

  test("clicking skip calls API and receives correct response", async ({
    page,
  }) => {
    const skipBtn = page.getByRole("button", { name: /休息/ }).first();
    await expect(skipBtn).toBeVisible({ timeout: 8000 });

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
    const skipBtn = page.getByRole("button", { name: /休息/ }).first();
    await expect(skipBtn).toBeVisible({ timeout: 8000 });

    await skipBtn.click();

    // Toast should appear after the API call + loadGoals() completes
    await expect(page.getByText("休息日已标记")).toBeVisible({
      timeout: 8000,
    });
  });
});
