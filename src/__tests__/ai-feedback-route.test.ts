import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// P2-9 契约：get_consecutive_fails RPC 失败时不得默认按"连续失败=1"处理，
// 必须记录错误并按保护模式阈值做保守处理。

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

import { GET } from "@/app/api/ai-feedback/route";
import { generateAiFeedback } from "@/lib/ai/doubao";
import { PROTECTION_MODE_THRESHOLD } from "@/lib/constants";

function makeFakeSupabase(rpcResult: QueryResult) {
  const goal = {
    id: GOAL_ID,
    user_id: "u1",
    goal_type: "fitness",
    difficulty: "medium",
    checkin_time: "08:00",
    current_streak: 0,
    best_streak: 3,
    total_checkins: 4,
    total_fails: 2,
    is_active: true,
  };

  function makeTableClient(table: string) {
    const api: Record<string, unknown> = {
      select: () => api,
      eq: () => api,
      gte: () => api,
      order: () => api,
      limit: () => api,
      maybeSingle: () => api,
      single: () => api,
      insert: () => api,
      then: (resolve: (v: QueryResult) => unknown) =>
        resolve({
          data:
            table === "goals"
              ? goal
              : table === "users"
                ? { id: "u1", age: 25, roast_enabled: true, persona: "bro" }
                : table === "ai_feedback_logs"
                  ? { id: "log-1" }
                  : null,
          error: null,
        }),
    };
    return api;
  }

  return {
    client: {
      auth: {
        getUser: async () => ({ data: { user: { id: "u1" } } }),
      },
      from: (table: string) => makeTableClient(table),
      rpc: async () => rpcResult,
    },
  };
}

function makeRequest() {
  return new Request(
    `http://localhost/api/ai-feedback?goal_id=${GOAL_ID}&date=2026-11-02`,
  );
}

beforeEach(() => {
  process.env.ARK_API_KEY = "unit-test-key";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(generateAiFeedback).mockClear();
  delete process.env.ARK_API_KEY;
  holder.client = null;
});

describe("GET /api/ai-feedback — consecutive_fail RPC", () => {
  it("RPC 成功 → 使用真实连续失败数", async () => {
    holder.client = makeFakeSupabase({ data: 2, error: null }).client;

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(vi.mocked(generateAiFeedback)).toHaveBeenCalledWith(
      expect.objectContaining({ consecutive_fail: 2 }),
      "bro",
    );
  });

  it("RPC 失败 → 记录错误并按保护阈值保守处理，不默认成 1", async () => {
    holder.client = makeFakeSupabase({
      data: null,
      error: { message: "rpc boom" },
    }).client;

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("get_consecutive_fails rpc error"),
      expect.objectContaining({ message: "rpc boom" }),
    );

    const state = vi.mocked(generateAiFeedback).mock.calls[0][0];
    expect(state.consecutive_fail).toBe(PROTECTION_MODE_THRESHOLD);
    expect(state.consecutive_fail).toBeGreaterThanOrEqual(
      PROTECTION_MODE_THRESHOLD,
    );
  });
});
