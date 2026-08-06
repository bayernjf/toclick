import webpush from "web-push";

let webpushConfigured = false;

/** One-time setup of web-push VAPID credentials */
function ensureConfigured() {
  if (webpushConfigured) return;

  const email = process.env.VAPID_EMAIL ?? "mailto:admin@flagbreaker.app";
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (publicKey && privateKey) {
    webpush.setVapidDetails(email, publicKey, privateKey);
    webpushConfigured = true;
  }
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

/** Send push notification to a single subscription. Returns true on success. */
export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<boolean> {
  ensureConfigured();
  if (!webpushConfigured) return false;

  const pushSub: webpush.PushSubscription = {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };

  try {
    await webpush.sendNotification(pushSub, JSON.stringify(payload));
    return true;
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    // 404/410 means subscription is gone — should be cleaned up
    if (statusCode === 404 || statusCode === 410) {
      return false; // caller should remove this subscription
    }
    console.warn("[push] sendNotification error:", (err as Error).message);
    return true; // other errors: keep subscription
  }
}

/** Send push notification to multiple subscriptions. Returns removed (gone) endpoints. */
export async function broadcastPush(
  subs: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload,
): Promise<string[]> {
  const removedIds: string[] = [];

  for (const sub of subs) {
    const ok = await sendPushNotification(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      payload,
    );
    if (!ok) removedIds.push(sub.id);
  }

  return removedIds;
}
