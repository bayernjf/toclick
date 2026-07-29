import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Goal } from "@/lib/types";

// POST /api/checkin/sync
// Dashboard 加载时调用：自动补填昨天缺失的失败记录
// 今天不动——留给用户手动操作或 cron 午夜标记
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // 查询当前用户的活跃目标
  const { data: goals } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .returns<Goal[]>();

  if (!goals || goals.length === 0) {
    return NextResponse.json({ ok: true, synced: 0 });
  }

  let syncedCount = 0;

  for (const goal of goals) {
    // 目标必须在昨天之前创建，否则昨天还不存在
    const goalCreatedAt = new Date(goal.created_at);
    const yesterdayDate = new Date(yesterdayStr);
    if (yesterdayDate <= goalCreatedAt) {
      continue;
    }

    // 检查昨天是否已有打卡记录
    const { data: existing } = await supabase
      .from("checkins")
      .select("id")
      .eq("goal_id", goal.id)
      .eq("checkin_date", yesterdayStr)
      .maybeSingle();

    if (existing) continue;

    // 插入 failed 记录
    const { error: insertErr } = await supabase.from("checkins").insert({
      goal_id: goal.id,
      user_id: goal.user_id,
      checkin_date: yesterdayStr,
      status: "failed",
    });

    if (insertErr) {
      console.error(
        `sync failed for goal=${goal.id} date=${yesterdayStr}:`,
        insertErr.message
      );
      continue;
    }

    // 更新目标统计：连胜归零，失败+1
    await supabase
      .from("goals")
      .update({
        current_streak: 0,
        total_fails: goal.total_fails + 1,
      })
      .eq("id", goal.id);

    goal.total_fails += 1;
    syncedCount++;
  }

  return NextResponse.json({
    ok: true,
    synced: syncedCount,
    checked_goals: goals.length,
  });
}
