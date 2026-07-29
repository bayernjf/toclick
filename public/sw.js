// Service Worker for 反旗 PWA — offline support
const CACHE_VERSION = "v2";
const CACHE_SHELL = `flagbreaker-shell-${CACHE_VERSION}`;
const CACHE_ASSETS = `flagbreaker-assets-${CACHE_VERSION}`;
const CACHE_IMAGES = `flagbreaker-images-${CACHE_VERSION}`;

// App shell pages to precache (for offline navigation)
const SHELL_URLS = ["/", "/dashboard", "/goals/new", "/report", "/settings", "/login"];

// ── Install: precache shell pages ──────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_SHELL)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("[sw] install precache error:", err.message))
  );
});

// ── Activate: purge old caches ─────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                k.startsWith("flagbreaker-") &&
                k !== CACHE_SHELL &&
                k !== CACHE_ASSETS &&
                k !== CACHE_IMAGES
            )
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: strategies by request type ──────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET (POST/PATCH/DELETE) — let them fail so app can queue offline
  if (request.method !== "GET") return;

  // Skip Supabase REST calls
  if (url.hostname.includes("supabase")) return;

  // Skip browser extensions / chrome-extension
  if (url.protocol === "chrome-extension:") return;

  // API routes: NetworkOnly (don't cache auth-gated responses)
  if (url.pathname.startsWith("/api/")) {
    return; // let the browser handle it, app will catch errors
  }

  // _next/static/ JS & CSS: CacheFirst (fingerprinted, immutable)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, CACHE_ASSETS));
    return;
  }

  // _next/image: stale-while-revalidate
  if (url.pathname.startsWith("/_next/image")) {
    event.respondWith(staleWhileRevalidate(request, CACHE_IMAGES));
    return;
  }

  // Public images / icons: CacheFirst
  if (/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, CACHE_IMAGES));
    return;
  }

  // Page navigations: NetworkFirst, fallback to cache
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // Other: NetworkFirst
  event.respondWith(networkFirst(request));
});

// ── Strategies ─────────────────────────────────────────

/** Cache falling back to network */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const netResp = await fetch(request);
    if (netResp.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, netResp.clone());
    }
    return netResp;
  } catch (_) {
    // offline, nothing we can do
    return new Response("", { status: 503 });
  }
}

/** Network first, fallback to cache */
async function networkFirst(request) {
  try {
    const netResp = await fetch(request);
    if (netResp.ok) {
      const cache = await caches.open(CACHE_SHELL);
      cache.put(request, netResp.clone());
    }
    return netResp;
  } catch (_) {
    const cached = await caches.match(request);
    return cached || new Response("", { status: 503 });
  }
}

/** NetworkFirst for HTML pages — fallback to /dashboard */
async function networkFirstPage(request) {
  try {
    const netResp = await fetch(request);
    if (netResp.ok) {
      const cache = await caches.open(CACHE_SHELL);
      cache.put(request, netResp.clone());
    }
    return netResp;
  } catch (_) {
    // Try exact match first
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback: serve /dashboard shell
    const fallback = await caches.match("/dashboard");
    if (fallback) return fallback;
    // Ultimate fallback
    return new Response(
      `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>离线中…</title><style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui;background:#fff7ed;color:#431407}.box{text-align:center;padding:2rem}.emoji{font-size:4rem}.hint{color:#9a3412;margin-top:.75rem}</style></head><body><div class="box"><div class="emoji">📡</div><p class="hint">网络断开了，下拉刷新试试</p></div></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

/** Stale-while-revalidate: serve cache, update in background */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((netResp) => {
      if (netResp.ok) cache.put(request, netResp.clone());
    })
    .catch(() => {});
  return cached || fetchPromise.then(() => caches.match(request));
}

// ── Message handlers ───────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Push notification handlers ─────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const { title, body, icon, badge, url } = payload;

    const options = {
      body: body || "",
      icon: icon || "/icon-192.png",
      badge: badge || "/icon-192.png",
      tag: url || "flagbreaker-push",
      data: { url: url || "/dashboard" },
      vibrate: [200, 100, 200],
      actions: [
        { action: "open", title: "去看看" },
      ],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.warn("[sw] push payload parse error:", e.message);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing tab if any
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        // Open new tab
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});
