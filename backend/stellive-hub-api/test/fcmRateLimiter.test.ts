import { describe, expect, it } from "vitest";
import { FcmRateLimiter } from "../src/push/fcmRateLimiter.js";

describe("FcmRateLimiter", () => {
  it("enforces burst and deterministic second refill", () => {
    let now = 0;
    const limiter = new FcmRateLimiter({
      enabled: true,
      maxPerSecond: 2,
      maxPerMinute: 120,
      burst: 2,
      now: () => now
    });

    expect(limiter.tryAcquire(2)).toEqual({ allowed: true });
    expect(limiter.tryAcquire()).toMatchObject({ allowed: false, retryAfterMs: 500 });
    now = 500;
    expect(limiter.tryAcquire()).toEqual({ allowed: true });
  });

  it("enforces the minute refill rate", () => {
    let now = 0;
    const limiter = new FcmRateLimiter({
      enabled: true,
      maxPerSecond: 100,
      maxPerMinute: 2,
      burst: 2,
      now: () => now
    });

    expect(limiter.tryAcquire(2)).toEqual({ allowed: true });
    expect(limiter.tryAcquire()).toMatchObject({ allowed: false, retryAfterMs: 30_000 });
    now = 30_000;
    expect(limiter.tryAcquire()).toEqual({ allowed: true });
  });

  it("allows sends when disabled", () => {
    const limiter = new FcmRateLimiter({
      enabled: false,
      maxPerSecond: 1,
      maxPerMinute: 1,
      burst: 1
    });

    expect(limiter.tryAcquire(10_000)).toEqual({ allowed: true });
  });
});
