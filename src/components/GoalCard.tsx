"use client";

import { useState } from "react";
import { GOAL_TYPES, DIFFICULTIES, CHECKIN_STATUS } from "@/lib/constants";
import type { TodayCheckinView } from "@/lib/types";

type Props = {
  goal: TodayCheckinView;
  onCheckin: (goalId: string) => Promise<void>;
};

export default function GoalCard({ goal, onCheckin }: Props) {
  const [loading, setLoading] = useState(false);
  const meta = GOAL_TYPES[goal.goal_type];
  const diff = DIFFICULTIES[goal.difficulty];

  const today = new Date().toISOString().slice(0, 10);
  const hasCheckedToday = goal.checkin_date === today;
  const isDone = hasCheckedToday && goal.today_status === "success";

  // 计算距离打卡时间还差多少（仅展示，不阻塞打卡）
  const [hh, mm] = goal.checkin_time.split(":");
  const now = new Date();
  const target = new Date();
  target.setHours(Number(hh), Number(mm), 0, 0);
  const diffMs = target.getTime() - now.getTime();
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  async function handleClick() {
    setLoading(true);
    try {
      await onCheckin(goal.goal_id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{meta.emoji}</span>
            <span className="font-semibold text-ink-800">{meta.label}</span>
          </div>
          <p className="text-muted">
            难度：{diff.label} · 连续 {goal.current_streak} 天
          </p>
          <p className="text-muted">打卡时间：{goal.checkin_time.slice(0, 5)}</p>
        </div>
      </div>

      {isDone ? (
        <div className="h-12 rounded-xl bg-success-500/10 text-success-600 font-medium flex items-center justify-center">
          ✓ 今日已打卡
        </div>
      ) : hasCheckedToday && goal.today_status === "failed" ? (
        <div className="h-12 rounded-xl bg-ink-100 text-ink-700/60 font-medium flex items-center justify-center text-sm">
          ✗ 今天没打，明天它要损你了
        </div>
      ) : diffMs < -60 * 60 * 1000 ? (
        // 超时超过 1 小时
        <button
          onClick={handleClick}
          disabled={loading}
          className="w-full h-12 rounded-xl bg-warn-500 text-white font-semibold flex items-center justify-center active:opacity-90"
        >
          {loading ? "提交中…" : "⚠ 超时了，赶紧补打"}
        </button>
      ) : diffMs > 0 ? (
        <div className="space-y-2">
          <p className="text-muted text-center">
            ⏳ 还有 {diffHours} 小时到打卡时间
          </p>
          <button
            onClick={handleClick}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "提交中…" : "✓ 提前打了"}
          </button>
        </div>
      ) : (
        <button
          onClick={handleClick}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? "提交中…" : "✓ 打了"}
        </button>
      )}
    </div>
  );
}
