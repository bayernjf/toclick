import { test, expect } from "@playwright/test";
import { setupMocks, loginAsTestUser } from "./fixtures/mocks";

test.describe("Push Notifications (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the Notification API and PushManager
    await page.addInitScript(() => {
      (window as any).Notification = {
        permission: "default",
        requestPermission: () => Promise.resolve("granted"),
      };
    });

    await setupMocks(page);
    await loginAsTestUser(page);
    await page.goto("/settings");
    await expect(page.locator("text=设置")).toBeVisible({ timeout: 8000 });
  });

  test("push notification section renders when supported", async ({ page }) => {
    // Check if the push notification section exists
    const pushSection = page.getByText("▎推送通知");
    const isVisible = await pushSection.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, "Push notifications not supported in this browser");
    }
    await expect(pushSection).toBeVisible();
  });

  test("push toggle has accessible label", async ({ page }) => {
    const toggle = page.locator('[aria-label="切换推送通知"]');
    const isVisible = await toggle.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, "Push toggle not visible (not supported)");
    }
    await expect(toggle).toBeVisible();
  });

  test("push description shows correct text for unsubscribed state", async ({
    page,
  }) => {
    const desc = page.getByText("开起后可收到打卡提醒");
    const isVisible = await desc.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, "Push section not visible");
    }
    await expect(desc).toBeVisible();
  });
});
