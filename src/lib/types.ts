// 数据库行类型，与 schema.sql 对应
import type { GoalType, Difficulty, CheckinStatus, TriggerType } from "./constants";

export type User = {
  id: string;
  nickname: string;
  age: number;
  roast_enabled: boolean;
  avatar_url: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Goal = {
  id: string;
  user_id: string;
  goal_type: GoalType;
  difficulty: Difficulty;
  checkin_time: string; // "HH:MM:SS"
  current_streak: number;
  best_streak: number;
  total_checkins: number;
  total_fails: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Checkin = {
  id: string;
  goal_id: string;
  user_id: string;
  checkin_date: string; // YYYY-MM-DD
  status: CheckinStatus;
  note: string | null;
  created_at: string;
};

export type AiFeedbackLog = {
  id: string;
  user_id: string;
  goal_id: string | null;
  trigger_type: TriggerType;
  scenario: string;
  consecutive_fail: number;
  difficulty: Difficulty | null;
  streak: number;
  age: number | null;
  roast_enabled: boolean | null;
  ai_response: string;
  user_reaction: "liked" | "disliked" | null;
  created_at: string;
};

export type WeeklyReport = {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  total_goals: number;
  expected_checks: number;
  success_count: number;
  fail_count: number;
  max_streak: number;
  ai_comment: string | null;
  created_at: string;
};

// 首页今日打卡看板视图（v_today_checkins）
export type TodayCheckinView = {
  goal_id: string;
  user_id: string;
  goal_type: GoalType;
  difficulty: Difficulty;
  checkin_time: string;
  current_streak: number;
  best_streak: number;
  is_active: boolean;
  checkin_id: string | null;
  checkin_date: string | null;
  today_status: CheckinStatus | null;
  note: string | null;
};

// 传入 AI 的结构化用户状态
export type AiUserState = {
  scenario: string;
  goal_type: GoalType;
  difficulty: Difficulty;
  streak: number;
  consecutive_fail: number;
  age: number;
  roast_enabled: boolean;
};
