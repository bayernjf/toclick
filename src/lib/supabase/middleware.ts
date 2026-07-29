import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 中间件用：刷新 Auth session，把 cookie 同步给浏览器
// 注意：env 缺失时跳过（让落地页在未配置时也能打开）
export function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // env 未配置时直接放行，不创建 Supabase client
  // 这种情况下页面/布局里调用 supabase 会自行报错并引导用户配置
  if (!supabaseUrl || !supabaseKey) {
    return {
      supabase: null,
      response: NextResponse.next({ request }),
    };
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as never)
        );
      },
    },
  });

  return { supabase, response };
}
