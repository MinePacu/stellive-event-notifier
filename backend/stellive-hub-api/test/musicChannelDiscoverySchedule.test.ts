import { describe, expect, it } from "vitest";
import {
  isMusicDiscoveryPeakTime,
  msUntilNextMusicDiscovery,
  type MusicChannelDiscoverySchedule,
} from "../src/workers/musicChannelDiscoverySchedule.js";

const schedule: MusicChannelDiscoverySchedule = {
  offPeakIntervalMinutes: 60,
  peakIntervalMinutes: 5,
  peakStartHour: 12,
  peakEndHour: 24,
  timeZone: "Asia/Seoul",
};

describe("music channel discovery schedule", () => {
  it.each([
    ["2026-07-05T02:30:00.000Z", false, 30 * 60_000],
    ["2026-07-05T02:59:00.000Z", false, 1 * 60_000],
    ["2026-07-05T03:00:00.000Z", true, 5 * 60_000],
    ["2026-07-05T14:58:00.000Z", true, 2 * 60_000],
    ["2026-07-05T15:00:00.000Z", false, 60 * 60_000],
  ])("classifies %s and returns the boundary-aware delay", (iso, peak, delayMs) => {
    const now = new Date(iso);
    expect(isMusicDiscoveryPeakTime(now, schedule)).toBe(peak);
    expect(msUntilNextMusicDiscovery(now, schedule)).toBe(delayMs);
  });

  it("uses the configured IANA time zone instead of the process time zone", () => {
    const instant = new Date("2026-07-05T09:00:00.000Z");
    expect(isMusicDiscoveryPeakTime(instant, schedule)).toBe(true);
    expect(isMusicDiscoveryPeakTime(instant, {
      ...schedule,
      timeZone: "America/Los_Angeles",
    })).toBe(false);
  });

  it("preserves millisecond precision when capping at a boundary", () => {
    const now = new Date("2026-07-05T02:59:59.999Z");
    expect(msUntilNextMusicDiscovery(now, schedule)).toBe(1);
  });
});
