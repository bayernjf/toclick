/**
 * API-layer E2E tests — hit the REAL Next.js route handlers without
 * page.route() interception (Supabase calls land on the mock server at
 * :19999). This is the layer that would have caught P1-1/P1-2/P1-3:
 * browser specs mock /api/* away and can never see server-side regressions.
 */
import { test, expect } from "@playwright/test";
import { authCookieHeader } from "./fixtures/mocks";
import { todayInAppTz } from "../src/lib/dates";

const CRON_SECRET = "test-cron-secret"; // playwright.config.ts webServer env
const GOAL_ID = "a0000000-0000-4000-a000-000000000000"; // → mock goal-001

test.describe("/api/cron (real route handler)", () => {
  test("rejects an invalid body with 400", async ({ request }) => {
    const res = await request.post("/api/cron", { data: {} });
    expect(res.status()).toBe(400);
  });

  test("rejects a wrong secret with 401", async ({ request }) => {
    const res = await request.post("/api/cron", {
      data: { secret: "wrong-secret" },
    });
    expect(res.status()).toBe(401);
  });

  test("runs the failure-marking pipeline end to end", async ({ request }) => {
    const res = await request.post("/api/cron", {
      data: { secret: CRON_SECRET },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    // 日期必须按 app 时区（Asia/Shanghai）而非 UTC
    expect(body.date).toBe(todayInAppTz());
    expect(body.total_goals).toBe(2);
    expect(body.details).toHaveLength(2);
    // 每个目标都要落在确定性分支上（取决于运行时刻是否过了打卡点）
    for (const d of body.details) {
      expect(["skipped", "failed"]).toContain(d.status);
    }
    expect(body.failed + body.skipped + body.errors).toBe(2);
    // P1-2 回归钉：被标失败的目标必须携带推送所需字段
    for (const d of body.details) {
      if (d.status === "failed") {
        expect(d.user_id).toBeTruthy();
        expect(d.goal_type).toBeTruthy();
      }
    }
    expect(typeof body.push_sent).toBe("number");
  });
});

test.describe("/api/checkin (real route handler)", () => {
  test("rejects unauthenticated requests with 401", async ({ request }) => {
    const res = await request.post("/api/checkin", {
      data: { goal_id: GOAL_ID },
    });
    expect(res.status()).toBe(401);
  });

  test("rejects an invalid body with 400", async ({ request }) => {
    const res = await request.post("/api/checkin", {
      headers: { cookie: authCookieHeader() },
      data: { goal_id: "not-a-uuid" },
    });
    expect(res.status()).toBe(400);
  });

  test("completes a check-in through the real handler", async ({ request }) => {
    const res = await request.post("/api/checkin", {
      headers: { cookie: authCookieHeader() },
      data: { goal_id: GOAL_ID },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    // mock goal-001 current_streak = 3 → 打卡后 +1
    expect(body.streak).toBe(4);
    expect(body.checkin_id).toBeTruthy();
    // ARK_API_KEY 在 e2e 环境为空 → 不调 AI
    expect(body.feedback).toBeNull();
  });
});
