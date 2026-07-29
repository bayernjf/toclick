import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { generateAiFeedback } from "@/lib/ai/doubao";
import type { PersonaId } from "@/lib/ai/persona";
import {
  GOAL_TYPES,
  PROTECTION_MODE_THRESHOLD,
} from "@/lib/constants";
import type { Goal, User, AiUserState } from "@/lib/types";

// POST /api/cron
// 由 Supabase pg_cron / Vercel Cron / 外部定时任务 调用
// 每天 23:59 触发：自动将今日未打卡的活跃目标标记为 failed
// Body: { secret: string } — 需匹配 CRON_SECRET 环境变量
export async function POST(request: Request) {
  // 1. 鉴权
  const body = await request.json().catch(() => ({}));
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || body.secret !== cronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  // 2. 查询所有活跃目标
  const { data: goals } = await supabase
    .from("goals")
    .select("*")
    .eq("is_active", true)
    .returns<Goal[]>();

  if (!goals || goals.length === 0) {
    return NextResponse.json({ ok: true, failed: 0, message: "no active goals" });
  }

  const results: Array<{
    goal_id: string;
    status: "skipped" | "failed" | "error";
    detail: string;
    ai_feedback?: string | null;
  }> = [];

  // 3. 逐目标处理
  for (const goal of goals) {
    try {
      // 当天创建的目标不标记（用户可能当天设置，明天开始）
      const goalCreatedDate = goal.created_at.slice(0, 10);
      if (goalCreatedDate === today) {
        results.push({
          goal_id: goal.id,
          status: "skipped",
          detail: "goal created today, skipping",
        });
        continue;
      }

      // 检查今天是否已有打卡记录
      const { data: exist } = await supabase
        .from("checkins")
        .select("id, status")
        .eq("goal_id", goal.id)
        .eq("checkin_date", today)
        .maybeSingle();

      if (exist) {
        // 已有记录，跳过
        continue;
      }

      // 检查打卡时间是否已过
      const [hh, mm] = goal.checkin_time.split(":");
      const deadline = new Date();
      deadline.setHours(Number(hh), Number(mm), 0, 0);

      if (now <= deadline) {
        // 打卡时间还没到，不标记失败
        results.push({
          goal_id: goal.id,
          status: "skipped",
          detail: `checkin time not yet reached (${goal.checkin_time})`,
        });
        continue;
      }

      // 过去打卡时间且未打卡 → 标记 failed
      const { error: insertErr } = await supabase.from("checkins").insert({
        goal_id: goal.id,
        user_id: goal.user_id,
        checkin_date: today,
        status: "failed",
      });

      if (insertErr) {
        results.push({
          goal_id: goal.id,
          status: "error",
          detail: insertErr.message,
        });
        continue;
      }

      // 更新 goals 统计：连胜归零，失败计数+1
      await supabase
        .from("goals")
        .update({
          current_streak: 0,
          total_fails: goal.total_fails + 1,
        })
        .eq("id", goal.id);

      // 计算连续失败天数
      const consecutiveFail = await getConsecutiveFails(supabase, goal.id);

      // 生成 AI 反馈
      const scenario = `${GOAL_TYPES[goal.goal_type].label}今日未完成`;
      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", goal.user_id)
        .single<User>();

      let aiText: string | null = null;

      if (profile && process.env.ARK_API_KEY) {
        const aiState: AiUserState = {
          scenario,
          goal_type: goal.goal_type,
          difficulty: goal.difficulty,
          streak: 0,
          consecutive_fail: consecutiveFail,
          age: profile.age,
          roast_enabled: profile.roast_enabled,
        };

        const persona: PersonaId = (profile.persona as PersonaId) ?? "bro";
        const ai = await generateAiFeedback(aiState, persona);

        if (ai.ok && ai.text) {
          aiText = ai.text;
          // 写审计日志
          await supabase.from("ai_feedback_logs").insert({
            user_id: goal.user_id,
            goal_id: goal.id,
            trigger_type: "checkin_fail",
            scenario,
            consecutive_fail: consecutiveFail,
            difficulty: goal.difficulty,
            streak: 0,
            age: profile.age,
            roast_enabled: profile.roast_enabled,
            ai_response: ai.text,
          });
        }
      }

      results.push({
        goal_id: goal.id,
        status: "failed" as const,
        detail: `marked failed, consecutive_fails=${consecutiveFail}`,
        ai_feedback: aiText,
      });
    } catch (e) {
      results.push({
        goal_id: goal.id,
        status: "error",
        detail: String(e),
      });
    }
  }

  const failedCount = results.filter((r) => r.status === "failed").length;

  // 4. 周一 → 自动生成上周周报
  let weeklyReportsGenerated = 0;
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon
  if (dayOfWeek === 1) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - 1); // yesterday (Sunday)
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6); // previous Monday

    const start = weekStart.toISOString().slice(0, 10);
    const end = weekEnd.toISOString().slice(0, 10);

    weeklyReportsGenerated = await generateWeeklyReports(supabase, start, end, goals);
  }

  return NextResponse.json({
    ok: true,
    date: today,
    total_goals: goals.length,
    failed: failedCount,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    weekly_reports: weeklyReportsGenerated,
    details: results,
  });
}

// 为所有活跃目标生成上周周报
async function generateWeeklyReports(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  weekStart: string,
  weekEnd: string,
  goals: Goal[]
): Promise<number> {
  let count = 0;

  for (const goal of goals) {
    try {
      // 目标必须在周报周期之前创建
      if (goal.created_at.slice(0, 10) > weekEnd) continue;

      // 检查是否已生成过该周期的报告
      const { data: existReport } = await supabase
        .from("weekly_reports")
        .select("id")
        .eq("goal_id", goal.id)
        .eq("week_start", weekStart)
        .maybeSingle();

      if (existReport) continue;

      // 统计本周打卡数据
      const { data: checkins } = await supabase
        .from("checkins")
        .select("status")
        .eq("goal_id", goal.id)
        .gte("checkin_date", weekStart)
        .lte("checkin_date", weekEnd);

      const total = checkins?.length ?? 0;
      const successCount = checkins?.filter((c) => c.status === "success").length ?? 0;
      const failCount = checkins?.filter((c) => c.status === "failed").length ?? 0;

      // 以当前最新连胜/最佳连胜为准
      const { data: currentGoal } = await supabase
        .from("goals")
        .select("current_streak, best_streak")
        .eq("id", goal.id)
        .single();

      const streakCount = currentGoal?.current_streak ?? 0;
      const bestStreak = currentGoal?.best_streak ?? 0;

      // AI 周报评语
      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", goal.user_id)
        .single<User>();

      let aiComment = "";
      if (profile && process.env.ARK_API_KEY) {
        const streakStr =
          successCount >= 6
            ? "表现优秀"
            : failCount >= 5
            ? "惨不忍睹"
            : successCount > failCount
            ? "差强人意"
            : "一塌糊涂";

        const aiState: AiUserState = {
          scenario: `${GOAL_TYPES[goal.goal_type].label}一周总结：共${total}天，成功${successCount}天，失败${failCount}天，整体${streakStr}`,
          goal_type: goal.goal_type,
          difficulty: goal.difficulty,
          streak: streakCount,
          consecutive_fail: failCount,
          age: profile.age,
          roast_enabled: profile.roast_enabled,
        };

        const persona2: PersonaId = (profile.persona as PersonaId) ?? "bro";
        const ai = await generateAiFeedback(aiState, persona2);
        if (ai.ok && ai.text) {
          aiComment = ai.text;
        }
      }

      await supabase.from("weekly_reports").insert({
        goal_id: goal.id,
        user_id: goal.user_id,
        week_start: weekStart,
        week_end: weekEnd,
        total_goals: 1,            // 本报告针对单个目标
        expected_checks: 7,        // 一周共 7 天
        checkins_count: total,     // 实际打卡次数
        success_count: successCount,
        fail_count: failCount,
        max_streak: bestStreak,    // 对齐 schema 字段名
        ai_comment: aiComment || undefined,
      });

      count++;
    } catch (e) {
      console.error(`weekly report error for goal=${goal.id}:`, e);
    }
  }

  return count;
}

// 查询某目标连续失败天数（调用数据库函数）
async function getConsecutiveFails(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  goalId: string
): Promise<number> {
  const { data } = await supabase.rpc("get_consecutive_fails", {
    p_goal_id: goalId,
  });
  return (data as number) ?? 0;
}
