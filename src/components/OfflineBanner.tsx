"use client";

import { useEffect, useState, useCallback } from "react";

/** 顶部离线状态条 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  const check = useCallback(() => setOffline(!navigator.onLine), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    check();
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    return () => {
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
    };
  }, [check]);

  if (!offline) return null;

  return (
    <div className="bg-ink-700 text-white text-xs text-center py-1.5 font-medium">
      ⚡️ 当前离线 · 操作将在联网后自动提交
    </div>
  );
}
