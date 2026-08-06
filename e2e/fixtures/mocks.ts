/**
 * E2E test fixtures — mocks for app API routes + auth cookie helpers.
 *
 * Supabase auth/postgrest requests go directly to the mock HTTP server
 * at http://localhost:19999 (see mock-server.ts). This is more reliable
 * than page.route() which can break after React Fast Refresh.
 *
 * Only the app's own API routes (/api/checkin, etc.) are intercepted
 * with page.route() since they go through the Next.js server.
 */
import type { Page } from "@playwright/test";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function encodeSessionCookie(session: Record<string, unknown>): string {
  // @supabase/ssr 0.5.x expects base64url-encoded cookie values with "base64-" prefix
  const base64url = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `base64-${base64url}`;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const MOCK_USER_ID = "e0000000-0000-4000-a000-000000000000";

/** AI feedback mock used by dashboard check-in flow */
export const MOCK_AI_FEEDBACK = {
  ok: true,
  feedback: "今天的你有点东西嘛！继续保持⛽️",
  persona: "bro",
  note: null,
};

const MOCK_AI_FEEDBACK_NOTE = {
  ok: true,
  message: "反应已保存",
};

/* ------------------------------------------------------------------ */
/*  Mock route handlers                                                */
/* ------------------------------------------------------------------ */

/**
 * Intercept app API routes that the browser calls.
 * Call this once per test in beforeEach, AFTER loginAsTestUser().
 */
export async function setupMocks(page: Page) {
  // ----- Check-in API -----
  await page.route("**/api/checkin", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_AI_FEEDBACK),
    });
  });

  // ----- AI feedback reactions (save note) -----
  await page.route("**/api/ai-feedback", async (route) => {
    const method = route.request().method();
    if (method === "PATCH") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_AI_FEEDBACK_NOTE),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  // ----- Offline check-in sync -----
  await page.route("**/api/checkin/sync", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, synced: 0 }),
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Auth helpers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Seed a fake Supabase session cookie so server + client treat the
 * user as logged in. Must be called BEFORE navigating.
 *
 * @supabase/ssr cookie name: `sb-{hostname-split0}-auth-token`
 *   For SUPABASE_URL=http://localhost:19999 → sb-localhost-auth-token
 *
 * @supabase/ssr@0.5.2 encodes cookie values as base64url with "base64-" prefix.
 */
export async function loginAsTestUser(page: Page) {
  const sessionData = {
    access_token: "mock-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "mock-refresh-token",
    user: {
      id: MOCK_USER_ID,
      email: "test@example.com",
      role: "authenticated",
      aud: "authenticated",
    },
  };

  await page.context().addCookies([
    {
      name: "sb-localhost-auth-token",
      value: encodeSessionCookie(sessionData),
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    },
  ]);
}
