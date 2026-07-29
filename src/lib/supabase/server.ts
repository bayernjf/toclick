import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 服务端 Supabase Client（Server Components / Route Handlers 用）
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
          } catch {
            // 在 Server Component 中调用 set 会抛错，可忽略
            // Route Handler 中可以正常 set
          }
        },
      },
    }
  );
}
