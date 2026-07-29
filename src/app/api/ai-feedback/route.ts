import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

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

  const body = await request.json().catch(() => ({}));
  const { feedback_log_id, reaction } = body;

  if (!feedback_log_id || !reaction) {
    return NextResponse.json(
      { error: "缺少参数" },
      { status: 400 }
    );
  }

  if (reaction !== "liked" && reaction !== "disliked") {
    return NextResponse.json(
      { error: "reaction 只能是 liked 或 disliked" },
      { status: 400 }
    );
  }

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
