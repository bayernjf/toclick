"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import GoalCard from "@/components/GoalCard";
import AIFeedbackCard from "@/components/AIFeedbackCard";
import Toast from "@/components/Toast";
import type { TodayCheckinView } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();

  const [goals, setGoals] = useState<TodayCheckinView[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackStreak, setFeedbackStreak] = useState<number | undefined>();
  const [toast, setToast] = useState<{ msg: string; type?: "info" | "error" } | null>(null);
  const [currentFeedbackLogId, setCurrentFeedbackLogId] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    // 用视图一次拿到所有目标 + 今日打卡状态
    const { data, error } = await supabase
      .from("v_today_checkins")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[dashboard] loadGoals error:", error);
      setToast({ msg: "加载失败，下拉刷新试试", type: "error" });
    } else {
      setGoals((data as TodayCheckinView[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  // 调 /api/checkin 完成打卡，返回 AI 反馈
  async function handleCheckin(goalId: string) {
    const resp = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal_id: goalId }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      setToast({ msg: data?.error || "打卡失败，再点一次", type: "error" });
      return;
    }

    // 刷新列表（拿到最新连续天数）
    await loadGoals();

    if (data.feedback) {
      setFeedback(data.feedback);
      setFeedbackStreak(data.streak);
      setCurrentFeedbackLogId(data.feedback_log_id ?? null);
    } else {
      setToast({ msg: "打卡成功，但损友罢工了，待会再来听它骂你" });
    }
  }

  async function handleReact(reaction: "liked" | "disliked") {
    if (!currentFeedbackLogId) return;
    await fetch("/api/ai-feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedback_log_id: currentFeedbackLogId,
        reaction,
      }),
    });
  }

  function handleCloseFeedback() {
    setFeedback(null);
    setFeedbackStreak(undefined);
    setCurrentFeedbackLogId(null);
  }

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日`;
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][today.getDay()];

  return (
    <main className="px-5 py-6 pb-16 min-h-screen">
      <Header />

      {/* 日期 + 概览 */}
      <section className="mt-6 mb-6">
        <p className="text-muted">
          {dateStr} {weekday}
        </p>
        <h1 className="text-h1 mt-1">
          今天你立了 {goals.length} 个 flag
        </h1>
      </section>

      {/* 目标列表 */}
      {loading ? (
        <div className="text-center py-20 text-muted">翻你的黑历史中…</div>
      ) : goals.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="space-y-4">
          {goals.map((g) => (
            <GoalCard key={g.goal_id} goal={g} onCheckin={handleCheckin} />
          ))}
        </section>
      )}

      {/* 新增目标 */}
      <section className="mt-6">
        <h2 className="text-h2 mb-3">▎想加个新目标？</h2>
        <Link href="/goals/new" className="btn-secondary">
          + 再立一个
        </Link>
      </section>

      {/* 底部导航 */}
      <nav className="mt-10 flex gap-3">
        <Link href="/report" className="flex-1 h-12 rounded-xl bg-white border border-ink-100 flex items-center justify-center text-sm font-medium text-ink-700 active:bg-ink-100">
          📊 7 日报告
        </Link>
        <Link href="/settings" className="flex-1 h-12 rounded-xl bg-white border border-ink-100 flex items-center justify-center text-sm font-medium text-ink-700 active:bg-ink-100">
          ⚙️ 设置
        </Link>
      </nav>

      {/* AI 反馈弹层 */}
      {feedback && (
        <AIFeedbackCard
          feedback={feedback}
          streak={feedbackStreak}
          milestone={7}
          onClose={handleCloseFeedback}
          onReact={handleReact}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="card text-center py-12">
      <div className="text-5xl mb-3">🚩</div>
      <p className="text-body mb-1">还没立 flag 呢，先立一个？</p>
      <p className="text-muted mb-6">倒了我可不负责 😏</p>
      <Link href="/goals/new" className="btn-primary inline-flex w-auto px-8">
        立第一个
      </Link>
    </div>
  );
}
