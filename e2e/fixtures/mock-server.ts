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
    return json(res, 200, [
      {
        id: "rpt-001",
        user_id: MOCK_USER.id,
        week_start: "2026-07-20",
        week_end: "2026-07-26",
        stats: JSON.stringify({
          totalDays: 5,
          checkinRate: 0.71,
          totalCheckins: 5,
          totalFails: 2,
        }),
        ai_commentary: "这周表现不错，下周期待你保持！",
        is_published: false,
        record_week_start: "2026-07-20",
        record_week_end: "2026-07-26",
      },
    ]);
  }

  if (url.startsWith("/rest/v1/checkins")) {
    return json(res, 200, [
      {
        id: "ci-w1",
        user_id: MOCK_USER.id,
        goal_id: "goal-001",
        checkin_date: "2026-07-20",
        status: "done",
        created_at: "2026-07-20T08:00:00+00:00",
      },
      {
        id: "ci-w2",
        user_id: MOCK_USER.id,
        goal_id: "goal-001",
        checkin_date: "2026-07-21",
        status: "done",
        created_at: "2026-07-21T08:05:00+00:00",
      },
      {
        id: "ci-w3",
        user_id: MOCK_USER.id,
        goal_id: "goal-001",
        checkin_date: "2026-07-22",
        status: "done",
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
        status: "done",
        created_at: "2026-07-24T08:00:00+00:00",
      },
    ]);
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
      const goal = goals.find((g) => g.id === goalId);
      if (goal) {
        return json(res, 200, goal);
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
