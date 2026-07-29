import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import Header from "@/components/Header";
import { GOAL_TYPES } from "@/lib/constants";
import type { WeeklyReport, Checkin, Goal } from "@/lib/types";

export default async function ReportPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 取最近一份周报
  const { data: report } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("user_id", user.id)
    .order("week_start", { ascending: false })
    .limit(1)
    .single<WeeklyReport>();

  // 取最近 7 天打卡明细
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: recentCheckins } = await supabase
    .from("checkins")
    .select("*")
    .eq("user_id", user.id)
    .gte("checkin_date", sevenDaysAgo.toISOString().slice(0, 10))
    .order("checkin_date", { ascending: true })
    .returns<Checkin[]>();

  // 取所有目标（用于映射 goal_id → type）
  const { data: goals } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .returns<Goal[]>();

  const goalMap = new Map((goals ?? []).map((g) => [g.id, g]));

  return (
    <main className="px-5 py-6 pb-16 min-h-screen">
      <Header title="我的 7 日报告" showBack />

      {!report ? (
        <div className="card text-center py-12 mt-6">
          <div className="text-5xl mb-3">📅</div>
          <p className="text-body mb-1">还没满 7 天</p>
          <p className="text-muted">下周来拿你的第一份报告</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* 时间范围 */}
          <p className="text-muted">
            {report.week_start} - {report.week_end}
          </p>

          {/* 战绩 */}
          <section>
            <h2 className="text-h2 mb-3">▎本周战绩</h2>
            <div className="card text-center py-6">
              <p className="text-3xl font-bold text-brand-500">
                完成 {report.success_count} / {report.expected_checks}
              </p>
              <p className="text-body mt-1">
                完成率{" "}
                {report.expected_checks > 0
                  ? Math.round(
                      (report.success_count / report.expected_checks) * 100
                    )
                  : 0}
                %
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="card text-center">
                <p className="text-muted">最长连续</p>
                <p className="text-xl font-bold text-ink-800">
                  {report.max_streak} 天
                </p>
              </div>
              <div className="card text-center">
                <p className="text-muted">失败次数</p>
                <p className="text-xl font-bold text-warn-500">
                  {report.fail_count}
                </p>
              </div>
            </div>
          </section>

          {/* 每日记录 */}
          <section>
            <h2 className="text-h2 mb-3">▎每日记录</h2>
            <div className="card space-y-2">
              {(recentCheckins ?? []).map((c) => {
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
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted">
                      {c.checkin_date.slice(5)}
                    </span>
                    <span className="text-ink-700">{label}</span>
                    <span className={`font-bold ${color}`}>{icon}</span>
                  </div>
                );
              })}
              {(!recentCheckins || recentCheckins.length === 0) && (
                <p className="text-muted text-center py-4">
                  这周没打卡记录
                </p>
              )}
            </div>
          </section>

          {/* AI 点评 */}
          {report.ai_comment && (
            <section>
              <h2 className="text-h2 mb-3">▎损友点评</h2>
              <div className="card-ai">
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
            </section>
          )}

          {/* 分享 */}
          <button className="btn-secondary">分享给朋友看看</button>
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
