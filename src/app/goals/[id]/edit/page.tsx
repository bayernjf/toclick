"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Header from "@/components/Header";
import Toast from "@/components/Toast";
import { createSupabaseClient } from "@/lib/supabase/client";
import { GOAL_TYPES, DIFFICULTIES } from "@/lib/constants";
import type { GoalType, Difficulty } from "@/lib/constants";
import type { Goal } from "@/lib/types";

export default function EditGoalPage() {
  const router = useRouter();
  const params = useParams();
  const goalId = params.id as string;
  const supabase = createSupabaseClient();

  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [checkinTime, setCheckinTime] = useState("08:00");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Load goal data
  useEffect(() => {
    async function loadGoal() {
      const { data: goalData, error } = await supabase
        .from("goals")
        .select("*")
        .eq("id", goalId)
        .eq("is_active", true)
        .single<Goal>();

      if (error || !goalData) {
        setToast("目标不存在");
        setTimeout(() => router.push("/settings"), 1500);
        return;
      }

      setGoal(goalData);
      setGoalType(goalData.goal_type as GoalType);
      setDifficulty(goalData.difficulty as Difficulty);
      setCheckinTime((goalData.checkin_time ?? "08:00").slice(0, 5));
      setLoading(false);
    }
    loadGoal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId]);

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

    const resp = await fetch(`/api/goals/${goalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal_type: goalType,
        difficulty,
        checkin_time: `${checkinTime}:00`,
      }),
    });

    setSubmitting(false);

    if (!resp.ok) {
      const data = await resp.json();
      setToast(data?.error || "更新失败");
      return;
    }

    router.push("/settings");
  }

  async function handleDelete() {
    setDeleting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const resp = await fetch(`/api/goals/${goalId}`, { method: "DELETE" });
    setDeleting(false);

    if (!resp.ok) {
      const data = await resp.json();
      setToast(data?.error || "删除失败");
      return;
    }

    router.push("/settings");
  }

  if (loading) {
    return (
      <main className="px-5 py-6 pb-16 min-h-screen">
        <Header title="编辑目标" showBack />
        <div className="text-center py-20 text-muted">加载中…</div>
      </main>
    );
  }

  return (
    <main className="px-5 py-6 pb-16 min-h-screen">
      <Header title="编辑目标" showBack />

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

        {/* 步骤 3：时间 */}
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
          {submitting ? "更新中…" : "保存修改"}
        </button>

        {/* 删除 */}
        <section className="mt-10 pt-6 border-t border-ink-100 dark:border-ink-200">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-error text-sm underline"
            >
              删除这个目标
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-error">
                确定要删除吗？打卡记录会保留，但目标将停用。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 h-10 rounded-xl bg-error text-white font-medium text-sm active:opacity-80"
                >
                  {deleting ? "删除中…" : "确认删除"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 h-10 rounded-xl bg-white dark:bg-ink-100 border border-ink-100 dark:border-ink-200 text-sm font-medium text-ink-700"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {toast && (
        <Toast message={toast} type="error" onClose={() => setToast(null)} />
      )}
    </main>
  );
}
