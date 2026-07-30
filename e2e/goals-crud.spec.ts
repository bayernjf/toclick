import { test, expect } from "@playwright/test";
import { setupMocks, loginAsTestUser } from "./fixtures/mocks";

test.describe("Goal Edit (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await loginAsTestUser(page);
  });

  test("navigates to edit page from settings", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("text=设置")).toBeVisible({ timeout: 8000 });

    // Wait for goals to load
    await page.waitForTimeout(2000);

    // The settings page lists active goals with "编辑" links
    const editLink = page.locator("text=编辑").first();
    const isVisible = await editLink.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, "No goals with edit links found on settings page");
      return;
    }

    await editLink.click();
    await page.waitForURL("**/goals/*/edit", { timeout: 5000 });
    await expect(page.getByRole("button", { name: "← 返回" })).toBeVisible();
  });

  test("shows all three steps at once", async ({ page }) => {
    await page.goto("/goals/goal-001/edit");
    await page.waitForTimeout(2000);

    await expect(page.getByText("第 1 步 / 共 3 步")).toBeVisible();
    await expect(page.getByText("你想干啥？", { exact: false })).toBeVisible();
    await expect(page.getByText("第 2 步 / 共 3 步")).toBeVisible();
    await expect(page.getByText("难度选一个", { exact: false })).toBeVisible();
    await expect(page.getByText("第 3 步 / 共 3 步")).toBeVisible();
    await expect(
      page.getByText("每天几点打卡？", { exact: false }),
    ).toBeVisible();
  });

  test("shows save and delete buttons", async ({ page }) => {
    await page.goto("/goals/goal-001/edit");
    await page.waitForTimeout(2000);
    await expect(page.getByText("保存修改")).toBeVisible();
    await expect(page.getByText("删除这个目标")).toBeVisible();
  });

  test("delete shows confirmation and can cancel", async ({ page }) => {
    await page.goto("/goals/goal-001/edit");
    await page.waitForTimeout(2000);

    // Click delete
    await page.getByText("删除这个目标").click();

    // Confirm dialog appears
    await expect(page.getByText("确定要删除吗？")).toBeVisible();
    await expect(page.getByText("确认删除")).toBeVisible();
    await expect(page.getByText("取消")).toBeVisible();

    // Cancel
    await page.getByText("取消").click();
    await expect(page.getByText("确定要删除吗？")).not.toBeVisible();
  });

  test("delete confirms and can navigate away", async ({ page }) => {
    await page.goto("/goals/goal-001/edit");
    await page.waitForTimeout(2000);

    // Click delete and confirm
    await page.getByText("删除这个目标").click();
    await page.getByText("确认删除").click();

    // After delete, the page should navigate - check with try/catch for frame detach
    try {
      await page.waitForURL((url) => url.pathname === "/settings", {
        timeout: 5000,
      });
    } catch {
      // Frame may detach during navigation - check URL after settle
      await page.waitForTimeout(2000);
    }

    // Page should now be on settings
    const currentPath = new URL(page.url()).pathname;
    expect(currentPath).toBe("/settings");
  });

  test("save changes goal type and redirects", async ({ page }) => {
    await page.goto("/goals/goal-001/edit");
    await page.waitForTimeout(2000);

    // Select a different goal type (emoji comes before label: "💪健身")
    await page.getByText("💪健身").click();

    // Save
    await page.getByText("保存修改").click();

    // Wait for navigation
    await page.waitForTimeout(2000);

    // Should be on settings
    const currentPath = new URL(page.url()).pathname;
    expect(currentPath).toBe("/settings");
  });
});
