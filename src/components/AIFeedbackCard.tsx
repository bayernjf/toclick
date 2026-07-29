"use client";

import { useState } from "react";
import { PERSONA_MAP, DEFAULT_PERSONA } from "@/lib/ai/persona";
import type { PersonaId } from "@/lib/ai/persona";

type Props = {
  feedback: string;
  streak?: number;
  milestone?: number | null;
  persona?: PersonaId;
  onClose: () => void;
  onReact: (reaction: "liked" | "disliked") => void;
  onNote?: (note: string) => Promise<void>;
};

export default function AIFeedbackCard({
  feedback,
  streak,
  milestone,
  persona: personaId = DEFAULT_PERSONA,
  onClose,
  onReact,
  onNote,
}: Props) {
  const [reacted, setReacted] = useState<"liked" | "disliked" | null>(null);
  const p = PERSONA_MAP[personaId] ?? PERSONA_MAP[DEFAULT_PERSONA];
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  function handleReact(r: "liked" | "disliked") {
    if (reacted) return;
    setReacted(r);
    onReact(r);
  }

  async function handleSaveNote() {
    if (!onNote || !note.trim() || noteSaved) return;
    setSavingNote(true);
    try {
      await onNote(note.trim());
      setNoteSaved(true);
    } catch {
      // silently fail
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md bg-ink-50 rounded-t-3xl sm:rounded-3xl p-6 pb-8 animate-in">
        {/* AI 头像 */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-20 h-20 rounded-full bg-brand-200 flex items-center justify-center text-4xl mb-2">
            {p.emoji}
          </div>
          <span className="text-sm font-medium text-ink-700">{p.label}</span>
        </div>

        {/* 反馈文案（核心） */}
        <p className="text-lg leading-relaxed text-center text-ink-800 mb-6 min-h-[3rem]">
          {feedback}
        </p>

        {/* 进度提示 */}
        {streak !== undefined && streak > 0 && (
          <p className="text-muted text-center mb-5">
            连续 {streak} 天
            {milestone ? ` · 再坚持 ${milestone - streak} 天解锁成就` : ""}
          </p>
        )}

        {/* 打卡感想（可选输入） */}
        {onNote && (
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="写句感想？（打鸡血专用）"
                maxLength={200}
                disabled={noteSaved}
                className="flex-1 h-11 px-4 rounded-xl bg-white dark:bg-ink-100 border border-ink-100 dark:border-ink-200 text-sm text-ink-700 placeholder:text-ink-700/30 dark:placeholder:text-ink-300/30 focus:outline-none focus:border-brand-300 disabled:bg-ink-50 disabled:text-ink-700/50"
              />
              {!noteSaved && note.trim() && (
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote}
                  className="shrink-0 h-11 px-4 rounded-xl bg-brand-500 text-white text-sm font-medium active:bg-brand-600 disabled:opacity-50"
                >
                  {savingNote ? "..." : "保存"}
                </button>
              )}
              {noteSaved && (
                <span className="shrink-0 text-success-500 text-sm font-medium">
                  ✓ 已记下
                </span>
              )}
            </div>
          </div>
        )}

        {/* 反应按钮 */}
        <div className="flex justify-center gap-3 mb-6">
          <button
            onClick={() => handleReact("liked")}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-colors ${
              reacted === "liked"
                ? "bg-success-500/20"
                : "bg-white dark:bg-ink-100 border border-ink-100 dark:border-ink-200 active:bg-ink-100 dark:active:bg-ink-200"
            }`}
          >
            😂
          </button>
          <button
            onClick={() => handleReact("disliked")}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-colors ${
              reacted === "disliked"
                ? "bg-warn-500/20"
                : "bg-white dark:bg-ink-100 border border-ink-100 dark:border-ink-200 active:bg-ink-100 dark:active:bg-ink-200"
            }`}
          >
            👎
          </button>
        </div>

        {/* 关闭按钮 */}
        <button onClick={onClose} className="btn-secondary">
          知道了
        </button>
      </div>
    </div>
  );
}
