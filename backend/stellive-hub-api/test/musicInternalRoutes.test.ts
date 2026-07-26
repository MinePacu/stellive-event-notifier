import { describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import { ResponseCache } from "../src/cache/responseCache.js";
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
        dailyDeliveryQueue: {
          timezone: "Asia/Seoul" as const,
          days: 14,
          generatedAt: "2026-07-02T00:00:00.000Z",
          items: [],
          totals: { sent: 0, queued: 0, skipped: 0, failed: 0, total: 0 },
        },
        externalApiCalls: {
          daily: {
            timezone: "Asia/Seoul" as const,
            days: 14,
            generatedAt: "2026-07-02T00:00:00.000Z",
            items: [],
            totals: { total: 0, ok: 0, failed: 0, rateLimited: 0, quotaExceeded: 0, quotaUnits: 0, bySource: {} },
          },
        },
      }),
    },
    notificationJobs: { listDiagnostics: async () => [] },
    webhookSubscriptions: { listDiagnostics: async () => [] },
    liveStatus: { listDiagnostics: async () => [] },
    deliveryAttempts: { listRecent: async () => [] },
    externalApiCallLogs: { listRecent: async () => ({ items: [] }), pruneOlderThan: async () => ({ deleted: 0 }) },
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

  it("runs channel discovery only when enabled", async () => {
    const discoverChannelUploads = vi.fn(async () => ({ status: "ok", uniqueVideos: 3 }));
    const enabledApp = await buildApp({
      env: { ...env, MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED: "true" },
      useProcessEnv: false,
      internalRoutes: {
        dependencies: createInternalDeps({
          musicSync: { syncAllMusic: vi.fn(), discoverChannelUploads },
        }),
      },
    });

    const enabled = await enabledApp.inject({
      method: "POST",
      url: "/v1/internal/schedulers/music/discover-channel-uploads",
      headers: authHeaders,
    });
    await enabledApp.close();

    expect(enabled.json()).toEqual({ status: "ok", uniqueVideos: 3 });
    expect(discoverChannelUploads).toHaveBeenCalledOnce();
  });

  it("runs discovered upload reclassification route", async () => {
    const reclassifyDiscoveredUploads = vi.fn(async () => ({
      status: "ok",
      checked: 3,
      hidden: 2,
      kept: 1,
      manualSkipped: 0,
    }));
    const app = await buildApp({
      env,
      useProcessEnv: false,
      internalRoutes: {
        dependencies: createInternalDeps({
          musicSync: { syncAllMusic: vi.fn(), reclassifyDiscoveredUploads },
        }),
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/music/reclassify-discovered-uploads",
      headers: authHeaders,
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      checked: 3,
      hidden: 2,
      kept: 1,
      manualSkipped: 0,
    });
    expect(reclassifyDiscoveredUploads).toHaveBeenCalledOnce();
  });

  it("runs source type mismatch repair route", async () => {
    const repairSourceTypeMismatches = vi.fn(async () => ({
      status: "ok",
      checked: 2,
      repaired: 1,
      manualSkipped: 1,
    }));
    const app = await buildApp({
      env,
      useProcessEnv: false,
      internalRoutes: {
        dependencies: createInternalDeps({
          musicSync: { syncAllMusic: vi.fn(), repairSourceTypeMismatches },
        }),
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/music/repair-source-type-mismatches",
      headers: authHeaders,
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      checked: 2,
      repaired: 1,
      manualSkipped: 1,
    });
    expect(repairSourceTypeMismatches).toHaveBeenCalledOnce();
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

  it("invalidates the app-shared music list caches after successful catalog writes", async () => {
    const musicCache = new ResponseCache();
    const invalidatePrefix = vi.spyOn(musicCache, "invalidatePrefix");
    const ingestVideos = vi.fn(async (input) => ({
      items: [],
      summary: {
        requested: input.requestedCount,
        uniqueRequested: input.videoIds.length,
        fetched: 1,
        inserted: 1,
        updated: 0,
        needsReview: 0,
        skipped: 0,
        notFound: 0,
        failed: 0,
        dryRun: input.dryRun,
      },
    }));
    const app = await buildApp({
      env: { ...env, MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED: "true" },
      useProcessEnv: false,
      appRoutes: { dependencies: { musicCache } },
      internalRoutes: {
        dependencies: createInternalDeps({
          musicSync: {
            syncAllMusic: vi.fn(),
            syncOfficialStelliveMusicPlaylists: vi.fn(async () => ({
              status: "ok",
              inserted: 1,
              updated: 0,
            })),
            discoverChannelUploads: vi.fn(async () => ({
              status: "ok",
              inserted: 0,
              updated: 1,
            })),
            reclassifyDiscoveredUploads: vi.fn(async () => ({
              status: "ok",
              checked: 1,
              hidden: 1,
              kept: 0,
              manualSkipped: 0,
            })),
            ingestVideos,
            upsertOverride: vi.fn(async () => ({ videoId: "abcdefghijk", forceExcluded: true })),
          },
        }),
      },
    });

    await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/music/sync-official-playlists",
      headers: authHeaders,
    });
    await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/music/discover-channel-uploads",
      headers: authHeaders,
    });
    await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/music/reclassify-discovered-uploads",
      headers: authHeaders,
    });
    await app.inject({
      method: "POST",
      url: "/v1/internal/music/ingest-videos",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: JSON.stringify({ videoIds: ["abcdefghijk"] }),
    });
    await app.inject({
      method: "PATCH",
      url: "/v1/internal/music/videos/abcdefghijk/override",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: JSON.stringify({ forceExcluded: true }),
    });
    await app.close();

    expect(invalidatePrefix).toHaveBeenCalledTimes(10);
    expect(invalidatePrefix).toHaveBeenCalledWith("/v1/music");
    expect(invalidatePrefix).toHaveBeenCalledWith("/v1/members/");
  });

  it("does not invalidate music list caches for no-op, failed, or dry-run writes", async () => {
    const musicCache = new ResponseCache();
    const invalidatePrefix = vi.spyOn(musicCache, "invalidatePrefix");
    const app = await buildApp({
      env: { ...env, MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED: "true" },
      useProcessEnv: false,
      appRoutes: { dependencies: { musicCache } },
      internalRoutes: {
        dependencies: createInternalDeps({
          musicSync: {
            syncAllMusic: vi.fn(),
            syncOfficialStelliveMusicPlaylists: vi.fn(async () => ({
              status: "ok",
              inserted: 0,
              updated: 0,
              uniqueVideos: 3,
            })),
            discoverChannelUploads: vi.fn(async () => ({
              status: "ok",
              inserted: 0,
              updated: 0,
              uniqueVideos: 3,
            })),
            reclassifyDiscoveredUploads: vi.fn(async () => ({
              status: "ok",
              checked: 2,
              hidden: 0,
              kept: 0,
              manualSkipped: 2,
            })),
            ingestVideos: vi.fn(async () => ({
              items: [],
              summary: {
                requested: 1,
                uniqueRequested: 1,
                fetched: 1,
                inserted: 1,
                updated: 0,
                needsReview: 0,
                skipped: 0,
                notFound: 0,
                failed: 0,
                dryRun: true,
              },
            })),
            upsertOverride: vi.fn(async () => ({ error: "music_item_not_found" })),
          },
        }),
      },
    });

    await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/music/sync-official-playlists",
      headers: authHeaders,
    });
    await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/music/discover-channel-uploads",
      headers: authHeaders,
    });
    await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/music/reclassify-discovered-uploads",
      headers: authHeaders,
    });
    await app.inject({
      method: "POST",
      url: "/v1/internal/music/ingest-videos",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: JSON.stringify({ videoIds: ["abcdefghijk"], dryRun: true }),
    });
    await app.inject({
      method: "PATCH",
      url: "/v1/internal/music/videos/abcdefghijk/override",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: JSON.stringify({ forceExcluded: true }),
    });
    await app.close();

    expect(invalidatePrefix).not.toHaveBeenCalled();
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

  it("validates, normalizes, and deduplicates direct video ingestion", async () => {
    const ingestVideos = vi.fn(async (input) => ({
      items: input.videoIds.map((videoId: string) => ({
        videoId,
        status: "ok" as const,
        action: "would_insert" as const,
        classificationType: "original",
        classificationReason: "structured_title",
        structuredMatchKind: "single",
        memberIds: ["member-1"],
        reviewRequired: false,
        error: null,
      })),
      summary: {
        requested: input.requestedCount,
        uniqueRequested: input.videoIds.length,
        fetched: input.videoIds.length,
        inserted: 0,
        updated: 0,
        needsReview: 0,
        skipped: 0,
        notFound: 0,
        failed: 0,
        dryRun: input.dryRun,
      },
    }));
    const app = await buildApp({
      env,
      useProcessEnv: false,
      internalRoutes: {
        dependencies: createInternalDeps({
          musicSync: { syncAllMusic: vi.fn(), ingestVideos },
        }),
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/music/ingest-videos",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: JSON.stringify({
        videoIds: [" abcdefghijk ", "123456789_-", "abcdefghijk"],
        dryRun: true,
      }),
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(ingestVideos).toHaveBeenCalledWith({
      videoIds: ["abcdefghijk", "123456789_-"],
      dryRun: true,
      requestedCount: 3,
    });
    expect(response.json().summary).toMatchObject({
      requested: 3,
      uniqueRequested: 2,
      dryRun: true,
    });
  });

  it("requires internal auth for direct video ingestion", async () => {
    const ingestVideos = vi.fn();
    const app = await buildApp({
      env,
      useProcessEnv: false,
      internalRoutes: {
        dependencies: createInternalDeps({
          musicSync: { syncAllMusic: vi.fn(), ingestVideos },
        }),
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/music/ingest-videos",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ videoIds: ["abcdefghijk"] }),
    });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(ingestVideos).not.toHaveBeenCalled();
  });

  it.each([
    [{ videoIds: [] }],
    [{ videoIds: ["short"] }],
    [{ videoIds: ["abcdefghijk"], dryRun: "true" }],
    [{ videoIds: ["abcdefghijk"], unexpected: true }],
    [{ videoIds: Array.from({ length: 51 }, (_, index) => String(index).padStart(11, "0")) }],
  ])("rejects an invalid direct video ingestion body: %j", async (payload) => {
    const app = await buildApp({
      env,
      useProcessEnv: false,
      internalRoutes: {
        dependencies: createInternalDeps({
          musicSync: { syncAllMusic: vi.fn(), ingestVideos: vi.fn() },
        }),
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/music/ingest-videos",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: JSON.stringify(payload),
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "music_ingest_videos_body_invalid" });
  });

  it("exposes secret-free music configuration diagnostics", async () => {
    const app = await buildApp({
      env: {
        ...env,
        MUSIC_SYNC_ENABLED: "true",
        MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED: "true",
        YOUTUBE_API_KEY: "replace_with_youtube_api_key",
      },
      useProcessEnv: false,
      internalRoutes: {
        dependencies: createInternalDeps({
          musicSync: { syncAllMusic: vi.fn(), discoverChannelUploads: vi.fn() },
        }),
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/internal/music/config-diagnostics",
      headers: authHeaders,
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("internal-test-token");
    expect(response.body).not.toContain("replace_with_youtube_api_key");
    expect(response.json()).toEqual({
      musicSyncEnabled: true,
      channelDiscoveryEnabled: true,
      youtubeApiConfigured: false,
      internalApiTokenConfigured: true,
      musicSyncServiceConfigured: true,
      channelDiscoveryServiceConfigured: true,
      workerExpectedToRun: false,
    });
  });
});
