// 全局日期/时区工具：所有"今天 / 是否过期 / 周报周期"判定统一走 APP_TIMEZONE。
// 服务器（Vercel）运行在 UTC，用户在中国时区；混用会导致 cron 提前约 8 小时误标失败。
// 客户端组件同样使用本模块，保证与服务端判定一致（Intl 显式 timeZone 不受运行环境 TZ 影响）。

export const APP_TIMEZONE = "Asia/Shanghai";

const dtf = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

interface AppTzParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsInAppTz(d: Date): AppTzParts {
  const parts = dtf.formatToParts(d);
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

/** 将某个时刻格式化为 app 时区下的 YYYY-MM-DD */
export function dateInAppTz(d: Date): string {
  const p = partsInAppTz(d);
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  return `${p.year}-${mm}-${dd}`;
}

/** app 时区下的"今天"（YYYY-MM-DD），替代 new Date().toISOString().slice(0, 10) */
export function todayInAppTz(now: Date = new Date()): string {
  return dateInAppTz(now);
}

/** 在 YYYY-MM-DD 上加减天数，返回 YYYY-MM-DD（按 app 时区日历日计算） */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  // 用 UTC 正午构造，±8 小时偏移内 format 回 app 时区仍是同一天，规避 DST/时区边缘
  const base = Date.UTC(y, m - 1, d, 12, 0, 0);
  return dateInAppTz(new Date(base + days * 86_400_000));
}

/**
 * 当前时刻距离"app 时区今天 checkinTime（HH:mm）"的毫秒数。
 * 返回值 > 0 表示还没到打卡时间；< 0 表示已超过。
 */
export function msUntilDeadlineInAppTz(
  checkinTime: string,
  now: Date = new Date(),
): number {
  const [hh, mm] = checkinTime.split(":").map(Number);
  const p = partsInAppTz(now);
  // 用"墙钟解释为 UTC 的毫秒 - 实际毫秒"求 app 时区偏移（Asia/Shanghai 固定 +8h、无 DST）
  const wallAsUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  const offsetMs = wallAsUtc - now.getTime();
  const deadlineUtcMs =
    Date.UTC(p.year, p.month - 1, p.day, hh, mm, 0) - offsetMs;
  return deadlineUtcMs - now.getTime();
}

/** 是否已过 app 时区今天的打卡截止时间（与原 now <= deadline 语义一致：恰达截止秒仍不算过期） */
export function isPastDeadlineInAppTz(
  checkinTime: string,
  now: Date = new Date(),
): boolean {
  return msUntilDeadlineInAppTz(checkinTime, now) < 0;
}

/** app 时区下的星期几（0=周日 … 6=周六） */
export function dayOfWeekInAppTz(now: Date = new Date()): number {
  const [y, m, d] = dateInAppTz(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** app 时区下"上周一 ~ 上周日"的日期范围（YYYY-MM-DD） */
export function lastWeekBoundsInAppTz(now: Date = new Date()): {
  start: string;
  end: string;
} {
  const today = todayInAppTz(now);
  const dow = dayOfWeekInAppTz(now);
  const daysSinceMonday = (dow + 6) % 7;
  const thisMonday = addDays(today, -daysSinceMonday);
  return { start: addDays(thisMonday, -7), end: addDays(thisMonday, -1) };
}
