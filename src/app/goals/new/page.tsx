"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Toast from "@/components/Toast";
import { createSupabaseClient } from "@/lib/supabase/client";
import { GOAL_TYPES, DIFFICULTIES } from "@/lib/constants";
import type { GoalType, Difficulty } from "@/lib/constants";

export default function NewGoalPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();

  const [step, setStep] = useState(1);
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [checkinTime, setCheckinTime] = useState("08:00");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleSubmit() {
    if (!goalType) {
      setToast("先选个目标类型");
      return;
    }
    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      goal_type: goalType,
      difficulty,
      checkin_time: `${checkinTime}:00`,
    });

    setSubmitting(false);

    if (error) {
      console.error("[goals/new] insert error:", error);
      setToast("提交失败，再来一次");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="px-5 py-6 pb-16 min-h-screen">
      <Header title="设个目标" showBack />

      <div className="mt-6">
        {/* 步骤 1：选目标类型 */}
        <section className="mb-8">
          <p className="text-muted mb-3">第 1 步 / 共 3 步</p>
          <h2 className="text-h2 mb-4">▎你想干啥？</h2>
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(GOAL_TYPES) as GoalType[]).map((key) => {
              const t = GOAL_TYPES[key];
              const selected = goalType === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setGoalType(key);
                    setStep(Math.max(step, 2));
                  }}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-colors ${
                    selected
                      ? "bg-brand-500 text-white border-2 border-brand-500"
                      : "bg-white dark:bg-ink-100 border border-ink-100 dark:border-ink-200 active:bg-ink-100 dark:active:bg-ink-200"
                  }`}
                >
                  <span className="text-3xl">{t.emoji}</span>
                  <span className="text-sm font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 步骤 2：选难度 */}
        <section className="mb-8">
          <p className="text-muted mb-3">第 2 步 / 共 3 步</p>
          <h2 className="text-h2 mb-1">▎难度选一个</h2>
          <p className="text-muted mb-4">难度影响它损你的力度</p>
          <div className="space-y-2">
            {(Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => {
              const d = DIFFICULTIES[key];
              const selected = difficulty === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setDifficulty(key);
                    setStep(Math.max(step, 3));
                  }}
                  className={`w-full p-4 rounded-xl text-left transition-colors ${
                    selected
                      ? "bg-brand-50 border-2 border-brand-400"
                      : "bg-white dark:bg-ink-100 border border-ink-100 dark:border-ink-200 active:bg-ink-100 dark:active:bg-ink-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink-800 dark:text-ink-200">
                      {d.label}
                    </span>
                    {selected && <span className="text-brand-500">✓</span>}
                  </div>
                  <p className="text-sm text-ink-700/70 dark:text-ink-300/70 mt-1">
                    {d.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* 步骤 3：时间 + 毒舌开关 */}
        <section className="mb-8">
          <p className="text-muted mb-3">第 3 步 / 共 3 步</p>
          <h2 className="text-h2 mb-4">▎每天几点打卡？</h2>
          <input
            type="time"
            value={checkinTime}
            onChange={(e) => setCheckinTime(e.target.value)}
            className="w-full h-12 px-4 rounded-xl bg-white dark:bg-ink-100 border border-ink-200 dark:border-ink-300 text-base focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-100/25"
          />
        </section>

        {/* 提交 */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !goalType}
          className="btn-primary"
        >
          {submitting ? "把你的 flag 钉墙上…" : "立好，开干"}
        </button>
      </div>

      {toast && (
        <Toast message={toast} type="error" onClose={() => setToast(null)} />
      )}
    </main>
  );
}
