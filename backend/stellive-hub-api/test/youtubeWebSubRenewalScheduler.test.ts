import { describe, expect, it, vi } from "vitest";
import {
  YoutubeWebSubRenewalScheduler,
  decideYoutubeWebSubRenewal,
  shouldStartYoutubeWebSubRenewal,
  type RenewalLeaseRow,
} from "../src/jobs/youtubeWebSubRenewalScheduler.js";

const HOUR = 3_600_000;
const now = new Date("2026-07-10T12:00:00.000Z");
const targets = [
  { targetId: "a", channelId: "UCa", topicUrl: "topic-a" },
  { targetId: "b", channelId: "UCb", topicUrl: "topic-b" },
];
const ago = (hours: number) => new Date(now.getTime() - hours * HOUR);
const ahead = (hours: number) => new Date(now.getTime() + hours * HOUR);
const row = (targetId: string, overrides: Partial<RenewalLeaseRow> = {}): RenewalLeaseRow => ({
  targetId,
  topicUrl: `topic-${targetId}`,
  status: "active",
  leaseExpiresAt: ahead(100),
  updatedAt: ago(20),
  ...overrides,
});
const decide = (rows: RenewalLeaseRow[]) =>
  decideYoutubeWebSubRenewal({ targets, rows, now, renewBeforeMs: 48 * HOUR });

describe("decideYoutubeWebSubRenewal", () => {
  it("is not due when every target is active with a lease beyond the window", () => {
    expect(decide([row("a"), row("b")])).toEqual({ due: false, reason: "healthy" });
  });

  it("is due when a target has no row, even inside the cooldown", () => {
    expect(decide([row("a", { updatedAt: ago(0.1) })])).toEqual({ due: true, reason: "missing_row" });
  });

  it("is due when a lease expires within 48h or is missing", () => {
    expect(decide([row("a"), row("b", { leaseExpiresAt: ahead(47) })])).toEqual({ due: true, reason: "needs_renewal" });
    expect(decide([row("a"), row("b", { leaseExpiresAt: null })])).toEqual({ due: true, reason: "needs_renewal" });
  });

  it("is due for a non-active row older than the cooldown", () => {
    expect(decide([row("a"), row("b", { status: "pending_verification", updatedAt: ago(7) })])).toEqual({
      due: true,
      reason: "needs_renewal",
    });
  });

  it("holds off while the last attempt on a needy row is within 6h", () => {
    expect(decide([row("a"), row("b", { status: "pending_verification", updatedAt: ago(5) })])).toEqual({
      due: false,
      reason: "cooldown",
    });
  });
});

describe("shouldStartYoutubeWebSubRenewal", () => {
  const env = { HUB_EVENTS_STORAGE_MODE: "prisma", YOUTUBE_WEBSUB_AUTO_RENEW_ENABLED: true, NODE_ENV: "production" };
  it("only starts in prisma mode, enabled, non-test, without injected dependencies", () => {
    expect(shouldStartYoutubeWebSubRenewal(env)).toBe(true);
    expect(shouldStartYoutubeWebSubRenewal({ ...env, HUB_EVENTS_STORAGE_MODE: "memory" })).toBe(false);
    expect(shouldStartYoutubeWebSubRenewal({ ...env, YOUTUBE_WEBSUB_AUTO_RENEW_ENABLED: false })).toBe(false);
    expect(shouldStartYoutubeWebSubRenewal({ ...env, NODE_ENV: "test" })).toBe(false);
    expect(shouldStartYoutubeWebSubRenewal(env, { dependenciesInjected: true })).toBe(false);
  });
});

describe("YoutubeWebSubRenewalScheduler", () => {
  function harness(rows: RenewalLeaseRow[], acquired = true) {
    const timers: Array<{ callback: () => void; delayMs: number; cleared: boolean }> = [];
    const renewSubscriptions = vi.fn(async () => ({ status: "ok", renewed: 2, failed: 0, skipped: 0 }));
    const logger = { info: vi.fn(), error: vi.fn() };
    const scheduler = new YoutubeWebSubRenewalScheduler({
      targets,
      subscriptions: { listLeases: vi.fn(async () => rows) },
      renewer: { renewSubscriptions },
      withLock: async (task) => (acquired ? { acquired: true, value: await task() } : { acquired: false }),
      intervalMs: HOUR,
      renewBeforeMs: 48 * HOUR,
      initialDelayMs: 60_000,
      now: () => now,
      setTimer: (callback, delayMs) => {
        const timer = { callback, delayMs, cleared: false };
        timers.push(timer);
        return timer;
      },
      clearTimer: (handle) => {
        (handle as { cleared: boolean }).cleared = true;
      },
      logger,
    });
    return { scheduler, timers, renewSubscriptions, logger };
  }

  it("renews when due and logs counts only", async () => {
    const { scheduler, renewSubscriptions, logger } = harness([row("a")]);
    await expect(scheduler.runOnce()).resolves.toEqual({ acquired: true, renewed: true, reason: "missing_row" });
    expect(renewSubscriptions).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      { reason: "missing_row", renewed: 2, failed: 0, skipped: 0 },
      "youtube websub auto renewal completed"
    );
  });

  it("does not renew when healthy or when another replica holds the lock", async () => {
    const healthy = harness([row("a"), row("b")]);
    await expect(healthy.scheduler.runOnce()).resolves.toEqual({ acquired: true, renewed: false, reason: "healthy" });
    expect(healthy.renewSubscriptions).not.toHaveBeenCalled();

    const locked = harness([], false);
    await expect(locked.scheduler.runOnce()).resolves.toEqual({ acquired: false, renewed: false });
    expect(locked.renewSubscriptions).not.toHaveBeenCalled();
  });

  it("logs and swallows renewal failures", async () => {
    const { scheduler, renewSubscriptions, logger } = harness([]);
    renewSubscriptions.mockRejectedValueOnce(new Error("boom"));
    await expect(scheduler.runOnce()).resolves.toMatchObject({ renewed: false });
    expect(logger.error).toHaveBeenCalledWith({ error: "boom" }, "youtube websub auto renewal failed");
  });

  it("schedules the first tick after the initial delay, re-arms at the interval, and stops cleanly", async () => {
    const { scheduler, timers, renewSubscriptions } = harness([row("a"), row("b")]);
    scheduler.start();
    scheduler.start();
    expect(timers).toHaveLength(1);
    expect(timers[0]?.delayMs).toBe(60_000);

    timers[0]?.callback();
    await vi.waitFor(() => expect(timers).toHaveLength(2));
    expect(timers[1]?.delayMs).toBe(HOUR);
    expect(renewSubscriptions).not.toHaveBeenCalled();

    await scheduler.stop();
    expect(timers[1]?.cleared).toBe(true);
  });
});
