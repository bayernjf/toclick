import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { goalUpdateSchema, parseBody } from "@/lib/validations";

// PATCH /api/goals/[id] — update goal
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  // Verify goal belongs to user
  const { data: goal, error: goalErr } = await supabase
    .from("goals")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (goalErr || !goal) {
    return NextResponse.json(
      { ok: false, error: "目标不存在" },
      { status: 404 },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = parseBody(goalUpdateSchema, rawBody);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.error },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("goals")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[api/goals] PATCH error:", error);
    return NextResponse.json({ ok: false, error: "更新失败" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/goals/[id] — soft-delete goal (set is_active=false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  // Verify goal belongs to user
  const { data: goal, error: goalErr } = await supabase
    .from("goals")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (goalErr || !goal) {
    return NextResponse.json(
      { ok: false, error: "目标不存在" },
      { status: 404 },
    );
  }

  // Soft-delete: set is_active = false
  const { error } = await supabase
    .from("goals")
    .update({ is_active: false })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[api/goals] DELETE error:", error);
    return NextResponse.json({ ok: false, error: "删除失败" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
