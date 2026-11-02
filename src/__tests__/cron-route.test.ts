import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── 内存版 Supabase 测试替身 ──────────────────────────────────
// 仓内没有本地 Supabase 环境，用该 fake 替代真实数据库，
// 完整跑通 /api/cron 端点，证明查询、失败标记、周报、推送不再恒空。

type Row = Record<string, unknown>;

interface Mutation {
  op: "insert" | "update" | "delete";
  table: string;
  payload?: unknown;
  matched?: number;
}

function makeTableQuery(
  table: Row[],
  tableName: string,
  mutations: Mutation[],
) {
  const filters: Array<(r: Row) => boolean> = [];
  let op: "select" | "insert" | "update" | "delete" = "select";
  let payload: unknown;
  let singleMode: "none" | "single" | "maybeSingle" = "none";

  function execute() {
    if (op === "insert") {
      const rows = (Array.isArray(payload) ? payload : [payload]) as Row[];
      table.push(...rows);
      mutations.push({ op, table: tableName, payload });
      return { data: rows[0] ?? null, error: null };
    }
    const matched = table.filter((r) => filters.every((f) => f(r)));
    if (op === "update") {
      for (const r of matched) Object.assign(r, payload);
      mutations.push({
        op,
        table: tableName,
        payload,
        matched: matched.length,
      });
      return { data: matched, error: null };
    }
    if (op === "delete") {
      for (const r of matched) table.splice(table.indexOf(r), 1);
      mutations.push({ op, table: tableName, matched: matched.length });
      return { data: matched, error: null };
    }
    if (singleMode !== "none") return { data: matched[0] ?? null, error: null };
    return { data: matched, error: null };
  }

  const api: Record<string, unknown> = {
    select: () => api,
    eq: (col: string, val: unknown) => {
      filters.push((r) => r[col] === val);
      return api;
    },
    gte: (col: string, val: unknown) => {
      filters.push((r) => String(r[col]) >= String(val));
      return api;
    },
    lte: (col: string, val: unknown) => {
      filters.push((r) => String(r[col]) <= String(val));
      return api;
    },
    in: (col: string, vals: unknown[]) => {
      filters.push((r) => vals.includes(r[col]));
      return api;
    },
    maybeSingle: () => {
      singleMode = "maybeSingle";
      return api;
    },
    single: () => {
      singleMode = "single";
      return api;
    },
    returns: () => api,
    insert: (row: unknown) => {
      op = "insert";
      payload = row;
      return api;
    },
    update: (row: unknown) => {
      op = "update";
      payload = row;
      return api;
    },
    delete: () => {
      op = "delete";
      return api;
    },
    then: (resolve: (v: unknown) => unknown) => resolve(execute()),
  };
  return api;
}

function makeFakeSupabase(seed: Record<string, Row[]>) {
  const mutations: Mutation[] = [];
  const client = {
    from: (table: string) => {
      if (!seed[table]) throw new Error(`unexpected table: ${table}`);
      return makeTableQuery(seed[table], table, mutations);
    },
    rpc: async () => ({ data: 1, error: null }),
  };
  return { client, mutations };
}

// ─── 模块 mock（vi.hoisted 保证 mock 工厂可引用）───────────────

const holder = vi.hoisted(() => ({
  fake: null as null | {
    from: (table: string) => unknown;
    rpc: () => Promise<{ data: number; error: null }>;
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdmin: () => holder.fake,
}));

vi.mock("@/lib/ai/doubao", () => ({
  generateAiFeedback: vi.fn(async () => ({ ok: true, text: "损友吐槽" })),
}));

vi.mock("@/lib/push", () => ({
  broadcastPush: vi.fn(async () => [] as string[]),
}));

import { POST } from "@/app/api/cron/route";

// ─── 测试 ─────────────────────────────────────────────────────

function makeRequest(secret: string) {
  return new Request("http://localhost/api/cron", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret }),
  });
}

function seedTables() {
  return {
    goals: [
      // 过去创建、08:00 打卡、今天未打卡 → 应被标记 failed
      {
        id: "g1",
        user_id: "u1",
        goal_type: "early_rise",
        difficulty: "medium",
        checkin_time: "08:00",
        is_active: true,
        created_at: "2026-10-01T00:00:00.000Z",
        current_streak: 3,
        best_streak: 5,
        total_fails: 0,
        total_checkins: 10,
      },
      // 当天创建 → 应跳过
      {
        id: "g2",
        user_id: "u1",
        goal_type: "fitness",
        difficulty: "easy",
        checkin_time: "08:00",
        is_active: true,
        created_at: "2026-11-09T01:00:00.000Z",
        current_streak: 0,
        best_streak: 0,
        total_fails: 0,
        total_checkins: 0,
      },
      // 23:00 打卡、当前 22:00 未到 → 应跳过
      {
        id: "g3",
        user_id: "u1",
        goal_type: "study",
        difficulty: "easy",
        checkin_time: "23:00",
        is_active: true,
        created_at: "2026-10-01T00:00:00.000Z",
        current_streak: 1,
        best_streak: 2,
        total_fails: 0,
        total_checkins: 5,
      },
    ],
    checkins: [
      // 上周范围内的一条成功记录，供周报统计
      {
        id: "c1",
        goal_id: "g1",
        user_id: "u1",
        checkin_date: "2026-11-05",
        status: "success",
      },
    ],
    users: [{ id: "u1", age: 25, roast_enabled: false, persona: "bro" }],
    push_subscriptions: [
      {
        id: "s1",
        user_id: "u1",
        endpoint: "https://push.example/x",
        p256dh: "p",
        auth: "a",
      },
    ],
    weekly_reports: [] as Row[],
    ai_feedback_logs: [] as Row[],
  };
}

beforeEach(() => {
  process.env.CRON_SECRET = "test-secret";
  process.env.ARK_API_KEY = "test-ark-key";
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.CRON_SECRET;
  delete process.env.ARK_API_KEY;
  holder.fake = null;
});

describe("POST /api/cron", () => {
  it("错误 secret → 401", async () => {
    holder.fake = makeFakeSupabase(seedTables()).client;
    vi.setSystemTime(new Date("2026-11-09T14:00:00Z"));

    const res = await POST(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("周一 22:00 CST：查得到目标、标记失败、生成周报、发出推送", async () => {
    const tables = seedTables();
    const { client, mutations } = makeFakeSupabase(tables);
    holder.fake = client;
    // 2026-11-09T14:00:00Z = 周一 2026-11-09 22:00 CST
    vi.setSystemTime(new Date("2026-11-09T14:00:00Z"));

    const res = await POST(makeRequest("test-secret"));
    const body = await res.json();

    // 响应汇总：不再恒空
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.date).toBe("2026-11-09");
    expect(body.total_goals).toBe(3);
    expect(body.failed).toBe(1);
    expect(body.skipped).toBe(2);
    expect(body.errors).toBe(0);
    expect(body.weekly_reports).toBe(2); // g1 + g3 创建于上周之前；g2 当天创建被排除
    expect(body.push_sent).toBe(1);

    // details：failed 项带 user_id / goal_type（修复推送死代码）
    const failedEntry = body.details.find((d: Row) => d.status === "failed");
    expect(failedEntry.goal_id).toBe("g1");
    expect(failedEntry.user_id).toBe("u1");
    expect(failedEntry.goal_type).toBe("early_rise");
    expect(failedEntry.ai_feedback).toBe("损友吐槽");

    // DB 实证 1：checkins 表新增今日 failed 记录
    const failedCheckins = tables.checkins.filter((r) => r.status === "failed");
    expect(failedCheckins).toHaveLength(1);
    expect(failedCheckins[0]).toMatchObject({
      goal_id: "g1",
      user_id: "u1",
      checkin_date: "2026-11-09",
    });

    // DB 实证 2：g1 连胜归零、失败数 +1
    const g1 = tables.goals.find((g) => g.id === "g1");
    expect(g1).toMatchObject({ current_streak: 0, total_fails: 1 });

    // DB 实证 3：周报写入，周期为 app 时区上周一~周日
    expect(tables.weekly_reports).toHaveLength(2);
    expect(tables.weekly_reports[0]).toMatchObject({
      goal_id: "g1",
      week_start: "2026-11-02",
      week_end: "2026-11-08",
      success_count: 1,
      fail_count: 0,
    });

    // DB 实证 4：AI 失败反馈审计日志已写入
    expect(
      tables.ai_feedback_logs.some((l) => l.trigger_type === "checkin_fail"),
    ).toBe(true);

    // 未发生误删/误更新其它表
    expect(mutations.every((m) => m.op !== "delete")).toBe(true);
  });

  it("CST 已跨日而 UTC 仍是周一：日期与星期判定都走 app 时区", async () => {
    const tables = seedTables();
    holder.fake = makeFakeSupabase(tables).client;
    // 2026-11-09T16:30:00Z = CST 2026-11-10 00:30（周二）
    vi.setSystemTime(new Date("2026-11-09T16:30:00Z"));

    const res = await POST(makeRequest("test-secret"));
    const body = await res.json();

    // 修复前这里会是 "2026-11-09"（UTC 日期）
    expect(body.date).toBe("2026-11-10");
    // CST 已是周二 → 不生成周报（修复前按 UTC 周一 0 点会生成）
    expect(body.weekly_reports).toBe(0);
    // CST 00:30 早于 08:00 截止 → 新的一天不提前误标失败
    expect(body.failed).toBe(0);
    expect(tables.checkins.every((r) => r.status !== "failed")).toBe(true);
    // 08:00 截止在 UTC 是 11-10 00:00，若按 UTC 判 16:30Z 早就过期
    const skipEntry = body.details.find((d: Row) => d.goal_id === "g1");
    expect(skipEntry.status).toBe("skipped");
  });

  it("无活跃目标时正常返回空结果", async () => {
    holder.fake = makeFakeSupabase({
      ...seedTables(),
      goals: [],
    }).client;
    vi.setSystemTime(new Date("2026-11-09T14:00:00Z"));

    const res = await POST(makeRequest("test-secret"));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.failed).toBe(0);
  });
});
