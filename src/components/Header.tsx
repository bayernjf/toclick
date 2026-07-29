"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";

type Props = {
  title?: string;
  showBack?: boolean;
  showMenu?: boolean;
};

export default function Header({ title, showBack, showMenu = true }: Props) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <header className="flex items-center justify-between h-12 px-5">
      {showBack ? (
        <button
          onClick={() => router.back()}
          className="text-sm text-ink-700/60 -ml-1 px-1 h-8"
        >
          ← 返回
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xl">🚩</span>
          <span className="font-bold">反旗</span>
        </div>
      )}

      {title && <span className="text-sm font-medium">{title}</span>}

      {showMenu ? (
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="w-8 h-8 flex items-center justify-center text-ink-700/70"
          >
            ⚙️
          </Link>
          <button
            onClick={handleLogout}
            className="text-xs text-ink-700/50 px-2 h-8"
          >
            退出
          </button>
        </div>
      ) : null}
    </header>
  );
}
