import { describe, expect, it, vi } from "vitest";
import { runDiscoveryCycle } from "../src/workers/musicChannelDiscoveryWorker.js";
import type { MusicChannelDiscoverySchedule } from "../src/workers/musicChannelDiscoverySchedule.js";

const schedule: MusicChannelDiscoverySchedule = {
  offPeakIntervalMinutes: 60,
  peakIntervalMinutes: 5,
  peakStartHour: 12,
  peakEndHour: 24,
  timeZone: "Asia/Seoul",
};

describe("music channel discovery worker", () => {
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
