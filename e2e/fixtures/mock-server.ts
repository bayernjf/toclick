/**
 * Lightweight mock Supabase server for Playwright E2E tests.
 *
 * Handles server-side Supabase calls (auth, postgrest) that happen
 * within Next.js API routes / server components — which Playwright's
 * page.route() cannot intercept.
 *
 * Browser-side calls are still intercepted by page.route() in mocks.ts.
 */
import { createServer, IncomingMessage, ServerResponse } from "http";

const PORT = 19999;

const MOCK_USER = {
  id: "e0000000-0000-4000-a000-000000000000",
  email: "test@example.com",
  role: "authenticated",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};

const MOCK_TOKEN_RESPONSE = {
  access_token: "mock-access-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "mock-refresh-token",
  user: MOCK_USER,
};

const MOCK_SESSION = {
  ...MOCK_TOKEN_RESPONSE,
};

// In-memory state for tracking checkin/skip status during tests
const goalStatusMap = new Map<string, string>(); // goalId -> today_status

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  });
  res.end(JSON.stringify(data));
}

async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || "/";
  const method = req.method || "GET";

  // Handle CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    });
    return res.end();
  }

  console.log(`[mock-supabase] ${method} ${url}`);

  // ---- Auth endpoints ----
  if (url.startsWith("/auth/v1/user")) {
    // 与真实 Supabase 一致：无有效 Bearer token 即 401，
    // 否则未登录请求也会被当成已登录，API 层测试失去意义。
    const authorization = req.headers["authorization"] || "";
    if (authorization !== `Bearer ${MOCK_TOKEN_RESPONSE.access_token}`) {
      return json(res, 401, { code: 401, message: "invalid JWT" });
    }
    return json(res, 200, MOCK_USER);
  }

  if (url.startsWith("/auth/v1/token")) {
    return json(res, 200, MOCK_TOKEN_RESPONSE);
  }

  if (url.startsWith("/auth/v1/logout")) {
    return json(res, 204, "");
  }

  if (url.startsWith("/auth/v1/otp")) {
    return json(res, 200, {});
  }

  // ---- PostgREST endpoints ----
  if (url.startsWith("/rest/v1/users")) {
    if (method === "GET") {
      const accept = req.headers["accept"] || "";
      const isSingle = accept.includes("vnd.pgrst.object+json");
      const profile = {
        id: MOCK_USER.id,
        email: MOCK_USER.email,
        nickname: "测试用户",
        age: 25,
        roast_enabled: true,
        persona: "bro",
      };
      return json(res, 200, isSingle ? profile : [profile]);
    }
    if (method === "PATCH") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
      });
      return res.end();
    }
  }

  if (url.startsWith("/rest/v1/v_today_checkins")) {
    const goals = [
      {
        goal_id: "goal-001",
        user_id: MOCK_USER.id,
        goal_type: "early_rise",
        difficulty: "medium",
        checkin_time: "08:00:00",
        current_streak: 3,
        best_streak: 5,
        is_active: true,
        created_at: "2026-07-01T00:00:00+00:00",
        checkin_id: "ci-001",
        checkin_date: "2026-07-29",
        today_status: goalStatusMap.get("goal-001") || "pending_ai_feedback",
        note: null,
      },
      {
        goal_id: "goal-002",
        user_id: MOCK_USER.id,
        goal_type: "fitness",
        difficulty: "hard",
        checkin_time: "18:00:00",
        current_streak: 0,
        best_streak: 10,
        is_active: true,
        created_at: "2026-07-10T00:00:00+00:00",
        checkin_id: null,
        checkin_date: null,
        today_status: goalStatusMap.get("goal-002") || null,
        note: null,
      },
    ];
    return json(res, 200, goals);
  }

  if (url.startsWith("/rest/v1/weekly_reports")) {
    // 形状对齐 flag_breaker_schema.sql 的 weekly_reports 真实列
    // （此前 mock 用 stats/ai_commentary/is_published，页面读不到任何字段）。
    // 两周数据：report 页的周导航只有在 >1 周时才渲染，供导航断言使用。
    if (method === "POST") {
      const body = await readBody(req);
      const data = JSON.parse(body);
      return json(res, 201, { id: `rpt-${Date.now()}`, ...data });
    }
    const reports = [
      {
        id: "rpt-001",
        user_id: MOCK_USER.id,
        goal_id: "goal-001",
        week_start: "2026-07-20",
        week_end: "2026-07-26",
        total_goals: 1,
        expected_checks: 7,
        checkins_count: 5,
        success_count: 4,
        fail_count: 1,
        max_streak: 3,
        ai_comment: "这周表现不错，下周期待你保持！",
        created_at: "2026-07-27T00:00:00+00:00",
      },
      {
        id: "rpt-002",
        user_id: MOCK_USER.id,
        goal_id: "goal-001",
        week_start: "2026-07-13",
        week_end: "2026-07-19",
        total_goals: 1,
        expected_checks: 7,
        checkins_count: 6,
        success_count: 5,
        fail_count: 1,
        max_streak: 4,
        ai_comment: "上周惨归惨，至少没全灭。",
        created_at: "2026-07-20T00:00:00+00:00",
      },
    ];
    // cron 的存在性检查带 week_start=eq. 过滤
    const urlObj = new URL(url, `http://localhost:${PORT}`);
    const weekStartFilter = urlObj.searchParams.get("week_start");
    if (weekStartFilter?.startsWith("eq.")) {
      const week = weekStartFilter.slice(3);
      return json(
        res,
        200,
        reports.filter((r) => r.week_start === week),
      );
    }
    return json(res, 200, reports);
  }

  if (url.startsWith("/rest/v1/checkins")) {
    const accept = req.headers["accept"] || "";
    const wantsObject = accept.includes("vnd.pgrst.object+json");
    const urlObj = new URL(url, `http://localhost:${PORT}`);

    // 写入路径（/api/checkin 与 /api/cron 的真实路由处理器会走到这里）
    if (method === "POST") {
      const body = await readBody(req);
      const data = JSON.parse(body);
      const row = {
        id: `ci-${Date.now()}`,
        user_id: MOCK_USER.id,
        note: null,
        created_at: new Date().toISOString(),
        ...data,
      };
      // upsert 语义：记录目标今日状态，供 v_today_checkins 反映
      if (row.goal_id && row.status) {
        goalStatusMap.set(String(row.goal_id), String(row.status));
      }
      return json(res, 201, wantsObject ? row : [row]);
    }
    if (method === "PATCH" || method === "DELETE") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
      return res.end();
    }

    // 查询路径：status 用真实枚举 success/failed/skipped（此前 mock 用
    // "done"，页面映射不到任何图标，周报统计恒为 0）
    const WEEK_ROWS = [
      {
        id: "ci-w1",
        user_id: MOCK_USER.id,
        goal_id: "goal-001",
        checkin_date: "2026-07-20",
        status: "success",
        created_at: "2026-07-20T08:00:00+00:00",
      },
      {
        id: "ci-w2",
        user_id: MOCK_USER.id,
        goal_id: "goal-001",
        checkin_date: "2026-07-21",
        status: "success",
        created_at: "2026-07-21T08:05:00+00:00",
      },
      {
        id: "ci-w3",
        user_id: MOCK_USER.id,
        goal_id: "goal-001",
        checkin_date: "2026-07-22",
        status: "success",
        created_at: "2026-07-22T08:10:00+00:00",
      },
      {
        id: "ci-w4",
        user_id: MOCK_USER.id,
        goal_id: "goal-001",
        checkin_date: "2026-07-23",
        status: "failed",
        created_at: "2026-07-23T08:00:00+00:00",
      },
      {
        id: "ci-w5",
        user_id: MOCK_USER.id,
        goal_id: "goal-001",
        checkin_date: "2026-07-24",
        status: "success",
        created_at: "2026-07-24T08:00:00+00:00",
      },
    ];

    // checkin_date=eq.<date>（cron / checkin 路由的"今天是否已打卡"查询）：
    // mock 数据里没有"今天"的记录，一律为空；maybeSingle 需要 PostgREST
    // 的 406 语义才能解析为 null。
    const dateFilters = urlObj.searchParams
      .getAll("checkin_date")
      .filter((v) => v.startsWith("eq."));
    if (dateFilters.length > 0) {
      if (wantsObject) {
        return json(res, 406, {
          code: "PGRST116",
          message: "JSON object requested, multiple (or no) rows returned",
        });
      }
      return json(res, 200, []);
    }

    return json(res, 200, WEEK_ROWS);
  }

  // ---- ai_feedback_logs 写入（/api/checkin、/api/cron）----
  if (url.startsWith("/rest/v1/ai_feedback_logs")) {
    if (method === "POST") {
      const body = await readBody(req);
      const data = JSON.parse(body);
      return json(res, 201, { id: `log-${Date.now()}`, ...data });
    }
    return json(res, 200, []);
  }

  // ---- RPC：连续失败天数（cron / ai-feedback 路由）----
  if (url.startsWith("/rest/v1/rpc/get_consecutive_fails")) {
    return json(res, 200, 0);
  }

  // ---- Goals endpoints (GET by id, POST, PATCH, DELETE) ----
  if (url.startsWith("/rest/v1/goals")) {
    const accept = req.headers["accept"] || "";

    if (method === "POST") {
      const body = await readBody(req);
      const data = JSON.parse(body);
      return json(res, 201, {
        id: `goal-${Date.now()}`,
        user_id: MOCK_USER.id,
        goal_type: data.goal_type || "early_rise",
        difficulty: data.difficulty || "medium",
        checkin_time: data.checkin_time || "08:00:00",
        is_active: true,
        current_streak: 0,
        best_streak: 0,
        total_checkins: 0,
        total_fails: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    if (method === "PATCH") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
      return res.end();
    }

    if (method === "DELETE") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
      return res.end();
    }

    // GET — support filtering by id (e.g. ?id=eq.goal-001)
    const isSingle = accept.includes("vnd.pgrst.object+json");
    const goals = [
      {
        id: "goal-001",
        user_id: MOCK_USER.id,
        goal_type: "early_rise",
        difficulty: "medium",
        checkin_time: "08:00:00",
        current_streak: 3,
        best_streak: 5,
        total_checkins: 12,
        total_fails: 3,
        is_active: true,
        created_at: "2026-07-01T00:00:00+00:00",
        updated_at: "2026-07-29T00:00:00+00:00",
      },
      {
        id: "goal-002",
        user_id: MOCK_USER.id,
        goal_type: "fitness",
        difficulty: "hard",
        checkin_time: "18:00:00",
        current_streak: 0,
        best_streak: 10,
        total_checkins: 25,
        total_fails: 7,
        is_active: true,
        created_at: "2026-07-10T00:00:00+00:00",
        updated_at: "2026-07-29T00:00:00+00:00",
      },
    ];

    // If id filter is present, find matching goal
    const urlObj = new URL(url, `http://localhost:${PORT}`);
    const idFilter = urlObj.searchParams.get("id");
    if (idFilter && idFilter.startsWith("eq.")) {
      const goalId = idFilter.slice(3);
      // API 层测试用 UUID 形式的目标 id（zod 校验要求 uuid），映射到 goal-001
      const ALIAS: Record<string, string> = {
        "a0000000-0000-4000-a000-000000000000": "goal-001",
      };
      const goal = goals.find((g) => g.id === (ALIAS[goalId] ?? goalId));
      if (goal) {
        return json(res, 200, { ...goal, id: goalId });
      }
      // PostgREST returns empty array for not-found single
      return json(res, 200, []);
    }

    return json(res, 200, isSingle ? goals[0] : goals);
  }

  // ---- Push subscription endpoints ----
  if (url.startsWith("/rest/v1/push_subscriptions")) {
    if (method === "POST") {
      return json(res, 201, {
        id: "ps-001",
        created_at: new Date().toISOString(),
      });
    }
    if (method === "DELETE") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
      return res.end();
    }
    return json(res, 200, [
      {
        id: "ps-001",
        user_id: MOCK_USER.id,
        endpoint: "https://fcm.googleapis.com/fcm/send/mock",
        keys: { p256dh: "mock-p256dh", auth: "mock-auth" },
        created_at: "2026-07-01T00:00:00+00:00",
      },
    ]);
  }

  // Fallback
  console.log(`[mock-supabase] unhandled: ${method} ${url}`);
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end("[]");
}

// Start if run directly
const server = createServer(handler);
server.listen(PORT, () => {
  console.log(`[mock-supabase] listening on http://localhost:${PORT}`);
});

// Keep alive
process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
