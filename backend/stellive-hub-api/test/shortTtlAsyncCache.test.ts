import { describe, expect, it, vi } from "vitest";
import { ShortTtlAsyncCache } from "../src/utils/shortTtlAsyncCache.js";

describe("ShortTtlAsyncCache", () => {
  it("reuses a value until its TTL expires", async () => {
    let now = 1_000;
    const loader = vi.fn(async () => ({ version: loader.mock.calls.length }));
    const cache = new ShortTtlAsyncCache({ ttlMs: 100, now: () => now });

    const first = await cache.getOrLoad(loader);
    now = 1_099;
    const cached = await cache.getOrLoad(loader);
    now = 1_100;
    const refreshed = await cache.getOrLoad(loader);

    expect(first).toEqual({ version: 1 });
    expect(cached).toBe(first);
    expect(refreshed).toEqual({ version: 2 });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent cache misses", async () => {
    let resolve!: (value: string) => void;
    const loader = vi.fn(
      () => new Promise<string>((complete) => {
        resolve = complete;
      }),
    );
    const cache = new ShortTtlAsyncCache({ ttlMs: 100, now: () => 0 });

    const first = cache.getOrLoad(loader);
    const second = cache.getOrLoad(loader);
    await Promise.resolve();
    resolve("shared");

    await expect(Promise.all([first, second])).resolves.toEqual(["shared", "shared"]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("retries after a loader failure", async () => {
    const loader = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce("recovered");
    const cache = new ShortTtlAsyncCache({ ttlMs: 100, now: () => 0 });

    await expect(cache.getOrLoad(loader)).rejects.toThrow("temporary");
    await expect(cache.getOrLoad(loader)).resolves.toBe("recovered");
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
