import { describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import type { InternalRouteDependencies } from "../src/routes/internalRoutes.js";

const env = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
  INTERNAL_API_TOKEN: "internal-test-token",
  CHZZK_LIVE_POLLING_ENABLED: "false",
};
const authHeaders = { authorization: "Bearer internal-test-token" };

function createInternalDeps(overrides: Partial<InternalRouteDependencies> = {}): InternalRouteDependencies {
  return {
    adminHealthService: {
      overview: async () => ({
        service: { name: "stellive-hub-api", environment: "test", uptimeSeconds: 1 },
        database: { status: "ok", reason: "fake_database_ready" },
        featureFlags: {},
        secrets: {},
        queue: { queued: 0, locked: 0, completed: 0, failed: 0 },
        adapters: [],
        recentDelivery: { sent: 0, queued: 0, skipped: 0, failed: 0 },
      }),
    },
    notificationJobs: { listDiagnostics: async () => [] },
    webhookSubscriptions: { listDiagnostics: async () => [] },
    liveStatus: { listDiagnostics: async () => [] },
    deliveryAttempts: { listRecent: async () => [] },
    adapterHealth: { getState: async () => null, listAdapterHealth: async () => [] },
    specialDayYearMaterializer: {
      materializeYear: async (input) => ({
        targetYear: input.targetYear ?? 2026,
        timezone: "Asia/Seoul" as const,
        created: 0,
        updated: 0,
        skipped: 0,
        dryRun: input.dryRun === true,
      }),
    },
    hubEventStatuses: {
      reconcileDueStatuses: async () => ({
        status: "ok" as const,
        checkedAt: "2026-06-22T00:00:00.000Z",
        opened: 0,
        ended: 0,
        startOnlyEnded: 0,
      }),
    },
    ...overrides,
  };
}

describe("music internal routes", () => {
  it("requires internal auth for manual music sync", async () => {
    const app = await buildApp({
      env,
      useProcessEnv: false,
      internalRoutes: { dependencies: createInternalDeps({ musicSync: { syncAllMusic: vi.fn() } }) },
    });

    const response = await app.inject({ method: "POST", url: "/v1/internal/schedulers/music/sync" });
    await app.close();

    expect(response.statusCode).toBe(401);
  });

  it("runs legacy music sync without leaking YouTube API key", async () => {
    const syncAllMusic = vi.fn(async () => ({ status: "ok", sourceCount: 2, failedCount: 0, quotaUnits: 12 }));
    const app = await buildApp({
      env: { ...env, YOUTUBE_API_KEY: "secret-youtube-key" },
      useProcessEnv: false,
      internalRoutes: { dependencies: createInternalDeps({ musicSync: { syncAllMusic } }) },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/music/sync",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: JSON.stringify({ mode: "full" }),
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("secret-youtube-key");
    expect(response.json()).toEqual({ ok: true, status: "ok", sourceCount: 2, failedCount: 0, quotaUnits: 12 });
    expect(syncAllMusic).toHaveBeenCalledWith("full");
  });

  it("runs official playlist sync route", async () => {
    const syncOfficialStelliveMusicPlaylists = vi.fn(async () => ({ status: "ok", uniqueVideos: 2 }));
    const app = await buildApp({
      env,
      useProcessEnv: false,
      internalRoutes: {
        dependencies: createInternalDeps({
          musicSync: { syncAllMusic: vi.fn(), syncOfficialStelliveMusicPlaylists },
        }),
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/music/sync-official-playlists",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: JSON.stringify({ mode: "manual" }),
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, status: "ok", uniqueVideos: 2 });
    expect(syncOfficialStelliveMusicPlaylists).toHaveBeenCalledWith("manual");
  });

  it("exposes review, override, sync log, and quota estimate routes", async () => {
    const listReviewCandidates = vi.fn(async () => [{ videoId: "video-1" }]);
    const upsertOverride = vi.fn(async () => ({ videoId: "video-1", forceExcluded: true }));
    const listSyncRuns = vi.fn(async () => [{ id: "run-1" }]);
    const estimateQuota = vi.fn(async () => ({ dailyEstimate: 300 }));
    const app = await buildApp({
      env: { ...env, YOUTUBE_API_KEY: "secret-youtube-key" },
      useProcessEnv: false,
      internalRoutes: {
        dependencies: createInternalDeps({
          musicSync: {
            syncAllMusic: vi.fn(),
            listReviewCandidates,
            upsertOverride,
            listSyncRuns,
            estimateQuota,
          },
        }),
      },
    });

    const review = await app.inject({ method: "GET", url: "/v1/internal/music/review", headers: authHeaders });
    const override = await app.inject({
      method: "PATCH",
      url: "/v1/internal/music/videos/video-1/override",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: JSON.stringify({ forceExcluded: true, exclusionReason: "manual" }),
    });
    const syncLog = await app.inject({ method: "GET", url: "/v1/internal/music/sync-log", headers: authHeaders });
    const quota = await app.inject({ method: "GET", url: "/v1/internal/music/quota-estimate", headers: authHeaders });
    await app.close();

    expect(review.json()).toEqual({ items: [{ videoId: "video-1" }] });
    expect(override.body).not.toContain("secret-youtube-key");
    expect(override.json()).toEqual({ ok: true, item: { videoId: "video-1", forceExcluded: true } });
    expect(syncLog.json()).toEqual({ items: [{ id: "run-1" }] });
    expect(quota.json()).toEqual({ dailyEstimate: 300 });
    expect(upsertOverride).toHaveBeenCalledWith("video-1", { forceExcluded: true, exclusionReason: "manual" });
  });

  it("rejects invalid music sync mode", async () => {
    const app = await buildApp({
      env,
      useProcessEnv: false,
      internalRoutes: { dependencies: createInternalDeps({ musicSync: { syncAllMusic: vi.fn() } }) },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/music/sync",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: JSON.stringify({ mode: "bad" }),
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "music_sync_body_invalid" });
  });
});
