"use client";

import { createBrowserClient } from "@supabase/ssr";

// 浏览器端 Supabase Client（Client Components 用）
export function createSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
