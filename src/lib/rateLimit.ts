/**
 * Simple in-memory rate limiter with sliding window.
 *
 * Limits are per-user-id to prevent token-wasting abuse on paid AI API calls.
 * In production with multiple instances, replace with Vercel KV / Upstash.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 60_000);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

/**
 * Check if a request should be rate limited.
 *
 * @param key - Unique identifier (e.g. `user:<userId>` or `ip:<ip>`)
 * @param maxRequests - Max allowed requests in the window
 * @param windowMs - Time window in milliseconds (default 60s)
 * @returns true if the request is allowed, false if rate limited
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number = 60_000
): boolean {
  cleanup();

  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    return false; // rate limited
  }

  entry.timestamps.push(now);
  return true; // allowed
}

/**
 * Get remaining requests in the current window (for response headers).
 */
export function getRateLimitRemaining(
  key: string,
  maxRequests: number,
  windowMs: number = 60_000
): number {
  const entry = store.get(key);
  if (!entry) return maxRequests;

  const now = Date.now();
  const active = entry.timestamps.filter((t) => now - t < windowMs).length;
  return Math.max(0, maxRequests - active);
}
