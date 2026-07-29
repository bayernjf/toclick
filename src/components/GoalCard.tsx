"use client";

import { useState } from "react";
import { GOAL_TYPES, DIFFICULTIES } from "@/lib/constants";
import type { TodayCheckinView } from "@/lib/types";

type Props = {
  goal: TodayCheckinView;
  onCheckin: (goalId: string) => Promise<void>;
};

export default function GoalCard({ goal, onCheckin }: Props) {
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [showFailedFeedback, setShowFailedFeedback] = useState(false);
  const [failedFeedback, setFailedFeedback] = useState<string | null>(null);
  const [failedLoading, setFailedLoading] = useState(false);
  const [failedLogId, setFailedLogId] = useState<string | null>(null);

  const meta = GOAL_TYPES[goal.goal_type];
  const diff = DIFFICULTIES[goal.difficulty];

  const today = new Date().toISOString().slice(0, 10);
  const hasCheckedToday = goal.checkin_date === today;
  const isDone = hasCheckedToday && goal.today_status === "success";
  const isFailed = hasCheckedToday && goal.today_status === "failed";

  // 计算距离打卡时间还差多少（仅展示，不阻塞打卡）
  const [hh, mm] = goal.checkin_time.split(":");
  const now = new Date();
  const target = new Date();
  target.setHours(Number(hh), Number(mm), 0, 0);
  const diffMs = target.getTime() - now.getTime();
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  async function handleCheckinClick() {
    setCheckinLoading(true);
    try {
      await onCheckin(goal.goal_id);
    } finally {
      setCheckinLoading(false);
    }
  }

  // 点击失败状态卡片 → 获取 AI 反馈
  async function handleFailedClick() {
    if (failedFeedback) {
      setShowFailedFeedback((v) => !v);
      return;
    }
    setFailedLoading(true);
    try {
      const resp = await fetch(
        `/api/ai-feedback?goal_id=${goal.goal_id}&date=${today}`
      );
      const data = await resp.json();
      if (data.ok && data.feedback) {
        setFailedFeedback(data.feedback);
        setFailedLogId(data.feedback_log_id ?? null);
        setShowFailedFeedback(true);
      }
    } catch (e) {
      console.error("[GoalCard] fetch failed feedback error:", e);
    } finally {
      setFailedLoading(false);
    }
  }

  async function handleFailedReact(reaction: "liked" | "disliked") {
    if (!failedLogId) return;
    await fetch("/api/ai-feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback_log_id: failedLogId, reaction }),
    });
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
      ) : isFailed ? (
        <div>
          <button
            onClick={handleFailedClick}
            disabled={failedLoading}
            className="w-full h-12 rounded-xl bg-ink-200 text-ink-600 font-medium flex items-center justify-center gap-1 text-sm active:bg-ink-300 transition-colors"
          >
            {failedLoading ? (
              "⏳ 加载中…"
            ) : showFailedFeedback ? (
              "✗ 收起损友毒舌 ↑"
            ) : (
              <>{failedFeedback ? "✗ 再看一遍损友的话" : "✗ 今天没打，看看它怎么说 →"}</>
            )}
          </button>

          {/* 失败 AI 反馈 */}  
          {showFailedFeedback && failedFeedback && (
            <div className="mt-3 p-4 rounded-xl bg-ink-50 border border-ink-100">
              <div className="flex items-start gap-2 mb-3">
                <span className="text-lg">💬</span>
                <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">
                  {failedFeedback}
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => handleFailedReact("liked")}
                  className="px-3 py-1 rounded-lg bg-success-500/10 text-success-600 text-xs font-medium active:bg-success-500/20"
                >
                  👍 说得对
                </button>
                <button
                  onClick={() => handleFailedReact("disliked")}
                  className="px-3 py-1 rounded-lg bg-ink-100 text-ink-500 text-xs font-medium active:bg-ink-200"
                >
                  👎 太损了
                </button>
              </div>
            </div>
          )}
        </div>
      ) : diffMs < -60 * 60 * 1000 ? (
        // 超时超过 1 小时
        <button
          onClick={handleCheckinClick}
          disabled={checkinLoading}
          className="w-full h-12 rounded-xl bg-warn-500 text-white font-semibold flex items-center justify-center active:opacity-90"
        >
          {checkinLoading ? "提交中…" : "⚠ 超时了，赶紧补打"}
        </button>
      ) : diffMs > 0 ? (
        <div className="space-y-2">
          <p className="text-muted text-center">
            ⏳ 还有 {diffHours} 小时到打卡时间
          </p>
          <button
            onClick={handleCheckinClick}
            disabled={checkinLoading}
            className="btn-primary"
          >
            {checkinLoading ? "提交中…" : "✓ 提前打了"}
          </button>
        </div>
      ) : (
        <button
          onClick={handleCheckinClick}
          disabled={checkinLoading}
          className="btn-primary"
        >
          {checkinLoading ? "提交中…" : "✓ 打了"}
        </button>
      )}
    </div>
  );
}
