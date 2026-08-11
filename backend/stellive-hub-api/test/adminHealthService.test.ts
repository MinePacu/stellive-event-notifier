import { describe, expect, it, vi } from "vitest";
import { AdminHealthService } from "../src/admin/adminHealthService.js";
import { loadEnv } from "../src/config/env.js";

function dependencies() {
  return {
    jobs: { summarize: vi.fn(async () => ({
      queued: 1,
      locked: 0,
      completed: 2,
      failed: 0,
      missingJobCount: 3,
      oldestMissingJobReceivedAt: "2026-07-03T00:00:00.000Z"
    })) },
    deliveryAttempts: {
      summarizeRecent: vi.fn(async () => ({ sent: 2, queued: 0, skipped: 0, failed: 0 })),
      summarizeDailyBuckets: vi.fn(async () => ({
        timezone: "Asia/Seoul" as const,
        days: 14,
        generatedAt: "2026-07-04T00:00:00.000Z",
        items: [],
        totals: { sent: 2, queued: 0, skipped: 0, failed: 0, total: 2 }
      }))
    },
    externalApiCalls: { summarizeDaily: vi.fn(async () => ({
      timezone: "Asia/Seoul" as const,
      days: 14,
      generatedAt: "2026-07-04T00:00:00.000Z",
      items: [],
      totals: { total: 0, ok: 0, failed: 0, rateLimited: 0, quotaExceeded: 0, quotaUnits: 0, bySource: {} }
    })) },
    platformApiState: { listAdapterHealth: vi.fn(async () => []) },
    prisma: { $queryRaw: vi.fn(async () => [{ ok: 1 }]) }
  };
}

function service(ttlSeconds: number, now: () => number) {
  const deps = dependencies();
  const env = loadEnv({
    DATABASE_URL: "postgresql://test",
    ADMIN_OVERVIEW_CACHE_TTL_SECONDS: String(ttlSeconds)
  });
  const health = new AdminHealthService(
    env,
    deps.jobs as never,
    deps.deliveryAttempts as never,
    deps.externalApiCalls as never,
    deps.platformApiState as never,
    deps.prisma,
    now
  );
  return { health, deps };
}

describe("AdminHealthService overview cache", () => {
  it("shares in-flight work, returns copies, and rebases uptime", async () => {
    let nowMs = 1_000;
    const { health, deps } = service(15, () => nowMs);

    const [first, concurrent] = await Promise.all([health.overview(), health.overview()]);
    expect(deps.externalApiCalls.summarizeDaily).toHaveBeenCalledTimes(1);
    expect(first).not.toBe(concurrent);
    expect(first.queue).toMatchObject({
      missingJobCount: 3,
      oldestMissingJobReceivedAt: "2026-07-03T00:00:00.000Z"
    });

    first.queue.queued = 99;
    nowMs += 5_000;
    const cached = await health.overview();
    expect(cached.queue.queued).toBe(1);
    expect(cached.service.uptimeSeconds).toBe(concurrent.service.uptimeSeconds + 5);

    nowMs += 11_000;
    await health.overview();
    expect(deps.externalApiCalls.summarizeDaily).toHaveBeenCalledTimes(2);
  });

  it("disables sequential cache reuse when TTL is zero", async () => {
    const { health, deps } = service(0, () => 1_000);
    await health.overview();
    await health.overview();
    expect(deps.externalApiCalls.summarizeDaily).toHaveBeenCalledTimes(2);
  });
});
