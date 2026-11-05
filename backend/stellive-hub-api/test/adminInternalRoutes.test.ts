import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { InternalRouteDependencies } from "../src/routes/internalRoutes.js";

const testEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
  INTERNAL_API_TOKEN: "internal-test-token",
  CHZZK_LIVE_POLLING_ENABLED: "false"
};

const authHeaders = { authorization: "Bearer internal-test-token" };

function createFakeDependencies(overrides: Partial<InternalRouteDependencies> = {}): InternalRouteDependencies {
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
          timezone: "Asia/Seoul",
          days: 14,
          generatedAt: "2026-07-02T00:00:00.000Z",
          items: [],
          totals: { sent: 0, queued: 0, skipped: 0, failed: 0, total: 0 }
        },
        externalApiCalls: {
          daily: {
            timezone: "Asia/Seoul",
            days: 14,
            generatedAt: "2026-07-02T00:00:00.000Z",
            items: [],
            totals: { total: 0, ok: 0, failed: 0, rateLimited: 0, quotaExceeded: 0, quotaUnits: 0, bySource: {} }
          }
        }
      })
    },
    notificationJobs: { listDiagnostics: async () => [] },
    summaryNotifications: {
      summarize: async () => ({ queued: 0, locked: 0, completed: 0, skipped: 0, failed: 0 }),
      listDiagnostics: async () => []
    },
    webhookSubscriptions: { listDiagnostics: async () => [] },
    liveStatus: { listDiagnostics: async () => [] },
    deliveryAttempts: { listRecent: async () => [] },
    externalApiCallLogs: { listRecent: async () => ({ items: [] }), pruneOlderThan: async () => ({ deleted: 0 }) },
    adapterHealth: { getState: async () => null, listAdapterHealth: async () => [] },
    specialDayYearMaterializer: {
      materializeYear: async (input) => ({
        targetYear: input.targetYear ?? 2026,
        timezone: "Asia/Seoul",
        created: 0,
        updated: 0,
        skipped: 0,
        dryRun: input.dryRun === true
      })
    },
    hubEventStatuses: {
      reconcileDueStatuses: async (now) => ({
        status: "ok",
        checkedAt: (now ?? new Date("2026-06-20T00:00:00.000Z")).toISOString(),
        opened: 0,
        ended: 0,
        startOnlyEnded: 0
      })
    },
    ...overrides
  };
}

async function buildTestApp(overrides: Partial<InternalRouteDependencies> = {}) {
  return buildApp({
    env: testEnv,
    useProcessEnv: false,
    internalRoutes: { dependencies: createFakeDependencies(overrides) }
  });
}

describe("internal admin routes", () => {
  it("rejects missing internal bearer tokens", async () => {
    const app = await buildTestApp();
    const response = await app.inject({ method: "GET", url: "/v1/internal/adapters/health" });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "missing_authorization" });
  });

  it("rejects invalid internal bearer tokens", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/internal/adapters/health",
      headers: { authorization: "Bearer wrong-token" }
    });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "invalid_token" });
  });

  it("rejects invalid authorization schemes", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/internal/adapters/health",
      headers: { authorization: "Basic internal-test-token" }
    });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "invalid_authorization_scheme" });
  });

  it("returns daily delivery queue trend in admin overview", async () => {
    const app = await buildTestApp({
      adminHealthService: {
        overview: async () => ({
          service: { name: "stellive-hub-api", environment: "test", uptimeSeconds: 1 },
          database: { status: "ok", reason: "fake_database_ready" },
          featureFlags: {},
          secrets: {},
          queue: { queued: 0, locked: 0, completed: 0, failed: 0 },
          adapters: [],
          recentDelivery: { sent: 1, queued: 0, skipped: 0, failed: 0 },
          dailyDeliveryQueue: {
            timezone: "Asia/Seoul",
            days: 14,
            generatedAt: "2026-07-02T00:00:00.000Z",
            items: [{ date: "2026-07-02", sent: 1, queued: 0, skipped: 0, failed: 0, total: 1 }],
            totals: { sent: 1, queued: 0, skipped: 0, failed: 0, total: 1 }
          },
          externalApiCalls: {
            daily: {
              timezone: "Asia/Seoul",
              days: 14,
              generatedAt: "2026-07-02T00:00:00.000Z",
              items: [{ date: "2026-07-02", total: 2, ok: 1, failed: 1, rateLimited: 0, quotaExceeded: 1, quotaUnits: 2, bySource: { youtube: 2 } }],
              totals: { total: 2, ok: 1, failed: 1, rateLimited: 0, quotaExceeded: 1, quotaUnits: 2, bySource: { youtube: 2 } }
            }
          }
        })
      }
    });
    const response = await app.inject({
      method: "GET",
      url: "/v1/internal/admin/overview",
      headers: authHeaders
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      dailyDeliveryQueue: {
        timezone: "Asia/Seoul",
        days: 14,
        items: [{ date: "2026-07-02", sent: 1, queued: 0, skipped: 0, failed: 0, total: 1 }],
        totals: { sent: 1, queued: 0, skipped: 0, failed: 0, total: 1 }
      },
      externalApiCalls: {
        daily: {
          items: [{ date: "2026-07-02", total: 2, ok: 1, failed: 1, quotaExceeded: 1, bySource: { youtube: 2 } }],
          totals: { total: 2, ok: 1, failed: 1, quotaExceeded: 1, bySource: { youtube: 2 } }
        }
      }
    });
    expect(response.body).not.toContain("internal-test-token");
  });

  it("returns recent external API call results from injected dependencies", async () => {
    const listRecent = vi.fn(async () => ({
      items: [
        {
          id: "api-call-1",
          source: "youtube",
          operation: "youtube.videos.list",
          method: "GET",
          host: "www.googleapis.com",
          path: "/youtube/v3/videos",
          statusCode: 403,
          resultStatus: "quota_exceeded",
          durationMs: 120,
          quotaUnits: 1,
          rateLimited: false,
          requestedAt: "2026-07-02T00:00:00.000Z"
        }
      ]
    }));
    const app = await buildTestApp({
      externalApiCallLogs: { listRecent, pruneOlderThan: async () => ({ deleted: 0 }) },
      now: () => new Date("2026-07-02T01:00:00.000Z")
    });
    const response = await app.inject({
      method: "GET",
      url: "/v1/internal/admin/external-api-calls?limit=25&source=youtube&resultStatus=quota_exceeded",
      headers: authHeaders
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(listRecent).toHaveBeenCalledWith({
      limit: 25,
      source: "youtube",
      operation: undefined,
      resultStatus: "quota_exceeded",
      now: new Date("2026-07-02T01:00:00.000Z")
    });
    expect(response.json()).toMatchObject({
      items: [
        {
          source: "youtube",
          operation: "youtube.videos.list",
          host: "www.googleapis.com",
          path: "/youtube/v3/videos",
          resultStatus: "quota_exceeded",
          quotaUnits: 1
        }
      ]
    });
    expect(response.body).not.toContain("internal-test-token");
  });

  it("prunes old external API call logs through the internal admin route", async () => {
    const pruneOlderThan = vi.fn(async () => ({ deleted: 3 }));
    const app = await buildApp({
      env: { ...testEnv, EXTERNAL_API_LOG_RETENTION_DAYS: "45" },
      useProcessEnv: false,
      internalRoutes: {
        dependencies: createFakeDependencies({
          externalApiCallLogs: { listRecent: async () => ({ items: [] }), pruneOlderThan },
          now: () => new Date("2026-07-02T01:00:00.000Z")
        })
      }
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/admin/external-api-calls/prune",
      headers: authHeaders
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ deleted: 3 });
    expect(pruneOlderThan).toHaveBeenCalledWith({ days: 45, now: new Date("2026-07-02T01:00:00.000Z") });
  });

  it("rejects requests when the internal token is not configured", async () => {
    const app = await buildApp({
      env: { DATABASE_URL: testEnv.DATABASE_URL },
      useProcessEnv: false,
      internalRoutes: { dependencies: createFakeDependencies() }
    });
    const response = await app.inject({
      method: "GET",
      url: "/v1/internal/adapters/health",
      headers: { authorization: "Bearer internal-test-token" }
    });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "token_not_configured" });
  });

  it("returns deterministic adapter health from injected dependencies", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/internal/adapters/health",
      headers: authHeaders
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "youtube", status: "disabled", reason: "youtube_websub_disabled" })
      ])
    );
  });

  it("uses injected adapter health records over defaults", async () => {
    const app = await buildTestApp({
      adapterHealth: {
        getState: async () => null,
        listAdapterHealth: async () => [
          {
            source: "naver_cafe",
            status: "disabled",
            reason: "fake_naver_health",
            lastCheckedAt: "2026-06-07T00:00:00.000Z"
          }
        ]
      }
    });
    const response = await app.inject({
      method: "GET",
      url: "/v1/internal/adapters/health",
      headers: authHeaders
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "naver_cafe",
          status: "disabled",
          reason: "fake_naver_health",
          lastCheckedAt: "2026-06-07T00:00:00.000Z"
        })
      ])
    );
  });

  it("merges partial adapter health records with fallback diagnostics", async () => {
    const app = await buildTestApp({
      adapterHealth: {
        getState: vi.fn(),
        listAdapterHealth: async () => [
          {
            source: "chzzk",
            status: "enabled",
            reason: "chzzk_live_api_verified",
            lastCheckedAt: "2026-06-15T00:00:00.000Z"
          }
        ]
      }
    });
    const response = await app.inject({
      method: "GET",
      url: "/v1/internal/adapters/health",
      headers: authHeaders
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "youtube", status: "disabled" }),
        expect.objectContaining({ source: "chzzk", status: "enabled", reason: "chzzk_live_api_verified" }),
        expect.objectContaining({ source: "naver_cafe", status: "disabled" })
      ])
    );
    expect(response.json()).toHaveLength(3);
  });

  it("does not register the optional platform API state route without a distinct contract", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/internal/platform-api-state",
      headers: authHeaders
    });
    await app.close();

    expect(response.statusCode).toBe(404);
  });

  it("falls back and bounds invalid, zero, decimal, and over-100 diagnostic limits", async () => {
    const seenLimits: number[] = [];
    const app = await buildTestApp({
      notificationJobs: {
        listDiagnostics: async (limit) => {
          seenLimits.push(limit);
          return [];
        }
      }
    });

    for (const limit of ["invalid", "0", "12.8", "250"]) {
      const response = await app.inject({
        method: "GET",
        url: `/v1/internal/jobs/notifications?limit=${limit}`,
        headers: authHeaders
      });
      expect(response.statusCode).toBe(200);
    }
    await app.close();

    expect(seenLimits).toEqual([25, 25, 12, 100]);
  });

  it("reads notification drain limits from the request body and returns a stable worker placeholder", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/jobs/notifications/drain?limit=7",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: JSON.stringify({ limit: "250" })
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      claimed: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      sent: 0,
      queued: 0,
      status: "disabled",
      reason: "notification_worker_not_configured",
      summaries: {
        claimed: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        sent: 0,
        queued: 0,
        status: "disabled",
        reason: "summary_notification_worker_not_configured"
      }
    });
  });

  it("rejects notification drain request bodies with caller-controlled delivery fields", async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/jobs/notifications/drain",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: JSON.stringify({
        limit: 5,
        payload: { title: "caller supplied" },
        deviceIds: ["device-1"],
        preferenceOverride: { global: true }
      })
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "notification_drain_body_invalid" });
  });

  it("does not run CHZZK live-status polling when the feature flag is disabled", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/chzzk/live-status",
      headers: authHeaders
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "disabled",
      reason: "chzzk_live_polling_disabled"
    });
  });

  it("requires internal auth for CHZZK live-status scheduler", async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/chzzk/live-status"
    });

    await app.close();
    expect(response.statusCode).toBe(401);
  });

  it("reports verify_required when CHZZK OAuth token state is missing", async () => {
    const app = await buildApp({
      env: { ...testEnv, CHZZK_LIVE_POLLING_ENABLED: "true" },
      useProcessEnv: false,
      internalRoutes: {
        dependencies: createFakeDependencies({
          adapterHealth: {
            getState: async () => null,
            listAdapterHealth: async () => []
          }
        })
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/chzzk/live-status",
      headers: authHeaders
    });

    await app.close();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "verify_required", reason: "chzzk_oauth_token_missing" });
  });

  it("returns CHZZK live adapter counts when polling is enabled and token state exists", async () => {
    const counts = { checked: 1, updated: 1, eventsCreated: 1, skipped: 0, verifyRequired: 0 };
    const pollLiveStatuses = vi.fn(async () => counts);
    const app = await buildApp({
      env: { ...testEnv, CHZZK_LIVE_POLLING_ENABLED: "true" },
      useProcessEnv: false,
      internalRoutes: {
        dependencies: createFakeDependencies({
          adapterHealth: {
            getState: async () => ({ value: "access-token" }),
            listAdapterHealth: async () => []
          },
          chzzkLiveAdapter: {
            pollLiveStatuses
          }
        })
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/chzzk/live-status",
      headers: authHeaders
    });

    await app.close();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", counts });
    expect(pollLiveStatuses).toHaveBeenCalledTimes(1);
  });

  it("requires internal auth for special-day yearly materialization", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/hub-events/special-days/materialize-year"
    });

    await app.close();

    expect(response.statusCode).toBe(401);
  });

  it("requires internal auth for hub event status reconciliation", async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/hub-events/statuses/reconcile"
    });

    await app.close();

    expect(response.statusCode).toBe(401);
  });

  it("dispatches hub event status reconciliation with the scheduler clock", async () => {
    const reconcileDueStatuses = vi.fn(async (now: Date) => ({
      status: "ok" as const,
      checkedAt: now.toISOString(),
      opened: 2,
      ended: 1,
      startOnlyEnded: 3
    }));
    const now = new Date("2026-06-20T10:00:00.000Z");
    const app = await buildTestApp({
      now: () => now,
      hubEventStatuses: { reconcileDueStatuses }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/hub-events/statuses/reconcile",
      headers: authHeaders
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      checkedAt: "2026-06-20T10:00:00.000Z",
      opened: 2,
      ended: 1,
      startOnlyEnded: 3
    });
    expect(reconcileDueStatuses).toHaveBeenCalledWith(now);
  });

  it("dispatches special-day yearly materialization with an explicit target year", async () => {
    const materializeYear = vi.fn(async () => ({
      targetYear: 2027,
      timezone: "Asia/Seoul" as const,
      created: 10,
      updated: 0,
      skipped: 0,
      dryRun: false
    }));
    const app = await buildTestApp({
      specialDayYearMaterializer: { materializeYear }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/hub-events/special-days/materialize-year",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: JSON.stringify({ targetYear: 2027 })
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      targetYear: 2027,
      timezone: "Asia/Seoul",
      created: 10,
      updated: 0,
      skipped: 0,
      dryRun: false
    });
    expect(materializeYear).toHaveBeenCalledWith({ targetYear: 2027, dryRun: false, now: expect.any(Date) });
  });

  it("uses the current KST year for special-day materialization when targetYear is omitted", async () => {
    const materializeYear = vi.fn(async () => ({
      targetYear: 2027,
      timezone: "Asia/Seoul" as const,
      created: 0,
      updated: 10,
      skipped: 0,
      dryRun: true
    }));
    const app = await buildTestApp({
      now: () => new Date("2026-12-31T15:05:00.000Z"),
      specialDayYearMaterializer: { materializeYear }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/hub-events/special-days/materialize-year",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: JSON.stringify({ dryRun: true })
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, targetYear: 2027, dryRun: true });
    expect(materializeYear).toHaveBeenCalledWith({
      targetYear: 2027,
      dryRun: true,
      now: new Date("2026-12-31T15:05:00.000Z")
    });
  });

  it("rejects invalid special-day materialization target years", async () => {
    const materializeYear = vi.fn();
    const app = await buildTestApp({
      specialDayYearMaterializer: { materializeYear }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/schedulers/hub-events/special-days/materialize-year",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: JSON.stringify({ targetYear: 2110 })
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "special_day_materialization_body_invalid" });
    expect(materializeYear).not.toHaveBeenCalled();
  });

  it("does not enable CORS on privileged internal routes", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/internal/adapters/health",
      headers: { ...authHeaders, origin: "https://example.com" }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("does not answer privileged internal preflight requests with CORS headers", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "OPTIONS",
      url: "/v1/internal/jobs/notifications/drain",
      headers: {
        origin: "https://example.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization,content-type"
      }
    });
    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers["access-control-allow-headers"]).toBeUndefined();
  });
});

describe("admin console routes", () => {
  it("returns 404 when the admin console is disabled", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: testEnv.DATABASE_URL,
        ADMIN_CONSOLE_ENABLED: "false"
      },
      useProcessEnv: false
    });
    const response = await app.inject({ method: "GET", url: "/admin" });
    await app.close();

    expect(response.statusCode).toBe(404);
  });

  it("returns 503 when enabled without an effective admin token", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: testEnv.DATABASE_URL,
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: "   "
      },
      useProcessEnv: false
    });
    const response = await app.inject({ method: "GET", url: "/admin" });
    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "admin_console_token_missing" });
  });

  it("does not make non-admin form requests permissive", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: testEnv.DATABASE_URL,
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: "admin-token"
      },
      useProcessEnv: false
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/devices/register",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ deviceId: "form-device", platform: "android" }).toString()
    });
    await app.close();

    expect(response.statusCode).toBe(415);
  });

  it("does not answer admin preflight requests with CORS headers", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: testEnv.DATABASE_URL,
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: "admin-token"
      },
      useProcessEnv: false
    });
    const response = await app.inject({
      method: "OPTIONS",
      url: "/admin",
      headers: {
        origin: "https://example.com",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization"
      }
    });
    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers["access-control-allow-headers"]).toBeUndefined();
  });

  it("does not answer admin session preflight requests with CORS headers", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: testEnv.DATABASE_URL,
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: "admin-token"
      },
      useProcessEnv: false
    });
    const response = await app.inject({
      method: "OPTIONS",
      url: "/v1/admin/session",
      headers: {
        origin: "https://example.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type"
      }
    });
    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers["access-control-allow-headers"]).toBeUndefined();
  });
});

describe("notification worker drain route", () => {
  it("calls an injected notification worker with the clamped body limit", async () => {
    const drainCalls: unknown[] = [];
    const summaryDrainCalls: unknown[] = [];
    const app = await buildTestApp({
      notificationWorker: {
        async drain(input: unknown) {
          drainCalls.push(input);
          return {
            claimed: 2,
            completed: 1,
            failed: 0,
            skipped: 3,
            sent: 4,
            queued: 1,
            status: "partial" as const
          };
        }
      },
      summaryNotificationWorker: {
        async drain(input: unknown) {
          summaryDrainCalls.push(input);
          return { claimed: 2, completed: 1, failed: 0, skipped: 1, sent: 1, queued: 0, status: "ok" as const };
        }
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal/jobs/notifications/drain?limit=7",
      headers: { ...authHeaders, "content-type": "application/json" },
      payload: JSON.stringify({ limit: "250" })
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      claimed: 2,
      completed: 1,
      failed: 0,
      skipped: 3,
      sent: 4,
      queued: 1,
      status: "partial",
      summaries: {
        claimed: 2,
        completed: 1,
        failed: 0,
        skipped: 1,
        sent: 1,
        queued: 0,
        status: "ok"
      }
    });
    expect(drainCalls).toEqual([{ limit: 100 }]);
    expect(summaryDrainCalls).toEqual([{ limit: 100 }]);
  });
});
