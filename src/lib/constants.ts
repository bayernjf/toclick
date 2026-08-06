// 全局常量：目标类型、难度、状态

export const GOAL_TYPES = {
  early_rise: { label: "早起", emoji: "🌅" },
  fitness: { label: "健身", emoji: "💪" },
  study: { label: "学习", emoji: "📚" },
} as const;

export type GoalType = keyof typeof GOAL_TYPES;

export const DIFFICULTIES = {
  easy: { label: "简单", desc: "没做到会被狠狠损" },
  medium: { label: "中等", desc: "正常力度" },
  hard: { label: "挑战", desc: "做不到它理解你" },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;

export const CHECKIN_STATUS = {
  success: "完成",
  failed: "未完成",
  skipped: "休息",
} as const;

export type CheckinStatus = keyof typeof CHECKIN_STATUS;

// AI 反馈触发类型
export const TRIGGER_TYPES = {
  checkin_success: "打卡成功",
  checkin_fail: "打卡失败",
  weekly_report: "周报",
  mode_switch: "模式切换",
  record_delete: "删除记录",
  streak_milestone: "连续里程碑",
} as const;

export type TriggerType = keyof typeof TRIGGER_TYPES;

// 连续失败多少天后触发保护模式（强制切纯夸夸）
export const PROTECTION_MODE_THRESHOLD = 3;

// 连续达标多少天触发洗白
export const CLEAN_STREAK_DAYS = 7;

// 未成年保护
export const MINOR_AGE = 18;

// Web Push VAPID public key (from NEXT_PUBLIC_VAPID_PUBLIC_KEY env)
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
