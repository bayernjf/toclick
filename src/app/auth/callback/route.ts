import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

// 邮箱 magic link 回调
// Supabase 会带着 code 跳转到 /auth/callback?code=xxx
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession error:", error);
  }

  // 出错回登录页
  return NextResponse.redirect(`${origin}/login?error=1`);
}
