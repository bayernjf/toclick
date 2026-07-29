"use client";

import { useEffect, useState } from "react";

/**
 * 注册 Service Worker + 更新提示条
 * 放在 layout 中全局生效
 */
export default function SWRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator))
      return;

    let refreshing = false;

    async function register() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // 如果有 waiting worker，说明有更新就绪
        if (reg.waiting) {
          setUpdateReady(true);
        }

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // 新 SW 安装完毕，等待激活
              setUpdateReady(true);
            }
          });
        });

        // 监听 controllerchange → 页面已切换到新 SW
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      } catch (err) {
        console.warn("[sw] register failed:", err);
      }
    }

    register();
  }, []);

  /** 用户点击「刷新」，触发 skipWaiting → 页面重启 */
  async function handleUpdate() {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg?.waiting) {
      window.location.reload();
      return;
    }
    // 通知 waiting worker 立即激活
    reg.waiting.postMessage({ type: "SKIP_WAITING" });
  }

  if (!updateReady) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-brand-500 text-white text-sm font-medium px-4 py-3 flex items-center justify-between shadow-lg">
      <span>📦 新版本就绪</span>
      <button
        onClick={handleUpdate}
        className="ml-3 bg-white dark:bg-ink-100 text-brand-600 dark:text-brand-400 px-3 py-1 rounded-lg text-xs font-bold active:opacity-80"
      >
        刷新
      </button>
    </div>
  );
}
