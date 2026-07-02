import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { loadEnv } from "../src/config/env.js";
import { registerInternalRoutes } from "../src/routes/internalRoutes.js";

const baseEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub_test",
  INTERNAL_API_TOKEN: "internal-test-token",
};

function createDependencies() {
  return {
    adminHealthService: {
      overview: async () => ({
        service: { name: "stellive-hub-api" as const, environment: "test", uptimeSeconds: 1 },
        database: { status: "ok" as const, reason: "ready" },
        featureFlags: {},
        secrets: {},
        queue: { queued: 0, locked: 0, completed: 0, failed: 0 },
        adapters: [],
        recentDelivery: { sent: 0, queued: 0, skipped: 0, failed: 0 },
        dailyDeliveryQueue: {
          timezone: "Asia/Seoul" as const,
          days: 14,
          generatedAt: "2026-07-02T00:00:00.000Z",
          items: [],
          totals: { sent: 0, queued: 0, skipped: 0, failed: 0, total: 0 },
        },
      }),
    },
    notificationJobs: { listDiagnostics: async () => [] },
    webhookSubscriptions: { listDiagnostics: async () => [] },
    liveStatus: { listDiagnostics: async () => [] },
    deliveryAttempts: { listRecent: async () => [] },
    adapterHealth: {
      getState: async () => null,
      listAdapterHealth: async () => [],
    },
    specialDayYearMaterializer: {
      materializeYear: async () => ({
        targetYear: 2026,
        timezone: "Asia/Seoul" as const,
        created: 0,
        updated: 0,
        skipped: 0,
        dryRun: false,
      }),
    },
    hubEventStatuses: {
      reconcileDueStatuses: async () => ({
        status: "ok" as const,
        checkedAt: "2026-06-22T00:00:00.000Z",
        checked: 0,
        updated: 0,
        opened: 0,
        ended: 0,
        verifyRequired: 0,
        startOnlyEnded: 0,
        nextRunAt: null,
      }),
    },
  };
}

describe("registerInternalRoutes YouTube song backfill scheduler", () => {
  it("delegates backfill requests when Data API fallback is enabled", async () => {
    const app = Fastify();
    const backfill = vi.fn(async () => ({
      status: "ok" as const,
      checkedChannels: 1,
      skippedChannels: 0,
      pagesFetched: 1,
      quotaUnits: 2,
      ingested: 1,
      skipped: 0,
      notModified: 0,
      failed: 0,
    }));

    await registerInternalRoutes(app, {
      env: loadEnv({ ...baseEnv, YOUTUBE_DATA_API_FALLBACK_ENABLED: true }),
      dependencies: {
        ...createDependencies(),
        youtubeSongBackfillScheduler: { backfill, reconcile: vi.fn() },
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/youtube/song-backfill",
      headers: { authorization: "Bearer internal-test-token" },
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      checkedChannels: 1,
      skippedChannels: 0,
      pagesFetched: 1,
      quotaUnits: 2,
      ingested: 1,
      skipped: 0,
      notModified: 0,
      failed: 0,
    });
    expect(backfill).toHaveBeenCalledTimes(1);
  });

  it("disables backfill when Data API fallback is off", async () => {
    const app = Fastify();
    const backfill = vi.fn();

    await registerInternalRoutes(app, {
      env: loadEnv({ ...baseEnv, YOUTUBE_DATA_API_FALLBACK_ENABLED: false }),
      dependencies: {
        ...createDependencies(),
        youtubeSongBackfillScheduler: { backfill, reconcile: vi.fn() },
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/youtube/song-backfill",
      headers: { authorization: "Bearer internal-test-token" },
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "disabled",
      reason: "youtube_data_api_fallback_disabled",
    });
    expect(backfill).not.toHaveBeenCalled();
  });
});
