import { describe, it, expect } from "vitest";
import { checkRateLimit, getRateLimitRemaining } from "@/lib/rateLimit";

describe("checkRateLimit", () => {
  const KEY = "test:user-123";

  it("allows first request", () => {
    expect(checkRateLimit(KEY, 5, 1_000)).toBe(true);
  });

  it("allows requests up to the max", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(`${KEY}-a`, 5, 1_000)).toBe(true);
    }
  });

  it("blocks requests exceeding the max", () => {
    const k = `${KEY}-b`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(k, 5, 1_000)).toBe(true);
    }
    expect(checkRateLimit(k, 5, 1_000)).toBe(false);
  });

  it("allows requests after window expires", async () => {
    const k = `${KEY}-c`;
    // Use 100ms window so it expires quickly
    expect(checkRateLimit(k, 2, 100)).toBe(true);
    expect(checkRateLimit(k, 2, 100)).toBe(true);
    expect(checkRateLimit(k, 2, 100)).toBe(false);

    // Wait for window to pass
    await new Promise((r) => setTimeout(r, 150));
    expect(checkRateLimit(k, 2, 100)).toBe(true);
  });

  it("isolates different keys", () => {
    const k1 = `${KEY}-d1`;
    const k2 = `${KEY}-d2`;

    // Exhaust k1
    expect(checkRateLimit(k1, 2, 1_000)).toBe(true);
    expect(checkRateLimit(k1, 2, 1_000)).toBe(true);
    expect(checkRateLimit(k1, 2, 1_000)).toBe(false);

    // k2 should still work
    expect(checkRateLimit(k2, 2, 1_000)).toBe(true);
  });

  it("uses 60s default window", () => {
    expect(checkRateLimit(`${KEY}-e`, 5)).toBe(true);
  });
});

describe("getRateLimitRemaining", () => {
  it("returns max when no requests made", () => {
    const key = "test:remaining-new";
    expect(getRateLimitRemaining(key, 10, 60_000)).toBe(10);
  });

  it("returns correct remaining after requests", () => {
    const key = "test:remaining-used";
    expect(checkRateLimit(key, 5, 10_000)).toBe(true);
    expect(checkRateLimit(key, 5, 10_000)).toBe(true);
    expect(checkRateLimit(key, 5, 10_000)).toBe(true);
    expect(getRateLimitRemaining(key, 5, 10_000)).toBe(2);
  });

  it("returns 0 when exhausted", () => {
    const key = "test:remaining-exhausted";
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, 3, 10_000);
    }
    expect(getRateLimitRemaining(key, 3, 10_000)).toBe(0);
  });
});
