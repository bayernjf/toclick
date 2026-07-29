"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { enqueueCheckin, replayQueue } from "@/lib/offlineQueue";
import Header from "@/components/Header";
import GoalCard from "@/components/GoalCard";
import AIFeedbackCard from "@/components/AIFeedbackCard";
import Toast from "@/components/Toast";
import type { TodayCheckinView } from "@/lib/types";
import type { PersonaId } from "@/lib/ai/persona";
import { DEFAULT_PERSONA, PERSONA_MAP } from "@/lib/ai/persona";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();

  const [goals, setGoals] = useState<TodayCheckinView[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackStreak, setFeedbackStreak] = useState<number | undefined>();
  const [toast, setToast] = useState<{
    msg: string;
    type?: "info" | "error";
  } | null>(null);
  const [currentFeedbackLogId, setCurrentFeedbackLogId] = useState<
    string | null
  >(null);
  const [currentCheckinId, setCurrentCheckinId] = useState<string | null>(null);
  const [userPersona, setUserPersona] = useState<PersonaId>(DEFAULT_PERSONA);

  const [synced, setSynced] = useState<number | null>(null);
  const [showReportCTA, setShowReportCTA] = useState(false);
  const [reportWeekLabel, setReportWeekLabel] = useState("");

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

  // 首次加载时同步历史缺失的失败记录
  useEffect(() => {
    async function syncMissed() {
      try {
        const resp = await fetch("/api/checkin/sync", { method: "POST" });
        const data = await resp.json();
        if (data.ok && data.synced > 0) {
          setSynced(data.synced);
          // 同步后重新加载目标（显示新写入的 failed 状态）
          await loadGoals();
        } else {
          // sync 返回 0（无缺失），也设置 synced 解除阻塞
          setSynced(0);
        }
      } catch (e) {
        console.error("[dashboard] syncMissed error:", e);
        setSynced(-1); // 出错也解除阻塞
      }
    }
    syncMissed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅 mount 时执行一次

  useEffect(() => {
    // 确保首次加载在 syncMissed 之后也触发
    if (synced === null) {
      loadGoals();
    }
  }, [loadGoals, synced]);

  // 恢复网络时重播离线队列
  useEffect(() => {
    const handleOnline = async () => {
      const count = await replayQueue();
      if (count > 0) {
        setToast({ msg: `✅ 离线期间的 ${count} 次打卡已自动提交` });
        await loadGoals();
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [loadGoals]);

  // 调 /api/checkin 完成打卡，返回 AI 反馈
  async function handleCheckin(goalId: string) {
    try {
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
        setCurrentCheckinId(data.checkin_id ?? null);
      } else {
        setToast({ msg: "打卡成功，但损友罢工了，待会再来听它骂你" });
      }
    } catch (err: unknown) {
      // 网络错误 → 离线排队
      if (
        err instanceof TypeError ||
        (err as Error).message?.includes("fetch")
      ) {
        enqueueCheckin(goalId);
        setToast({ msg: "📡 离线打卡已暂存，联网后自动提交" });
        // 乐观更新 UI：目标标为已打卡
        setGoals((prev) =>
          prev.map((g) =>
            g.goal_id === goalId
              ? {
                  ...g,
                  checkin_date: new Date().toISOString().slice(0, 10),
                  today_status: "success",
                }
              : g,
          ),
        );
      } else {
        setToast({ msg: "打卡失败，再点一次", type: "error" });
      }
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

  async function handleCloseFeedback() {
    setFeedback(null);
    setFeedbackStreak(undefined);
    setCurrentFeedbackLogId(null);
    setCurrentCheckinId(null);

    // 检查是否有周报 → 展示"查看报告"引导
    const { data: reports } = await supabase
      .from("weekly_reports")
      .select("week_start, week_end")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id!)
      .order("week_start", { ascending: false })
      .limit(1);

    if (reports && reports.length > 0) {
      setReportWeekLabel(`${reports[0].week_start} ~ ${reports[0].week_end}`);
      setShowReportCTA(true);
    }
  }

  async function handleSaveNote(note: string) {
    if (!currentCheckinId) return;
    await fetch("/api/checkin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkin_id: currentCheckinId, note }),
    });
  }

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日`;
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][
    today.getDay()
  ];

  // 加载用户人设
  useEffect(() => {
    async function loadPersona() {
      const { data } = await supabase.from("users").select("persona").single();
      if (data?.persona) setUserPersona(data.persona as PersonaId);
    }
    loadPersona();
  }, [supabase]);

  return (
    <main className="px-5 py-6 pb-16 min-h-screen">
      <Header />

      {/* 日期 + 概览 */}
      <section className="mt-6 mb-6">
        <p className="text-muted">
          {dateStr} {weekday}
        </p>
        <h1 className="text-h1 mt-1">今天你立了 {goals.length} 个 flag</h1>
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

      {/* 打卡后 → 查看周报引导 */}
      {showReportCTA && (
        <section className="mt-6">
          <Link
            href="/report"
            className="card block bg-brand-50 border-brand-200 active:bg-brand-100 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-brand-700">
                  📊 {reportWeekLabel} 周报已出炉
                </p>
                <p className="text-sm text-brand-600/70 mt-0.5">
                  看看{PERSONA_MAP[userPersona]?.label ?? "损友"}这周怎么评价你
                  →
                </p>
              </div>
              <span className="text-2xl">👀</span>
            </div>
          </Link>
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
        <Link
          href="/report"
          className="flex-1 h-12 rounded-xl bg-white border border-ink-100 flex items-center justify-center text-sm font-medium text-ink-700 active:bg-ink-100"
        >
          📊 7 日报告
        </Link>
        <Link
          href="/settings"
          className="flex-1 h-12 rounded-xl bg-white border border-ink-100 flex items-center justify-center text-sm font-medium text-ink-700 active:bg-ink-100"
        >
          ⚙️ 设置
        </Link>
      </nav>

      {/* AI 反馈弹层 */}
      {feedback && (
        <AIFeedbackCard
          feedback={feedback}
          streak={feedbackStreak}
          milestone={7}
          persona={userPersona}
          onClose={handleCloseFeedback}
          onReact={handleReact}
          onNote={handleSaveNote}
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
