"use client";

import { useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { VAPID_PUBLIC_KEY } from "@/lib/constants";

type PushState = {
  supported: boolean;
  subscription: PushSubscription | null;
  permission: NotificationPermission;
  subscribing: boolean;
};

/**
 * Convert base64url to Uint8Array for pushManager.subscribe
 */
function urlB64ToUint8(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function usePush() {
  const [state, setState] = useState<PushState>({
    supported: false,
    subscription: null,
    permission: "default",
    subscribing: false,
  });

  const supabase = createSupabaseClient();

  useEffect(() => {
    // Check support and permission on mount
    const supported = "serviceWorker" in navigator && "PushManager" in window;
    if (!supported) return;

    setState((s) => ({
      ...s,
      supported: true,
      permission: Notification.permission || "default",
    }));

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setState((s) => ({ ...s, subscription: sub }));
      });
    });
  }, []);

  /** Request notification permission and subscribe */
  async function subscribe() {
    if (state.subscribing) return;

    setState((s) => ({ ...s, subscribing: true }));

    try {
      // Request permission
      const result = await Notification.requestPermission();
      setState((s) => ({ ...s, permission: result }));

      if (result !== "granted") return;

      // Subscribe push
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY
          ? (urlB64ToUint8(VAPID_PUBLIC_KEY) as BufferSource)
          : undefined,
      });

      setState((s) => ({ ...s, subscription: sub }));

      // Save to backend
      const subJson = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subJson),
      });
    } catch (e) {
      console.warn("[usePush] subscribe error:", e);
    } finally {
      setState((s) => ({ ...s, subscribing: false }));
    }
  }

  /** Unsubscribe from push notifications */
  async function unsubscribe() {
    if (state.subscribing) return;

    setState((s) => ({ ...s, subscribing: true }));

    try {
      const sub = state.subscription;
      if (sub) {
        await sub.unsubscribe();

        // Remove from backend
        const subJson = sub.toJSON() as { endpoint: string };
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subJson.endpoint }),
        });

        setState((s) => ({ ...s, subscription: null }));
      }
    } catch (e) {
      console.warn("[usePush] unsubscribe error:", e);
    } finally {
      setState((s) => ({ ...s, subscribing: false }));
    }
  }

  return {
    supported: state.supported,
    subscription: state.subscription,
    permission: state.permission,
    subscribing: state.subscribing,
    subscribe,
    unsubscribe,
    isSubscribed: !!state.subscription,
  };
}
