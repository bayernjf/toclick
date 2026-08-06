import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { z } from "zod";
import { parseBody } from "@/lib/validations";

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

// POST /api/push/unsubscribe
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = parseBody(unsubscribeSchema, rawBody);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { endpoint } = parsed.data;

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    console.error("[api/push/unsubscribe] delete error:", error);
    return NextResponse.json({ error: "取消订阅失败" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
