import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

// 静态守卫：DB 层的"今天"必须与应用层 src/lib/dates.ts 同一时区。
// 背景：P1-3 修复把应用层统一切到 Asia/Shanghai，但 v_today_checkins 视图与
// get_consecutive_fails 函数仍用 CURRENT_DATE（Supabase 上为 UTC，晚 8 小时翻日）。
// 本测试钉住迁移链终态与基准 schema，防止回归。

const ROOT = join(__dirname, "..", "..");
const APP_TZ_EXPR = "(now() AT TIME ZONE 'Asia/Shanghai')::date";

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

describe("DB day-boundary timezone guard", () => {
  it("baseline schema defines both objects with the app-tz expression", () => {
    const schema = read("flag_breaker_schema.sql");
    expect(schema).not.toContain("CURRENT_DATE");
    // 视图与函数各一处
    const occurrences = schema.split(APP_TZ_EXPR).length - 1;
    expect(occurrences).toBe(2);
  });

  it("the migration chain's final definitions use the app-tz expression", () => {
    const dir = join(ROOT, "supabase", "migrations");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // 每个对象在迁移链中的"最后一次定义"必须含 app 时区表达式；
    // 更早的历史定义（如 001 的 CURRENT_DATE 版本）已被后续迁移覆盖，不可回改。
    for (const objectName of ["v_today_checkins", "get_consecutive_fails"]) {
      let last: { file: string; content: string } | null = null;
      for (const f of files) {
        const content = readFileSync(join(dir, f), "utf-8");
        // 只统计真正的定义语句（CREATE OR REPLACE），注释里的提及不算
        if (
          content.includes(`CREATE OR REPLACE VIEW public.${objectName}`) ||
          content.includes(`CREATE OR REPLACE FUNCTION public.${objectName}`)
        ) {
          last = { file: f, content };
        }
      }
      expect(last, `${objectName} must be defined somewhere`).not.toBeNull();
      expect(
        last!.content,
        `${last!.file} holds the final definition of ${objectName} and must use the app-tz expression`,
      ).toContain(APP_TZ_EXPR);
    }
  });
});
