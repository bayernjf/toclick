import { createClient } from "@supabase/supabase-js";

// Service-role client：绕过 RLS，仅限服务端受控路径（如 /api/cron）使用。
// 严禁在客户端组件中 import 本模块；SUPABASE_SERVICE_ROLE_KEY 不带 NEXT_PUBLIC_ 前缀，
// Next.js 不会将其打进客户端 bundle。
export function createSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "缺少 Supabase 环境变量：请在服务端环境配置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
