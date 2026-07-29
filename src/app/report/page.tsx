"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import { GOAL_TYPES } from "@/lib/constants";
import type { WeeklyReport, Checkin, Goal } from "@/lib/types";

export default function ReportPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<Checkin[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [shareToast, setShareToast] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // 取最近一周的所有目标独立报告
      const { data: rep } = await supabase
        .from("weekly_reports")
        .select("*")
        .eq("user_id", user.id)
        .order("week_start", { ascending: false })
        .limit(10)
        .returns<WeeklyReport[]>();

      // 只保留最新 week_start 的那批报告
      const latestWeek = rep?.[0]?.week_start;
      const latestReports = (rep ?? []).filter(
        (r) => r.week_start === latestWeek
      );

      setReports(latestReports);

      // 取最近 7 天打卡明细
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: chk } = await supabase
        .from("checkins")
        .select("*")
        .eq("user_id", user.id)
        .gte("checkin_date", sevenDaysAgo.toISOString().slice(0, 10))
        .order("checkin_date", { ascending: true })
        .returns<Checkin[]>();

      setRecentCheckins(chk ?? []);

      // 取所有目标（用于映射）
      const { data: goalsData } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .returns<Goal[]>();

      setGoals(goalsData ?? []);
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  // 汇总统计
  const totalSuccess = reports.reduce((s, r) => s + r.success_count, 0);
  const totalFail = reports.reduce((s, r) => s + r.fail_count, 0);
  const totalExpected = reports.reduce((s, r) => s + r.expected_checks, 0);
  const avgMaxStreak = reports.length > 0
    ? Math.round(reports.reduce((s, r) => s + r.max_streak, 0) / reports.length)
    : 0;

  const goalMap = new Map(goals.map((g) => [g.id, g]));

  // 分享
  async function handleShare() {
    const weekLabel = reports[0]
      ? `${reports[0].week_start} ~ ${reports[0].week_end}`
      : "本周";

    const text = `【反旗 App】${weekLabel}\n完成 ${totalSuccess}/${totalExpected} | 最长连续 ${avgMaxStreak} 天 | 失败了 ${totalFail} 天`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "我的反旗周报", text });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
      setShareToast("已复制到剪贴板");
      setTimeout(() => setShareToast(null), 2000);
    }
  }

  if (loading) {
    return (
      <main className="px-5 py-6 pb-16 min-h-screen">
        <Header title="我的 7 日报告" showBack />
        <div className="mt-12 text-center text-muted">加载中...</div>
      </main>
    );
  }

  return (
    <main className="px-5 py-6 pb-16 min-h-screen">
      <Header title="我的 7 日报告" showBack />

      {reports.length === 0 ? (
        <div className="card text-center py-12 mt-6">
          <div className="text-5xl mb-3">📅</div>
          <p className="text-body mb-1">还没满 7 天</p>
          <p className="text-muted">下周来拿你的第一份报告</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* 时间范围 */}
          <p className="text-muted">
            {reports[0].week_start} ~ {reports[0].week_end}
          </p>

          {/* 总战绩 */}
          <section>
            <h2 className="text-h2 mb-3">▎本周总战绩</h2>
            <div className="card text-center py-6">
              <p className="text-3xl font-bold text-brand-500">
                完成 {totalSuccess} / {totalExpected}
              </p>
              <p className="text-body mt-1">
                完成率{" "}
                {totalExpected > 0
                  ? Math.round((totalSuccess / totalExpected) * 100)
                  : 0}
                %
                {reports.length > 1 && (
                  <span className="text-muted"> · {reports.length} 个目标</span>
                )}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="card text-center">
                <p className="text-muted">平均最长连续</p>
                <p className="text-xl font-bold text-ink-800">
                  {avgMaxStreak} 天
                </p>
              </div>
              <div className="card text-center">
                <p className="text-muted">失败次数</p>
                <p className="text-xl font-bold text-warn-500">
                  {totalFail}
                </p>
              </div>
            </div>
          </section>

          {/* 每个目标的独立报告 */}
          {reports.map((report) => {
            const goal = goalMap.get(report.goal_id);
            const meta = goal ? GOAL_TYPES[goal.goal_type] : null;
            return (
              <section key={report.id}>
                <h2 className="text-h2 mb-3">
                  ▎{meta?.emoji} {meta?.label ?? "未知目标"}
                </h2>
                <div className="card text-center py-4">
                  <p className="font-semibold text-brand-500">
                    完成 {report.success_count}/{report.expected_checks} · 最长连续{" "}
                    {report.max_streak} 天
                  </p>
                </div>
                {report.ai_comment && (
                  <div className="card-ai mt-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-200 flex items-center justify-center text-xl shrink-0">
                        😏
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink-800 mb-1">
                          损友
                        </p>
                        <p className="text-body leading-relaxed whitespace-pre-wrap">
                          {report.ai_comment}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            );
          })}

          {/* 每日记录 */}
          <section>
            <h2 className="text-h2 mb-3">▎每日记录</h2>
            <div className="card space-y-2">
              {recentCheckins.map((c) => {
                const g = goalMap.get(c.goal_id);
                const label = g
                  ? `${GOAL_TYPES[g.goal_type].emoji} ${GOAL_TYPES[g.goal_type].label}`
                  : "?";
                const icon =
                  c.status === "success"
                    ? "✓"
                    : c.status === "failed"
                    ? "✗"
                    : "—";
                const color =
                  c.status === "success"
                    ? "text-success-500"
                    : c.status === "failed"
                    ? "text-warn-500"
                    : "text-ink-700/40";
                return (
                  <div key={c.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">
                        {c.checkin_date.slice(5)}
                      </span>
                      <span className="text-ink-700">{label}</span>
                      <span className={`font-bold ${color}`}>{icon}</span>
                    </div>
                    {c.note && (
                      <p className="mt-1 ml-8 text-xs text-ink-700/50 italic">
                        &ldquo;{c.note}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
              {recentCheckins.length === 0 && (
                <p className="text-muted text-center py-4">
                  这周没打卡记录
                </p>
              )}
            </div>
          </section>

          {/* 分享 */}
          <div className="relative">
            <button onClick={handleShare} className="btn-secondary">
              分享给朋友看看
            </button>
            {shareToast && (
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-ink-800 text-white text-xs px-3 py-1 rounded-lg whitespace-nowrap">
                {shareToast}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-6">
        <Link
          href="/dashboard"
          className="block text-center text-sm text-ink-700/60"
        >
          ← 回到今天
        </Link>
      </div>
    </main>
  );
}
