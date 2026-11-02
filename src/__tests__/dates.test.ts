import { describe, it, expect, vi, afterEach } from "vitest";
import {
  APP_TIMEZONE,
  dateInAppTz,
  todayInAppTz,
  addDays,
  msUntilDeadlineInAppTz,
  isPastDeadlineInAppTz,
  dayOfWeekInAppTz,
  lastWeekBoundsInAppTz,
} from "@/lib/dates";

// 2026-11-09 是周一；CST = UTC+8
// 2026-11-09T15:59:59Z = CST 2026-11-09 23:59:59
// 2026-11-09T16:00:01Z = CST 2026-11-10 00:00:01

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("APP_TIMEZONE", () => {
  it("集中常量为 Asia/Shanghai", () => {
    expect(APP_TIMEZONE).toBe("Asia/Shanghai");
  });
});

describe("dateInAppTz / todayInAppTz", () => {
  it("23:59 CST 仍算当天", () => {
    expect(dateInAppTz(new Date("2026-11-09T15:59:59Z"))).toBe("2026-11-09");
  });

  it("00:00 后 CST 落入次日（此刻 UTC 还是前一天）", () => {
    expect(dateInAppTz(new Date("2026-11-09T16:00:01Z"))).toBe("2026-11-10");
  });

  it("与服务器 TZ 无关：改 TZ 后结果不变", () => {
    vi.stubEnv("TZ", "America/New_York");
    expect(dateInAppTz(new Date("2026-11-09T15:59:59Z"))).toBe("2026-11-09");
    vi.stubEnv("TZ", "UTC");
    expect(dateInAppTz(new Date("2026-11-09T15:59:59Z"))).toBe("2026-11-09");
  });

  it("todayInAppTz 与 dateInAppTz 一致", () => {
    const now = new Date("2026-11-09T16:00:01Z");
    expect(todayInAppTz(now)).toBe(dateInAppTz(now));
  });
});

describe("addDays", () => {
  it("减一天", () => {
    expect(addDays("2026-11-09", -1)).toBe("2026-11-08");
  });

  it("跨月：非闰年 3/1 前一天是 2/28", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("跨年", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("isPastDeadlineInAppTz", () => {
  it("23:59:00 恰达截止时刻 → 未过期（保持原 now <= deadline 语义）", () => {
    expect(
      isPastDeadlineInAppTz("23:59", new Date("2026-11-09T15:59:00Z")),
    ).toBe(false);
  });

  it("23:59:01 过截止一秒 → 已过期", () => {
    expect(
      isPastDeadlineInAppTz("23:59", new Date("2026-11-09T15:59:01Z")),
    ).toBe(true);
  });

  it("00:01 截止：00:00:59 未过期，00:01:01 已过期", () => {
    expect(
      isPastDeadlineInAppTz("00:01", new Date("2026-11-09T16:00:59Z")),
    ).toBe(false);
    expect(
      isPastDeadlineInAppTz("00:01", new Date("2026-11-09T16:01:01Z")),
    ).toBe(true);
  });

  it("跨日：次日 00:00 时'今天'已是新一天，其 23:59 截止尚未到（同日语义）", () => {
    // 2026-11-09T16:00:00Z = CST 2026-11-10 00:00:00，判定对象是 11-10 的 23:59
    expect(
      isPastDeadlineInAppTz("23:59", new Date("2026-11-09T16:00:00Z")),
    ).toBe(false);
    // 而 11-09 当晚 23:59:01 已过期（cron 23:59 跑同日判定的真实场景）
    expect(
      isPastDeadlineInAppTz("23:59", new Date("2026-11-09T15:59:01Z")),
    ).toBe(true);
  });

  it("与服务器 TZ 无关", () => {
    vi.stubEnv("TZ", "America/New_York");
    expect(
      isPastDeadlineInAppTz("23:59", new Date("2026-11-09T15:59:01Z")),
    ).toBe(true);
  });
});

describe("msUntilDeadlineInAppTz", () => {
  it("22:00 CST 距当天 08:00 截止为 -14h", () => {
    expect(
      msUntilDeadlineInAppTz("08:00", new Date("2026-11-09T14:00:00Z")),
    ).toBe(-14 * 3_600_000);
  });

  it("22:00 CST 距当天 23:00 截止为 +1h", () => {
    expect(
      msUntilDeadlineInAppTz("23:00", new Date("2026-11-09T14:00:00Z")),
    ).toBe(1 * 3_600_000);
  });
});

describe("dayOfWeekInAppTz", () => {
  it("CST 周一 22:00 → 1", () => {
    expect(dayOfWeekInAppTz(new Date("2026-11-09T14:00:00Z"))).toBe(1);
  });

  it("CST 已是周二 00:00（UTC 仍周一）→ 2，证明不再按 UTC 判星期", () => {
    expect(dayOfWeekInAppTz(new Date("2026-11-09T16:00:00Z"))).toBe(2);
  });
});

describe("lastWeekBoundsInAppTz", () => {
  it("周一 22:00 CST → 上周一 ~ 上周日", () => {
    expect(lastWeekBoundsInAppTz(new Date("2026-11-09T14:00:00Z"))).toEqual({
      start: "2026-11-02",
      end: "2026-11-08",
    });
  });

  it("周日中午 → 仍归到刚过去的完整周", () => {
    expect(lastWeekBoundsInAppTz(new Date("2026-11-15T04:00:00Z"))).toEqual({
      start: "2026-11-02",
      end: "2026-11-08",
    });
  });
});
