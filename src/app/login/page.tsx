"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setToast(null);

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      setToast(`发送失败：${error.message}`);
    } else {
      setToast("验证邮件已发送到你的邮箱，点里面的链接登录");
    }
  }

  return (
    <main className="px-5 py-6 min-h-screen flex flex-col">
      <header className="flex items-center h-12 mb-10">
        <Link href="/" className="text-sm text-ink-700/60">
          ← 返回
        </Link>
      </header>

      <div className="mb-8">
        <h1 className="text-h1 mb-2">开始立 flag</h1>
        <p className="text-body">填邮箱就行，不用密码</p>
      </div>

      <form onSubmit={handleMagicLink} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-800 mb-2">
            邮箱
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full h-12 px-4 rounded-xl bg-white border border-ink-200 text-base
                       focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
        >
          {loading ? "发送中…" : "发送登录链接"}
        </button>
      </form>

      {toast && (
        <div className="mt-6 p-4 rounded-xl bg-brand-50 border border-brand-100 text-sm text-ink-700">
          {toast}
        </div>
      )}

      <div className="flex-1" />

      <p className="text-muted text-center mt-10">
        登录即同意用户协议与隐私政策
      </p>
    </main>
  );
}
