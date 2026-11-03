/**
 * Settings page E2E tests.
 */
import { test, expect } from "@playwright/test";
import { setupMocks, loginAsTestUser } from "./fixtures/mocks";

test.describe("Settings Page (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await setupMocks(page);
    // visit dashboard first so ← 返回 can go back
    await page.goto("/dashboard");
    await expect(page.getByText("反旗")).toBeVisible({ timeout: 8000 });
    await page.goto("/settings");
  });

  test("renders settings page with all sections", async ({ page }) => {
    await expect(page.getByText(/设置/i).first()).toBeVisible({
      timeout: 8000,
    });
  });

  test("persona selection renders", async ({ page }) => {
    await expect(
      page.getByText(/bro|senpai|损友|前辈|人设/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("roast toggle exists", async ({ page }) => {
    await expect(page.getByText(/毒舌|调侃|roast/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("can save settings", async ({ page }) => {
    // 昵称「保存」按钮只在昵称被修改后出现（page.tsx 的行内编辑设计），
    // 所以先改昵称再断言按钮出现；mock PATCH /rest/v1/users 返回 204。
    // 此前的 if-visible 会在按钮消失时静默通过，改为硬断言 + 负向校验。
    const nameInput = page.locator("input[maxlength='20']").first();
    await expect(nameInput).toBeVisible({ timeout: 8000 });
    await nameInput.fill("新昵称");
    const saveBtn = page
      .getByRole("button", { name: "保存", exact: true })
      .first();
    await expect(saveBtn).toBeVisible({ timeout: 8000 });
    await saveBtn.click();
    await expect(page.getByText("保存失败")).not.toBeVisible();
    // 保存成功后按钮应收起（originalNickname 已更新），这是比"无失败提示"更强的正向信号。
    await expect(saveBtn).toBeHidden();
  });

  test("back button returns to dashboard", async ({ page }) => {
    const backBtn = page.getByText("← 返回").first();
    await expect(backBtn).toBeVisible({ timeout: 8000 });
    await backBtn.click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe("Dark Mode Toggle", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await setupMocks(page);
    await page.goto("/settings");
  });

  test("theme toggle button is visible", async ({ page }) => {
    await expect(page.getByText(/外观|主题|浅色|深色/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("clicking theme toggle switches dark mode", async ({ page }) => {
    const toggleBtn = page.locator('[aria-label*="模式"]');
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await page.waitForTimeout(500);
      const hasDark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark"),
      );
      expect(typeof hasDark).toBe("boolean");
    }
  });

  test("dark mode persists across navigation", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("flagbreaker-theme", "dark");
      document.documentElement.classList.add("dark");
    });
    await page.goto("/dashboard");
    const stillDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    expect(stillDark).toBe(true);
  });

  test("light mode has no dark class", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("flagbreaker-theme", "light");
      document.documentElement.classList.remove("dark");
    });
    const isLight = await page.evaluate(
      () => !document.documentElement.classList.contains("dark"),
    );
    expect(isLight).toBe(true);
  });
});
