import { describe, expect, it, vi } from "vitest";
import {
  discoverOnce,
  parseRedactedDiscoverySummary,
  runDiscoveryCycle,
} from "../src/workers/musicChannelDiscoveryWorker.js";
import type { MusicChannelDiscoverySchedule } from "../src/workers/musicChannelDiscoverySchedule.js";

const schedule: MusicChannelDiscoverySchedule = {
  offPeakIntervalMinutes: 60,
  peakIntervalMinutes: 5,
  peakStartHour: 12,
  peakEndHour: 24,
  timeZone: "Asia/Seoul",
};

describe("music channel discovery worker", () => {
  it("logs only allow-listed discovery counters from the scheduler response", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
    vi.stubEnv("INTERNAL_API_TOKEN", "worker-secret-token");
    vi.stubEnv("MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED", "true");
    vi.stubEnv("MUSIC_CHANNEL_DISCOVERY_SCHEDULER_BASE_URL", "http://scheduler.test");
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      status: "ok",
      uniqueVideos: 3,
      inserted: 2,
      failed: 1,
      apiKey: "must-not-be-logged",
      rawResponse: { authorization: "worker-secret-token" },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const logInfo = vi.fn();

    const summary = await discoverOnce(fetchImpl as typeof fetch, logInfo);

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(logInfo).toHaveBeenCalledWith("music channel discovery completed", {
      status: "ok",
      uniqueVideos: 3,
      inserted: 2,
      failed: 1,
    });
    expect(JSON.stringify(summary)).not.toContain("must-not-be-logged");
    expect(JSON.stringify(summary)).not.toContain("worker-secret-token");
    vi.unstubAllEnvs();
  });

  it("rejects response shapes that cannot produce a safe summary", () => {
    expect(parseRedactedDiscoverySummary(null)).toBeNull();
    expect(parseRedactedDiscoverySummary(["secret"])).toBeNull();
  });

  it("recalculates the delay after each successful attempt", async () => {
    const discover = vi.fn().mockResolvedValue(undefined);
    const firstDelay = await runDiscoveryCycle({
      discover,
      now: () => new Date("2026-07-05T02:30:00.000Z"),
      schedule,
    });
    const secondDelay = await runDiscoveryCycle({
      discover,
      now: () => new Date("2026-07-05T03:00:00.000Z"),
      schedule,
    });

    expect(discover).toHaveBeenCalledTimes(2);
    expect(firstDelay).toBe(30 * 60_000);
    expect(secondDelay).toBe(5 * 60_000);
  });

  it("logs a failed attempt and still calculates the current schedule delay", async () => {
    const failure = new Error("api unavailable");
    const logError = vi.fn();
    const delay = await runDiscoveryCycle({
      discover: vi.fn().mockRejectedValue(failure),
      now: () => new Date("2026-07-05T14:58:00.000Z"),
      schedule,
      logError,
    });

    expect(logError).toHaveBeenCalledWith("music channel discovery failed", failure);
    expect(delay).toBe(2 * 60_000);
  });
});
