/**
 * Goal Creation E2E tests.
 */
import { test, expect } from "@playwright/test";
import { setupMocks, loginAsTestUser } from "./fixtures/mocks";

test.describe("Goal Creation (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await setupMocks(page);
    // visit dashboard first so "← 返回" has a real history
    await page.goto("/dashboard");
    await expect(page.getByText("反旗")).toBeVisible({ timeout: 8000 });
    await page.goto("/goals/new");
  });

  test("renders step 1 — goal type selection", async ({ page }) => {
    await expect(page.getByText(/早起/).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("can select a goal type and advance to step 2", async ({ page }) => {
    await page.getByText(/早起/).first().click();
    await expect(page.getByText(/难度|困难|轻松|中等/i).first()).toBeVisible({
      timeout: 3000,
    });
  });

  test("can select difficulty and advance to step 3", async ({ page }) => {
    await page.getByText(/早起/).first().click();
    await expect(page.getByText(/难度|困难|轻松|中等/i).first()).toBeVisible({
      timeout: 3000,
    });
    await page
      .getByText(/轻松|中等|困难/)
      .first()
      .click();
    await expect(page.getByText(/时间|几点|时刻/i).first()).toBeVisible({
      timeout: 3000,
    });
  });

  test("full creation flow — step 1 through 3", async ({ page }) => {
    // Step 1: select goal type
    await page.getByText(/早起/).first().click();
    await expect(page.getByText(/难度|困难|轻松|中等/i).first()).toBeVisible({
      timeout: 3000,
    });

    // Step 2: select difficulty
    await page
      .getByText(/轻松|中等|困难/)
      .first()
      .click();
    await expect(page.getByText(/时间|几点|时刻/i).first()).toBeVisible({
      timeout: 3000,
    });

    // Step 3: set time and submit
    const timeInput = page.locator('input[type="time"]');
    if (await timeInput.isVisible()) {
      await timeInput.fill("08:00");
    }

    const submitBtn = page.getByRole("button", {
      name: /立好|开干/i,
    });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // After submission the page should show loading or leave
    await page.waitForTimeout(2000);
  });

  test("back button returns to previous page", async ({ page }) => {
    const backBtn = page.getByText("← 返回");
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });
});
