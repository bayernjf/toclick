"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import Header from "@/components/Header";
import Toast from "@/components/Toast";
import { MINOR_AGE } from "@/lib/constants";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();

  const [roastEnabled, setRoastEnabled] = useState(true);
  const [age, setAge] = useState(25);
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("nickname, age, roast_enabled")
        .eq("id", user.id)
        .single();

      if (data) {
        setNickname(data.nickname);
        setAge(data.age);
        setRoastEnabled(data.roast_enabled);
      }
      setLoading(false);
    }
    load();
  }, [supabase, router]);

  async function toggleRoast(value: boolean) {
    // 未成年强制纯夸夸
    if (value && age < MINOR_AGE) {
      setToast("未成年账户强制纯夸夸模式");
      return;
    }
    setRoastEnabled(value);

    const { error } = await supabase.auth.getUser();
    if (error) return;
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    await supabase
      .from("users")
      .update({ roast_enabled: value })
      .eq("id", userId);

    setToast(value ? "毒舌模式已开，没做到会被损" : "关了，纯夸夸");
  }

  async function handleClearRecords() {
    if (!confirm("确定清空所有失败记录？这个操作不可撤销。")) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // 删除所有 failed 状态的 checkins
    await supabase
      .from("checkins")
      .delete()
      .eq("user_id", user.id)
      .eq("status", "failed");

    setToast("搞定，黑历史已蒸发");
  }

  if (loading) {
    return (
      <main className="px-5 py-6 min-h-screen">
        <Header title="设置" showBack />
        <div className="text-center py-20 text-muted">加载中…</div>
      </main>
    );
  }

  return (
    <main className="px-5 py-6 pb-16 min-h-screen">
      <Header title="设置" showBack />

      <div className="mt-6 space-y-6">
        {/* 个人信息 */}
        <section>
          <h2 className="text-h2 mb-3">▎个人信息</h2>
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-body">昵称</span>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="text-right text-sm bg-transparent focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-body">年龄</span>
              <span className="text-sm text-ink-700/70">{age}</span>
            </div>
          </div>
          {age < MINOR_AGE && (
            <p className="text-muted mt-2">
              未成年账户（&lt;{MINOR_AGE}岁）强制纯夸夸模式
            </p>
          )}
        </section>

        {/* 毒舌模式 */}
        <section>
          <h2 className="text-h2 mb-3">▎毒舌模式</h2>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-body font-medium">开启毒舌</p>
                <p className="text-muted mt-1">
                  开启后，没做到会被 AI 损
                  <br />
                  随时能关，关了就纯夸夸
                </p>
              </div>
              <button
                onClick={() => toggleRoast(!roastEnabled)}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  roastEnabled ? "bg-brand-500" : "bg-ink-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
                    roastEnabled ? "left-5.5" : "left-0.5"
                  }`}
                  style={{ left: roastEnabled ? "22px" : "2px" }}
                />
              </button>
            </div>
          </div>
        </section>

        {/* 数据 */}
        <section>
          <h2 className="text-h2 mb-3">▎数据</h2>
          <div className="card space-y-3">
            <button
              onClick={() => router.push("/report")}
              className="w-full flex items-center justify-between text-body"
            >
              <span>查看历史报告</span>
              <span className="text-ink-700/40">→</span>
            </button>
            <div className="border-t border-ink-100" />
            <button
              onClick={handleClearRecords}
              className="w-full flex items-center justify-between text-body text-warn-500"
            >
              <span>清空所有失败记录</span>
              <span className="text-ink-700/40">→</span>
            </button>
          </div>
        </section>

        {/* 关于 */}
        <section>
          <h2 className="text-h2 mb-3">▎关于</h2>
          <div className="card space-y-2">
            <p className="text-muted text-xs leading-relaxed">
              AI 反馈为娱乐性内容，不构成对您的人格评价。
            </p>
            <div className="border-t border-ink-100 my-2" />
            <p className="text-body">心理援助热线：12320</p>
            <p className="text-muted text-xs">
              全国卫生健康热线，24 小时
            </p>
          </div>
        </section>
      </div>

      {toast && (
        <Toast message={toast} onClose={() => setToast(null)} />
      )}
    </main>
  );
}
