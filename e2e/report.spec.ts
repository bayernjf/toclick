/**
 * Weekly Report page E2E tests.
 */
import { test, expect } from "@playwright/test";
import { setupMocks, loginAsTestUser } from "./fixtures/mocks";

test.describe("Weekly Report (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await setupMocks(page);
    // visit dashboard first so ← 返回 can go back
    await page.goto("/dashboard");
    await expect(page.getByText("反旗")).toBeVisible({ timeout: 8000 });
    await page.goto("/report");
  });

  test("renders the report page header", async ({ page }) => {
    await expect(page.getByText(/周报|报告|report/i).first()).toBeVisible({
      timeout: 8000,
    });
  });

  test("shows weekly stats summary", async ({ page }) => {
    await expect(
      page.getByText(/周|统计数据|打卡率|完成率|统计/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });

  test("has navigation to switch weeks", async ({ page }) => {
    // mock 提供两周报告（2026-07-13 与 2026-07-20 起），周导航必然渲染；
    // 断言真实存在并验证切换生效（此前 expect(count >= 0) 恒真）。
    const prevBtn = page.getByRole("button", { name: "← 上一周" });
    const nextBtn = page.getByRole("button", { name: "下一周 →" });
    await expect(prevBtn).toBeVisible({ timeout: 8000 });
    await expect(nextBtn).toBeVisible();

    await expect(page.getByText(/2026-07-20\s*~\s*2026-07-26/)).toBeVisible();
    await prevBtn.click();
    await expect(page.getByText(/2026-07-13\s*~\s*2026-07-19/)).toBeVisible();
    await nextBtn.click();
    await expect(page.getByText(/2026-07-20\s*~\s*2026-07-26/)).toBeVisible();
  });

  test("shows AI commentary from the report", async ({ page }) => {
    // mock 的 weekly_reports.ai_comment 原文（形状已与 schema 对齐）
    await expect(
      page.getByText("这周表现不错，下周期待你保持！"),
    ).toBeVisible({ timeout: 8000 });
  });

  test("back button returns to dashboard", async ({ page }) => {
    const backBtn = page.getByText("← 返回").first();
    await expect(backBtn).toBeVisible({ timeout: 8000 });
    await backBtn.click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
