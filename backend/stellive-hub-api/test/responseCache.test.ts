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

  it("evicts least recently accessed entries when maxEntries is exceeded", async () => {
    let nowMs = 0;
    const cache = new ResponseCache({ now: () => nowMs, maxEntries: 2 });
    const loaders = {
      a: vi.fn(async () => "a"),
      b: vi.fn(async () => "b"),
      c: vi.fn(async () => "c"),
    };
    const policy = { ttlMs: 1_000, staleMs: 1_000 };

    await cache.getOrLoad("a", policy, loaders.a);
    await cache.getOrLoad("b", policy, loaders.b);
    await cache.getOrLoad("a", policy, loaders.a);
    await cache.getOrLoad("c", policy, loaders.c);

    await cache.getOrLoad("a", policy, loaders.a);
    await cache.getOrLoad("c", policy, loaders.c);
    await cache.getOrLoad("b", policy, loaders.b);
    expect(loaders.a).toHaveBeenCalledTimes(1);
    expect(loaders.b).toHaveBeenCalledTimes(2);
    expect(loaders.c).toHaveBeenCalledTimes(1);
  });

  it("removes expired entries before evicting fresh entries", async () => {
    let nowMs = 0;
    const cache = new ResponseCache({ now: () => nowMs, maxEntries: 2 });
    const freshLoader = vi.fn(async () => "fresh");
    const expiredLoader = vi.fn(async () => "expired");

    await cache.getOrLoad("fresh", { ttlMs: 1_000, staleMs: 1_000 }, freshLoader);
    nowMs = 10;
    await cache.getOrLoad("expired", { ttlMs: 5, staleMs: 5 }, expiredLoader);
    nowMs = 30;
    await cache.getOrLoad("new", { ttlMs: 1_000, staleMs: 1_000 }, async () => "new");

    await cache.getOrLoad("fresh", { ttlMs: 1_000, staleMs: 1_000 }, freshLoader);
    await cache.getOrLoad("expired", { ttlMs: 5, staleMs: 5 }, expiredLoader);
    expect(freshLoader).toHaveBeenCalledTimes(1);
    expect(expiredLoader).toHaveBeenCalledTimes(2);
  });

  it("keeps concurrent load de-duplication when maxEntries is small", async () => {
    const cache = new ResponseCache({ maxEntries: 1 });
    const loader = vi.fn(async () => "loaded");

    await expect(Promise.all([
      cache.getOrLoad("same", { ttlMs: 1_000, staleMs: 1_000 }, loader),
      cache.getOrLoad("same", { ttlMs: 1_000, staleMs: 1_000 }, loader),
      cache.getOrLoad("same", { ttlMs: 1_000, staleMs: 1_000 }, loader),
    ])).resolves.toEqual(["loaded", "loaded", "loaded"]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("does not start duplicate refreshes after touch and eviction changes", async () => {
    let nowMs = 0;
    let finishRefresh: ((value: string) => void) | undefined;
    const cache = new ResponseCache({ now: () => nowMs, maxEntries: 1 });
    await cache.getOrLoad("music", { ttlMs: 100, staleMs: 1_000 }, async () => "old");
    nowMs = 200;
    const refresh = vi.fn(() => new Promise<string>((resolve) => {
      finishRefresh = resolve;
    }));

    await expect(Promise.all([
      cache.getOrLoad("music", { ttlMs: 100, staleMs: 1_000 }, refresh),
      cache.getOrLoad("music", { ttlMs: 100, staleMs: 1_000 }, refresh),
      cache.getOrLoad("music", { ttlMs: 100, staleMs: 1_000 }, refresh),
    ])).resolves.toEqual(["old", "old", "old"]);
    expect(refresh).toHaveBeenCalledTimes(1);

    finishRefresh?.("new");
    await cache.waitForRefreshes();
  });
});
