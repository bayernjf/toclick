"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body className="bg-ink-100 dark:bg-black text-ink-900 dark:text-white">
        <main className="flex flex-col items-center justify-center min-h-screen px-5">
          <h1 className="text-h1 mb-4">出错啦</h1>
          <p className="text-muted mb-8 text-center max-w-sm">
            应用遇到了一些问题。错误已自动上报，我们会尽快处理。
          </p>
          <button onClick={() => reset()} className="btn-primary">
            重试
          </button>
        </main>
      </body>
    </html>
  );
}
