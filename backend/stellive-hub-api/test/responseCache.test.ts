import { describe, expect, it, vi } from "vitest";

import { ResponseCache } from "../src/cache/responseCache.js";

describe("ResponseCache", () => {
  it("returns a fresh cached value without loading again", async () => {
    let nowMs = 0;
    const cache = new ResponseCache({ now: () => nowMs });
    const loadFresh = vi.fn(async () => "fresh");

    await expect(cache.getOrLoad("music", { ttlMs: 1_000, staleMs: 2_000 }, loadFresh)).resolves.toBe("fresh");
    nowMs = 500;
    await expect(cache.getOrLoad("music", { ttlMs: 1_000, staleMs: 2_000 }, loadFresh)).resolves.toBe("fresh");

    expect(loadFresh).toHaveBeenCalledTimes(1);
  });

  it("returns stale values while a single background refresh runs", async () => {
    let nowMs = 0;
    const cache = new ResponseCache({ now: () => nowMs });
    await cache.getOrLoad("music", { ttlMs: 100, staleMs: 1_000 }, async () => "old");
    nowMs = 200;
    const refresh = vi.fn(async () => "new");

    await expect(Promise.all([
      cache.getOrLoad("music", { ttlMs: 100, staleMs: 1_000 }, refresh),
      cache.getOrLoad("music", { ttlMs: 100, staleMs: 1_000 }, refresh),
    ])).resolves.toEqual(["old", "old"]);
    expect(refresh).toHaveBeenCalledTimes(1);

    await cache.waitForRefreshes();
    await expect(cache.getOrLoad("music", { ttlMs: 100, staleMs: 1_000 }, refresh)).resolves.toBe("new");
  });

  it("loads a missing key once for concurrent requests", async () => {
    const cache = new ResponseCache();
    const loadFresh = vi.fn(async () => ({ items: [1] }));

    const [first, second] = await Promise.all([
      cache.getOrLoad("music", { ttlMs: 1_000, staleMs: 1_000 }, loadFresh),
      cache.getOrLoad("music", { ttlMs: 1_000, staleMs: 1_000 }, loadFresh),
    ]);

    expect(first).toEqual({ items: [1] });
    expect(second).toEqual({ items: [1] });
    expect(loadFresh).toHaveBeenCalledTimes(1);
  });

  it("keeps serving stale value when refresh fails", async () => {
    let nowMs = 0;
    const cache = new ResponseCache({ now: () => nowMs });
    await cache.getOrLoad("music", { ttlMs: 100, staleMs: 1_000 }, async () => "old");
    nowMs = 200;

    await expect(cache.getOrLoad("music", { ttlMs: 100, staleMs: 1_000 }, async () => {
      throw new Error("db down");
    })).resolves.toBe("old");

    await cache.waitForRefreshes();
    await expect(cache.getOrLoad("music", { ttlMs: 100, staleMs: 1_000 }, async () => "new")).resolves.toBe("old");
  });
});
