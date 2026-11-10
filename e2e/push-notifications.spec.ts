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
    // chromium 下 serviceWorker + PushManager 均存在，supported 必为 true；
    // 此前的 test.skip 分支会在 UI 意外消失时绿掉，改为硬断言。
    const pushSection = page.getByText("▎推送通知");
    await expect(pushSection).toBeVisible({ timeout: 8000 });
  });

  test("push toggle has accessible label", async ({ page }) => {
    const toggle = page.locator('[aria-label="切换推送通知"]');
    await expect(toggle).toBeVisible({ timeout: 8000 });
  });

  test("push description shows correct text for unsubscribed state", async ({
    page,
  }) => {
    const desc = page.getByText("开起后可收到打卡提醒");
    await expect(desc).toBeVisible({ timeout: 8000 });
  });
});
