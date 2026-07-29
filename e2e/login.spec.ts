/**
 * Login page E2E tests.
 */
import { test, expect } from "@playwright/test";
import { setupMocks } from "./fixtures/mocks";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders login form with email input", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /开始立/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /发送登录链接/i }),
    ).toBeVisible();
  });

  test("shows validation error for empty email", async ({ page }) => {
    const btn = page.getByRole("button", { name: /发送登录链接/i });
    await btn.click();
    const input = page.locator('input[type="email"]');
    await expect(input).toBeVisible();
  });

  test("shows validation error for invalid email", async ({ page }) => {
    const input = page.locator('input[type="email"]');
    await input.fill("not-an-email");
    const btn = page.getByRole("button", { name: /发送登录链接/i });
    await btn.click();
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("not-an-email");
  });

  test("submits valid email and shows sent feedback", async ({ page }) => {
    // Set up full mocks so Supabase client can initialize + make OTP request
    await setupMocks(page);

    const input = page.locator('input[type="email"]');
    await input.fill("test@example.com");
    const btn = page.getByRole("button", { name: /发送登录链接/i });
    await btn.click();

    // Success toast: "验证邮件已发送到你的邮箱，点里面的链接登录"
    await expect(
      page.getByText(/验证邮件已发送|邮件已发送|发到你的邮箱/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test("has back link to landing page", async ({ page }) => {
    const backLink = page.getByText("← 返回");
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page).toHaveURL("/");
  });

  test("shows terms and privacy links", async ({ page }) => {
    await expect(page.getByText("用户协议")).toBeVisible();
    await expect(page.getByText("隐私政策")).toBeVisible();
  });
});
