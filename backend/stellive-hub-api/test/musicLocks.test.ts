import { describe, expect, it, vi } from "vitest";
import { RedisMusicSyncLock } from "../src/music/musicLocks.js";

describe("RedisMusicSyncLock", () => {
  it("acquires with NX/PX and releases only its owner token", async () => {
    const client = {
      set: vi.fn().mockResolvedValue("OK"),
      eval: vi.fn().mockResolvedValue(1),
      quit: vi.fn().mockResolvedValue("OK")
    };
    const lock = new RedisMusicSyncLock(client, {
      keyPrefix: "test-lock",
      createToken: () => "owner-token"
    });

    const release = await lock.acquire("music-source:source-1", 30_000);
    await release?.();
    await release?.();

    expect(client.set).toHaveBeenCalledWith(
      "test-lock:music-source:source-1",
      "owner-token",
      "PX",
      30_000,
      "NX"
    );
    expect(client.eval).toHaveBeenCalledTimes(1);
    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('get', KEYS[1])"),
      1,
      "test-lock:music-source:source-1",
      "owner-token"
    );
  });

  it("returns no release callback when another worker owns the lock", async () => {
    const client = {
      set: vi.fn().mockResolvedValue(null),
      eval: vi.fn(),
      quit: vi.fn().mockResolvedValue("OK")
    };
    const lock = new RedisMusicSyncLock(client, { createToken: () => "contender" });

    await expect(lock.acquire("music-channel-discovery", 10_000)).resolves.toBeNull();

    expect(client.eval).not.toHaveBeenCalled();
  });

  it("closes its Redis connection", async () => {
    const client = {
      set: vi.fn(),
      eval: vi.fn(),
      quit: vi.fn().mockResolvedValue("OK")
    };
    const lock = new RedisMusicSyncLock(client);

    await lock.close();

    expect(client.quit).toHaveBeenCalledTimes(1);
  });
});
