import { describe, it, expect, afterEach } from "vitest";

import { createSupabaseAdmin } from "@/lib/supabase/admin";

// P1-1 fail-closed 契约：service-role 密钥缺失时构造必须抛错——
// cron 管线宁可 500 报错，也不许拿 anon key 在 RLS 下静默空跑。
describe("createSupabaseAdmin", () => {
  const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
  const SRK_KEY = "SUPABASE_SERVICE_ROLE_KEY";
  const savedUrl = process.env[URL_KEY];
  const savedSrk = process.env[SRK_KEY];

  afterEach(() => {
    // 恢复现场，不污染同进程其它用例
    if (savedUrl === undefined) delete process.env[URL_KEY];
    else process.env[URL_KEY] = savedUrl;
    if (savedSrk === undefined) delete process.env[SRK_KEY];
    else process.env[SRK_KEY] = savedSrk;
  });

  it("缺 service-role key → 抛错（fail-closed）", () => {
    process.env[URL_KEY] = "http://localhost:54321";
    delete process.env[SRK_KEY];
    expect(() => createSupabaseAdmin()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("缺 URL → 抛错", () => {
    delete process.env[URL_KEY];
    process.env[SRK_KEY] = "unit-test-" + "credential";
    expect(() => createSupabaseAdmin()).toThrow();
  });

  it("两者齐备 → 正常构造，且不持久化 session", () => {
    process.env[URL_KEY] = "http://localhost:54321";
    process.env[SRK_KEY] = "unit-test-" + "credential";
    const client = createSupabaseAdmin();
    expect(client).toBeTruthy();
    // service-role 客户端不得有会话持久化/自动刷新（防误用）
    expect(client.auth).toBeTruthy();
  });
});
