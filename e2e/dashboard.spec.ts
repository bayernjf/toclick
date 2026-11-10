/**
 * Dashboard E2E tests.
 */
import { test, expect } from "@playwright/test";
import {
  setupMocks,
  loginAsTestUser,
  MOCK_AI_FEEDBACK,
} from "./fixtures/mocks";

test.describe("Dashboard (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await setupMocks(page);
  });

  test("renders goal cards after login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("反旗")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/早起/).first()).toBeVisible({ timeout: 8000 });
  });

  test("shows multiple goals when more than one exists", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/早起/).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/锻炼|运动|健身/).first()).toBeVisible();
  });

  test("shows streak info on goal card", async ({ page }) => {
    await page.goto("/dashboard");
    // streak is shown as "连续 X 天" on the card
    await expect(page.getByText(/连续 3 天/).first()).toBeVisible({
      timeout: 8000,
    });
  });
});

test.describe("Check-in Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await setupMocks(page);
    await page.goto("/dashboard");
    await expect(page.getByText(/早起/).first()).toBeVisible({ timeout: 8000 });
  });

  test("check-in button triggers AI feedback modal", async ({ page }) => {
    // 真实按钮文案见 GoalCard：「✓ 提前打了」/「✓ 打了」/「⚠ 超时了，赶紧补打」
    // （此前用 /签到|打卡/ 匹配不到任何按钮，配合静默 return 等于没测）
    const checkinBtn = page
      .getByRole("button", { name: /打了|补打/ })
      .first();
    await expect(checkinBtn).toBeVisible({ timeout: 8000 });
    await checkinBtn.click();
    await expect(page.getByText(MOCK_AI_FEEDBACK.feedback).first()).toBeVisible(
      { timeout: 5000 },
    );
  });

  test("can react to AI feedback", async ({ page }) => {
    const checkinBtn = page
      .getByRole("button", { name: /打了|补打/ })
      .first();
    await expect(checkinBtn).toBeVisible({ timeout: 8000 });
    await checkinBtn.click();
    await expect(page.getByText(MOCK_AI_FEEDBACK.feedback).first()).toBeVisible(
      { timeout: 5000 },
    );

    // AIFeedbackCard 的反应按钮：😂 / 👎（断言真实存在并可点击）
    const likedBtn = page.getByRole("button", { name: "😂", exact: true });
    const dislikedBtn = page.getByRole("button", { name: "👎", exact: true });
    await expect(likedBtn).toBeVisible();
    await expect(dislikedBtn).toBeVisible();
    await likedBtn.click();
  });

  test("can dismiss AI feedback modal", async ({ page }) => {
    const checkinBtn = page
      .getByRole("button", { name: /打了|补打/ })
      .first();
    await expect(checkinBtn).toBeVisible({ timeout: 8000 });
    await checkinBtn.click();
    await expect(page.getByText(MOCK_AI_FEEDBACK.feedback).first()).toBeVisible(
      { timeout: 5000 },
    );

    // AIFeedbackCard 的关闭按钮文案是「知道了」
    const closeBtn = page.getByRole("button", { name: "知道了" });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(
      page.getByText(MOCK_AI_FEEDBACK.feedback),
    ).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe("Dashboard Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await setupMocks(page);
    await page.goto("/dashboard");
    await expect(page.getByText("反旗")).toBeVisible({ timeout: 8000 });
  });

  test("settings gear icon is present", async ({ page }) => {
    // The settings link is an emoji icon in the header menu
    const settingsLink = page.locator("header a[href='/settings']").first();
    // The link may be present but small; just verify it exists in DOM
    await expect(settingsLink).toHaveCount(1, { timeout: 5000 });
  });

  test("sign out button exists in header", async ({ page }) => {
    const logoutBtn = page.getByText("退出");
    await expect(logoutBtn).toBeVisible();
  });
});
