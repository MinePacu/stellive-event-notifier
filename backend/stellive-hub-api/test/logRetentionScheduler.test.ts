import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import {
  LogRetentionScheduler,
  createPrismaAdvisoryLockRunner,
  shouldStartLogRetention,
  type LogRetentionLockRunner
} from "../src/jobs/logRetentionScheduler.js";

const now = new Date("2026-07-31T01:00:00.000Z");

function createHarness(overrides: {
  withLock?: LogRetentionLockRunner;
  deliveryPrune?: (input: unknown) => Promise<{ deleted: number }>;
  externalPrune?: (input: unknown) => Promise<{ deleted: number }>;
} = {}) {
  const timers: Array<{ callback: () => void; delayMs: number; cleared: boolean }> = [];
  const deliveryPrune = vi.fn(overrides.deliveryPrune ?? (async () => ({ deleted: 11 })));
  const externalPrune = vi.fn(overrides.externalPrune ?? (async () => ({ deleted: 4 })));
  const withLock: LogRetentionLockRunner = overrides.withLock ?? (async (task) => ({ acquired: true, value: await task() }));
  const logger = { info: vi.fn(), error: vi.fn() };
  const scheduler = new LogRetentionScheduler({
    deliveryAttempts: { pruneOlderThan: deliveryPrune },
    externalApiCallLogs: { pruneOlderThan: externalPrune },
    withLock,
    deliveryAttemptRetentionDays: 30,
    externalApiLogRetentionDays: 31,
    intervalMs: 3_600_000,
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
    logger
  });
  return { scheduler, timers, deliveryPrune, externalPrune, logger };
}

describe("LogRetentionScheduler", () => {
  it("prunes both tables when the lock is acquired and logs one count-only line", async () => {
    const { scheduler, deliveryPrune, externalPrune, logger } = createHarness();

    const result = await scheduler.runOnce();

    expect(result).toEqual({ acquired: true, deliveryAttemptsDeleted: 11, externalApiCallsDeleted: 4 });
    expect(deliveryPrune).toHaveBeenCalledWith(expect.objectContaining({ days: 30, now }));
    expect(externalPrune).toHaveBeenCalledWith({ days: 31, now });
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      { deliveryAttemptsDeleted: 11, externalApiCallsDeleted: 4 },
      "log retention prune completed"
    );
  });

  it("skips pruning when another process holds the lock", async () => {
    const { scheduler, deliveryPrune, externalPrune, logger } = createHarness({
      withLock: async () => ({ acquired: false })
    });

    await expect(scheduler.runOnce()).resolves.toEqual({
      acquired: false,
      deliveryAttemptsDeleted: 0,
      externalApiCallsDeleted: 0
    });
    expect(deliveryPrune).not.toHaveBeenCalled();
    expect(externalPrune).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs a failing table, still prunes the other, and never throws", async () => {
    const { scheduler, externalPrune, logger } = createHarness({
      deliveryPrune: async () => {
        throw new Error("db_down");
      }
    });

    await expect(scheduler.runOnce()).resolves.toEqual({
      acquired: true,
      deliveryAttemptsDeleted: 0,
      externalApiCallsDeleted: 4
    });
    expect(externalPrune).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ table: "DeliveryAttempt" }),
      "log retention prune failed"
    );
  });

  it("logs and swallows lock acquisition errors", async () => {
    const { scheduler, deliveryPrune, logger } = createHarness({
      withLock: async () => {
        throw new Error("lock_failed");
      }
    });

    await expect(scheduler.runOnce()).resolves.toEqual({
      acquired: false,
      deliveryAttemptsDeleted: 0,
      externalApiCallsDeleted: 0
    });
    expect(deliveryPrune).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ table: "lock" }), "log retention prune failed");
  });

  it("schedules the first run shortly after start, then repeats on the interval", async () => {
    const { scheduler, timers, deliveryPrune } = createHarness();

    scheduler.start();
    expect(timers).toHaveLength(1);
    expect(timers[0]?.delayMs).toBe(60_000);

    timers[0]?.callback();
    await vi.waitFor(() => expect(deliveryPrune).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(timers).toHaveLength(2));
    expect(timers[1]?.delayMs).toBe(3_600_000);
  });

  it("does not start twice", () => {
    const { scheduler, timers } = createHarness();

    scheduler.start();
    scheduler.start();

    expect(timers).toHaveLength(1);
  });

  it("stops: clears the pending timer and does not reschedule", async () => {
    const { scheduler, timers, deliveryPrune } = createHarness();

    scheduler.start();
    await scheduler.stop();

    expect(timers[0]?.cleared).toBe(true);
    timers[0]?.callback();
    await Promise.resolve();
    expect(deliveryPrune).not.toHaveBeenCalled();
    expect(timers).toHaveLength(1);
  });

  it("waits for an in-flight run on stop and tells it to stop between batches", async () => {
    let release: (() => void) | undefined;
    let shouldContinue: (() => boolean) | undefined;
    const { scheduler, timers } = createHarness({
      deliveryPrune: async (input) => {
        shouldContinue = (input as { shouldContinue: () => boolean }).shouldContinue;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return { deleted: 1 };
      }
    });

    scheduler.start();
    timers[0]?.callback();
    await vi.waitFor(() => expect(shouldContinue).toBeDefined());
    expect(shouldContinue?.()).toBe(true);

    let stopped = false;
    const stopPromise = scheduler.stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(shouldContinue?.()).toBe(false);
    expect(stopped).toBe(false);

    release?.();
    await stopPromise;
    expect(stopped).toBe(true);
    expect(timers).toHaveLength(1);
  });
});

describe("createPrismaAdvisoryLockRunner", () => {
  function createPrisma(locked: boolean) {
    const queries: Array<{ sql: string; values: unknown[] }> = [];
    const tx = {
      $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        queries.push({ sql: strings.join("?"), values });
        return [{ locked }];
      })
    };
    const transaction = vi.fn(async (fn: (client: typeof tx) => Promise<unknown>, options?: unknown) => {
      void options;
      return fn(tx);
    });
    return { prisma: { $transaction: transaction }, queries, transaction };
  }

  it("runs the task inside a transaction holding pg_try_advisory_xact_lock", async () => {
    const { prisma, queries, transaction } = createPrisma(true);
    const runWithLock = createPrismaAdvisoryLockRunner(prisma as never);
    const task = vi.fn(async () => "done");

    await expect(runWithLock(task)).resolves.toEqual({ acquired: true, value: "done" });
    expect(task).toHaveBeenCalledTimes(1);
    expect(queries[0]?.sql).toContain("pg_try_advisory_xact_lock");
    expect(typeof queries[0]?.values[0]).toBe("bigint");
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ timeout: expect.any(Number) }));
  });

  it("does not run the task when the lock is held elsewhere", async () => {
    const { prisma } = createPrisma(false);
    const runWithLock = createPrismaAdvisoryLockRunner(prisma as never);
    const task = vi.fn(async () => "done");

    await expect(runWithLock(task)).resolves.toEqual({ acquired: false });
    expect(task).not.toHaveBeenCalled();
  });
});

describe("shouldStartLogRetention", () => {
  const base = { HUB_EVENTS_STORAGE_MODE: "prisma", LOG_RETENTION_ENABLED: true, NODE_ENV: "production" } as const;

  it("starts only in prisma mode, enabled, outside tests, without injected dependencies", () => {
    expect(shouldStartLogRetention(base)).toBe(true);
    expect(shouldStartLogRetention({ ...base, HUB_EVENTS_STORAGE_MODE: "memory" })).toBe(false);
    expect(shouldStartLogRetention({ ...base, LOG_RETENTION_ENABLED: false })).toBe(false);
    expect(shouldStartLogRetention({ ...base, NODE_ENV: "test" })).toBe(false);
    expect(shouldStartLogRetention(base, { dependenciesInjected: true })).toBe(false);
  });

  it("does not create timers when the app is built in test mode", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const app = await buildApp({
      env: {
        DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
        NODE_ENV: "test",
        HUB_EVENTS_STORAGE_MODE: "prisma"
      },
      useProcessEnv: false
    });
    await app.ready();
    await app.close();
    expect(setTimeoutSpy.mock.calls.some(([, delay]) => delay === 60_000)).toBe(false);
    setTimeoutSpy.mockRestore();
  });
});
