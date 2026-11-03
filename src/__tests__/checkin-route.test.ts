import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// P2-8 契约：打卡写入 checkins 后，goals 冗余统计更新失败必须向上返回错误，
// 不允许静默吞掉造成连胜/累计永久漂移。

const GOAL_ID = "550e8400-e29b-41d4-a716-446655440000";

type QueryResult = { data: unknown; error: unknown };

const holder = vi.hoisted(() => ({
  client: null as unknown,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: async () => holder.client,
}));

vi.mock("@/lib/ai/doubao", () => ({
  generateAiFeedback: vi.fn(async () => ({ ok: true, text: "损友吐槽" })),
}));

import { POST } from "@/app/api/checkin/route";

function makeFakeSupabase(goalUpdateError: QueryResult["error"] = null) {
  const goal = {
    id: GOAL_ID,
    user_id: "u1",
    goal_type: "early_rise",
    difficulty: "medium",
    checkin_time: "08:00",
    current_streak: 2,
    best_streak: 4,
    total_checkins: 5,
    total_fails: 1,
    is_active: true,
  };
  const mutations: Array<{ op: string; table: string; payload?: unknown }> = [];

  function makeTableClient(table: string) {
    let op: "select" | "update" | "upsert" | "insert" | "delete" = "select";
    let payload: unknown;

    function execute(): QueryResult {
      if (op === "update") {
        mutations.push({ op, table, payload });
        return {
          data: null,
          error: table === "goals" ? goalUpdateError : null,
        };
      }
      if (op === "upsert") {
        mutations.push({ op, table, payload });
        return { data: { id: "checkin-1" }, error: null };
      }
      if (op === "insert") {
        mutations.push({ op, table, payload });
        return { data: { id: "log-1" }, error: null };
      }
      if (op === "delete") {
        mutations.push({ op, table, payload });
        return { data: null, error: null };
      }
      if (table === "goals") return { data: goal, error: null };
      if (table === "users") {
        return {
          data: { id: "u1", age: 25, roast_enabled: true, persona: "bro" },
          error: null,
        };
      }
      // checkins 今日尚无记录
      return { data: null, error: null };
    }

    const api: Record<string, unknown> = {
      select: () => api,
      eq: () => api,
      order: () => api,
      limit: () => api,
      maybeSingle: () => api,
      single: () => api,
      update: (row: unknown) => {
        op = "update";
        payload = row;
        return api;
      },
      upsert: (row: unknown) => {
        op = "upsert";
        payload = row;
        return api;
      },
      insert: (row: unknown) => {
        op = "insert";
        payload = row;
        return api;
      },
      delete: () => {
        op = "delete";
        return api;
      },
      then: (resolve: (v: QueryResult) => unknown) => resolve(execute()),
    };
    return api;
  }

  return {
    mutations,
    client: {
      auth: {
        getUser: async () => ({ data: { user: { id: "u1" } } }),
      },
      from: (table: string) => makeTableClient(table),
      rpc: async () => ({ data: 0, error: null }),
    },
  };
}

function makeRequest() {
  return new Request("http://localhost/api/checkin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ goal_id: GOAL_ID }),
  });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  holder.client = null;
});

describe("POST /api/checkin — goals 统计更新", () => {
  it("更新成功 → 200，返回自增后的连胜", async () => {
    holder.client = makeFakeSupabase().client;

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.streak).toBe(3);
    expect(body.checkin_id).toBe("checkin-1");
  });

  it("更新失败 → 500 并记录错误，绝不返回 ok", async () => {
    holder.client = makeFakeSupabase({ message: "db unavailable" }).client;

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBeUndefined();
    expect(body.error).toContain("统计更新失败");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("update goal stats error"),
      expect.objectContaining({ message: "db unavailable" }),
    );
  });
});
