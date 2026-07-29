"use client";

import { useState } from "react";

type Props = {
  feedback: string;
  streak?: number;
  milestone?: number | null;
  onClose: () => void;
  onReact: (reaction: "liked" | "disliked") => void;
};

export default function AIFeedbackCard({
  feedback,
  streak,
  milestone,
  onClose,
  onReact,
}: Props) {
  const [reacted, setReacted] = useState<"liked" | "disliked" | null>(null);

  function handleReact(r: "liked" | "disliked") {
    if (reacted) return;
    setReacted(r);
    onReact(r);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md bg-ink-50 rounded-t-3xl sm:rounded-3xl p-6 pb-8 animate-in">
        {/* AI 头像 */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-20 h-20 rounded-full bg-brand-200 flex items-center justify-center text-4xl mb-2">
            😏
          </div>
          <span className="text-sm font-medium text-ink-700">损友</span>
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

        {/* 反应按钮 */}
        <div className="flex justify-center gap-3 mb-6">
          <button
            onClick={() => handleReact("liked")}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-colors ${
              reacted === "liked"
                ? "bg-success-500/20"
                : "bg-white border border-ink-100 active:bg-ink-100"
            }`}
          >
            😂
          </button>
          <button
            onClick={() => handleReact("disliked")}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-colors ${
              reacted === "disliked"
                ? "bg-warn-500/20"
                : "bg-white border border-ink-100 active:bg-ink-100"
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
