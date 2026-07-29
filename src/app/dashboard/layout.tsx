import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

// 鉴权 layout：未登录跳走
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 同步业务 users 表（trigger 已自动建行，这里读一下确保存在）
  const { data: profile } = await supabase
    .from("users")
    .select("id, nickname, age, roast_enabled")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // trigger 没生效的兜底
    await supabase.from("users").insert({
      id: user.id,
      nickname: user.email?.split("@")[0] || "匿名用户",
    });
  }

  return <>{children}</>;
}
