import { defineConfig, devices } from "@playwright/test";

const PORT = 4321;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  /* max test timeout */
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    // mobile-first viewport mimicking iPhone 14
    viewport: { width: 390, height: 844 },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    /* Suppress PWA/permission console noise */
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["iPhone 14"],
        // force Chromium even though iPhone 14 device defaults to WebKit
        browserName: "chromium",
      },
    },
  ],

  webServer: [
    {
      command: `npx next dev --port ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost:19999",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
        NEXT_PUBLIC_SITE_URL: BASE_URL,
        // prevent API routes from calling real 豆包
        ARK_API_KEY: "",
        ARK_BASE_URL: "",
        ARK_MODEL: "",
        CRON_SECRET: "test-cron-secret",
      },
    },
    {
      command: "./node_modules/.bin/tsx e2e/fixtures/mock-server.ts",
      url: "http://localhost:19999/auth/v1/user",
      reuseExistingServer: !process.env.CI,
      timeout: 10_000,
    },
  ],
});
