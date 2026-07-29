import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { generateAiFeedback } from "@/lib/ai/doubao";
import type { PersonaId } from "@/lib/ai/persona";
import {
  GOAL_TYPES,
  DIFFICULTIES,
  CLEAN_STREAK_DAYS,
} from "@/lib/constants";
import type { Goal, User, AiUserState } from "@/lib/types";
import {
  checkinPostSchema,
  checkinPatchSchema,
  parseBody,
} from "@/lib/validations";
import { checkRateLimit } from "@/lib/rateLimit";

// POST /api/checkin
// body: { goal_id: string }
// 逻辑：
//   1. 鉴权
//   2. 查 goal（确保属于该用户）
//   3. 校验今天是否已打卡（UNIQUE 约束兜底）
//   4. 写 checkins（status=success）
//   5. 更新 goals 冗余字段（current_streak++, best_streak, total_checkins）
//   6. 触发洗白：连续达标 7 天清空失败记录
//   7. 调 AI 生成反馈
//   8. 写 ai_feedback_logs
//   9. 返回 feedback + streak + feedback_log_id
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // Rate limit: 10 checkins per 60s per user
  if (!checkRateLimit(`checkin:${user.id}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "操作太频繁，请稍后再试" },
      { status: 429 }
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = parseBody(checkinPostSchema, rawBody);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { goal_id: goalId } = parsed.data;

  // 查 goal
  const { data: goal, error: goalErr } = await supabase
    .from("goals")
    .select("*")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single<Goal>();

  if (goalErr || !goal) {
    return NextResponse.json({ error: "目标不存在" }, { status: 404 });
  }

  // 查用户档案（拿 age / roast_enabled）
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single<User>();

  if (!profile) {
    return NextResponse.json({ error: "用户档案缺失" }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);

  // 检查今天是否已打卡
  const { data: existCheckin } = await supabase
    .from("checkins")
    .select("id, status")
    .eq("goal_id", goalId)
    .eq("checkin_date", today)
    .maybeSingle();

  // 如果已是 success，拒绝重复打卡
  if (existCheckin?.status === "success") {
    return NextResponse.json(
      { error: "今天已经打过卡了" },
      { status: 409 }
    );
  }

  // 写 checkins：如果已有一条 failed 记录则覆盖为 success
  const { data: updatedCheckin, error: insertErr } = await supabase.from("checkins").upsert(
    {
      goal_id: goalId,
      user_id: user.id,
      checkin_date: today,
      status: "success",
    },
    { onConflict: "goal_id,checkin_date" }
  ).select("id").single();

  if (insertErr) {
    console.error("[api/checkin] insert checkin error:", insertErr);
    return NextResponse.json({ error: "打卡失败" }, { status: 500 });
  }

  // 更新 goals 冗余字段
  const newStreak = goal.current_streak + 1;
  const newBest = Math.max(goal.best_streak, newStreak);
  const newTotal = goal.total_checkins + 1;

  await supabase
    .from("goals")
    .update({
      current_streak: newStreak,
      best_streak: newBest,
      total_checkins: newTotal,
    })
    .eq("id", goalId);

  // 触发洗白：连续达标 CLEAN_STREAK_DAYS 天，清空该目标的 failed 记录
  let cleaned = false;
  if (newStreak >= CLEAN_STREAK_DAYS) {
    const { error: delErr } = await supabase
      .from("checkins")
      .delete()
      .eq("goal_id", goalId)
      .eq("status", "failed");
    if (!delErr) cleaned = true;
  }

  // 生成场景描述
  const isFirstCheckin = goal.total_checkins === 0;
  const scenario = buildScenario(
    "checkin_success",
    goal,
    newStreak,
    isFirstCheckin,
    cleaned
  );

  // 调 AI
  const aiState: AiUserState = {
    scenario,
    goal_type: goal.goal_type,
    difficulty: goal.difficulty,
    streak: newStreak,
    consecutive_fail: 0, // 成功打卡，连续失败归 0
    age: profile.age,
    roast_enabled: profile.roast_enabled,
  };

  const persona: PersonaId = (profile.persona as PersonaId) ?? "bro";
  const ai = await generateAiFeedback(aiState, persona);

  // 写 ai_feedback_logs
  let feedbackLogId: string | null = null;
  if (ai.ok && ai.text) {
    const { data: logRow } = await supabase
      .from("ai_feedback_logs")
      .insert({
        user_id: user.id,
        goal_id: goalId,
        trigger_type: "checkin_success",
        scenario,
        consecutive_fail: 0,
        difficulty: goal.difficulty,
        streak: newStreak,
        age: profile.age,
        roast_enabled: profile.roast_enabled,
        ai_response: ai.text,
      })
      .select("id")
      .single();
    feedbackLogId = logRow?.id ?? null;
  }

  return NextResponse.json({
    ok: true,
    streak: newStreak,
    cleaned,
    checkin_id: updatedCheckin?.id ?? null,
    feedback: ai.ok ? ai.text : null,
    feedback_log_id: feedbackLogId,
    ai_error: ai.ok ? null : ai.error,
  });
}

// PATCH /api/checkin
// body: { checkin_id: string, note: string }
// 更新打卡感想
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = parseBody(checkinPatchSchema, rawBody);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { checkin_id: checkinId, note } = parsed.data;

  const { error } = await supabase
    .from("checkins")
    .update({ note })
    .eq("id", checkinId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// 根据场景生成简短描述，传给 AI
function buildScenario(
  trigger: "checkin_success" | "checkin_fail",
  goal: Goal,
  streak: number,
  isFirst: boolean,
  cleaned: boolean
): string {
  const label = GOAL_TYPES[goal.goal_type].label;
  if (trigger === "checkin_success") {
    if (cleaned) return `连续${CLEAN_STREAK_DAYS}天达标，触发洗白，目标：${label}`;
    if (isFirst) return `第1次${label}打卡成功`;
    if (streak >= 7) return `连续${streak}天${label}打卡成功（里程碑）`;
    if (streak >= 3) return `连续${streak}天${label}打卡成功`;
    return `${label}打卡成功`;
  }
  return `${label}今日未完成`;
}
