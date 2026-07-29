import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 服务端 Supabase Client（Server Components / Route Handlers 用）
export async function createSupabaseServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "缺少 Supabase 环境变量：请检查 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY 是否在 .env.local 中配置"
    );
  }

  const cookieStore = await cookies();
  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as never)
            );
          } catch (e) {
            // Server Component 中调用 set 会抛错（需在 Middleware/Route Handler 中 set）
            if (process.env.NODE_ENV !== "production") {
              console.warn("[supabase/server] cookie setAll skipped (expected in Server Components):", (e as Error).message);
            }
          }
        },
      },
    }
  );
}
