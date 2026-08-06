import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { generateAiFeedback } from "@/lib/ai/doubao";
import type { PersonaId } from "@/lib/ai/persona";
import { GOAL_TYPES } from "@/lib/constants";
import type { Goal, User, AiUserState } from "@/lib/types";
import {
  aiFeedbackGetSchema,
  aiFeedbackPatchSchema,
  parseBody,
  parseQuery,
} from "@/lib/validations";
import { checkRateLimit } from "@/lib/rateLimit";

// GET /api/ai-feedback?goal_id=xxx&date=2026-07-29
// 获取某目标在某日期的 AI 反馈（优先查日志，无则实时生成）
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const parsed = parseQuery(aiFeedbackGetSchema, request.url);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { goal_id: goalId, date } = parsed.data;

  // 先查日志（已由 cron 预生成的反馈）
  const { data: existing } = await supabase
    .from("ai_feedback_logs")
    .select("id, ai_response")
    .eq("goal_id", goalId)
    .eq("trigger_type", "checkin_fail")
    .gte("created_at", date)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.ai_response) {
    return NextResponse.json({
      ok: true,
      feedback: existing.ai_response,
      feedback_log_id: existing.id,
    });
  }

  // 没有预生成 → 实时生成（兜底）
  // Rate limit: 5 real-time AI generations per 60s per user
  if (!checkRateLimit(`aigen:${user.id}`, 5, 60_000)) {
    return NextResponse.json(
      { error: "操作太频繁，请稍后再试" },
      { status: 429 }
    );
  }

  const { data: goal } = await supabase
    .from("goals")
    .select("*")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .single<Goal>();

  if (!goal) {
    return NextResponse.json({ error: "目标不存在" }, { status: 404 });
  }

  if (!process.env.ARK_API_KEY) {
    return NextResponse.json({
      ok: true,
      feedback: `📢 ${GOAL_TYPES[goal.goal_type].label}今天挂了，连续失败中…明天继续加油吧`,
    });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single<User>();

  // 计算连续失败数
  const { data: consecutiveFail } = await supabase.rpc(
    "get_consecutive_fails",
    { p_goal_id: goalId }
  );

  const scenario = `${GOAL_TYPES[goal.goal_type].label}今日未完成`;

  const aiState: AiUserState = {
    scenario,
    goal_type: goal.goal_type,
    difficulty: goal.difficulty,
    streak: 0,
    consecutive_fail: (consecutiveFail as number) ?? 1,
    age: profile?.age ?? 0,
    roast_enabled: profile?.roast_enabled ?? true,
  };

  const persona: PersonaId = (profile?.persona as PersonaId) ?? "bro";
  const ai = await generateAiFeedback(aiState, persona);

  if (ai.ok && ai.text) {
    // 写入日志
    const { data: newLog } = await supabase
      .from("ai_feedback_logs")
      .insert({
        user_id: user.id,
        goal_id: goalId,
        trigger_type: "checkin_fail",
        scenario,
        consecutive_fail: aiState.consecutive_fail,
        difficulty: goal.difficulty,
        streak: 0,
        age: aiState.age,
        roast_enabled: aiState.roast_enabled,
        ai_response: ai.text,
      })
      .select("id")
      .single();

    return NextResponse.json({
      ok: true,
      feedback: ai.text,
      feedback_log_id: newLog?.id ?? null,
    });
  }

  return NextResponse.json({ error: "AI 生成失败" }, { status: 500 });
}

// PATCH /api/ai-feedback
// body: { feedback_log_id: string, reaction: 'liked' | 'disliked' }
// 用于采集用户对 AI 反馈的偏好（哈哈/👎），优化 prompt
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = parseBody(aiFeedbackPatchSchema, rawBody);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { feedback_log_id, reaction } = parsed.data;

  const { error } = await supabase
    .from("ai_feedback_logs")
    .update({ user_reaction: reaction })
    .eq("id", feedback_log_id)
    .eq("user_id", user.id); // RLS 兜底再校验一次

  if (error) {
    console.error("[api/ai-feedback] update error:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
