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
    // GoalCard 在未打卡时固定渲染打卡按钮（打了/提前打了/补打），
    // mock 的 goal-002 永不含今日记录，按钮必然存在。
    const checkinButton = page
      .getByRole("button", { name: /打了|提前打了|补打/ })
      .first();
    await expect(checkinButton).toBeVisible({ timeout: 8000 });
    await checkinButton.click();

    // Wait for AI feedback modal to appear
    await expect(page.getByText("📸 截图分享")).toBeVisible({
      timeout: 8000,
    });
  });

  test("share button clicks without error", async ({ page }) => {
    // Trigger check-in
    const btn = page
      .getByRole("button", { name: /打了|提前打了|补打/ })
      .first();
    await expect(btn).toBeVisible({ timeout: 8000 });
    await btn.click();

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
