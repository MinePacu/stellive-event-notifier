import { describe, expect, it, vi } from "vitest";
import { adminSessionCookieName } from "../src/admin/adminAuth.js";
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
        recentDelivery: { sent: 0, queued: 0, skipped: 0, failed: 0 }
      })
    },
    notificationJobs: { listDiagnostics: async () => [] },
    webhookSubscriptions: { listDiagnostics: async () => [] },
    liveStatus: { listDiagnostics: async () => [] },
    deliveryAttempts: { listRecent: async () => [] },
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

function expectAdminThemeSupport(html: string) {
  expect(html).toContain("stellive-admin-theme");
  expect(html).toContain("theme-control");
  expect(html).toContain('data-theme-option="light"');
  expect(html).toContain('data-theme-option="system"');
  expect(html).toContain('data-theme-option="dark"');
  expect(html).toContain('data-theme-option="black"');
  expect(html).toContain('data-theme-default="system"');
}

function expectHubEventAdminConsoleSupport(html: string) {
  expect(html).toContain('data-admin-section="hub-events"');
  expect(html).toContain('data-hub-event-action="save-draft"');
  expect(html).toContain('data-hub-event-action="publish"');
  expect(html).toContain('data-hub-event-action="cancel"');
  expect(html).toContain('data-hub-event-action="deactivate"');
  expect(html).toContain('data-hub-event-action="delete"');
  expect(html).not.toContain('type="file"');
  expect(html).toContain('id="hub-event-image-url"');
  expect(html).toContain('id="hub-event-image-policy-state"');
  expect(html).not.toContain('name="logoUrl"');
  expect(html).not.toContain('name="posterUrl"');
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
        expect.objectContaining({ source: "x", status: "disabled", reason: "x_no_free_official_api" })
      ])
    );
  });

  it("uses injected adapter health records over defaults", async () => {
    const app = await buildTestApp({
      adapterHealth: {
        getState: async () => null,
        listAdapterHealth: async () => [
          {
            source: "x",
            status: "disabled",
            reason: "fake_x_health",
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
          source: "x",
          status: "disabled",
          reason: "fake_x_health",
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
        expect.objectContaining({ source: "x", status: "disabled" }),
        expect.objectContaining({ source: "naver_cafe", status: "disabled" })
      ])
    );
    expect(response.json()).toHaveLength(4);
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
      reason: "notification_worker_not_configured"
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

  it("redirects browser-style unauthenticated admin console requests to login", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: testEnv.DATABASE_URL,
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: "admin-token"
      },
      useProcessEnv: false
    });
    const response = await app.inject({ method: "GET", url: "/admin" });
    await app.close();

    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("/admin/login");
  });

  it("does not accept admin tokens from query strings", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: testEnv.DATABASE_URL,
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: "admin-token"
      },
      useProcessEnv: false
    });
    const response = await app.inject({ method: "GET", url: "/admin?token=admin-token" });
    await app.close();

    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("/admin/login");
  });

  it("rejects wrong admin tokens", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: testEnv.DATABASE_URL,
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: "admin-token"
      },
      useProcessEnv: false
    });
    const response = await app.inject({
      method: "GET",
      url: "/admin",
      headers: { authorization: "Bearer wrong-token" }
    });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "invalid_token" });
  });

  it("does not accept the internal api token for /admin when the admin token differs", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: testEnv.DATABASE_URL,
        INTERNAL_API_TOKEN: "internal-test-token",
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: "admin-token"
      },
      useProcessEnv: false
    });
    const response = await app.inject({
      method: "GET",
      url: "/admin",
      headers: { authorization: "Bearer internal-test-token" }
    });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "invalid_token" });
  });

  it("serves the admin console with a valid admin token", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: testEnv.DATABASE_URL,
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: "admin-token"
      },
      useProcessEnv: false
    });
    const response = await app.inject({
      method: "GET",
      url: "/admin",
      headers: { authorization: "Bearer admin-token" }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers["content-security-policy"]).toContain("connect-src 'self'");
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.body).toContain("Stellive Hub Admin");
    expect(response.body).toContain('action="/admin/logout"');
    expect(response.body).toContain('class="refresh-controls"');
    expect(response.body).toContain('id="refresh"');
    expect(response.body).toContain(">Refresh<");
    expect(response.body).toContain('class="switch-control"');
    expect(response.body).toContain('class="auto-refresh-switch"');
    expect(response.body).toContain('id="auto-refresh"');
    expect(response.body).toContain('type="checkbox"');
    expect(response.body).toContain("Auto refresh");
    expect(response.body).toContain('id="auto-refresh-status"');
    expect(response.body).toContain('class="auto-refresh-status pill disabled"');
    expect(response.body).toContain('aria-live="polite"');
    expect(response.body).toContain("events-card");
    expect(response.body).toContain("card-body events-card-body");
    expect(response.body).toContain("panel validation-panel");
    expect(response.body).toContain("panel audit-log-panel");
    expect(response.body).toContain('class="table-scroll"');
    expect(response.body).toContain('@media (max-width: 640px)');
    expect(response.body).toContain(
      'data-tooltip="Refresh adapter, secret, feature flag, and job status."',
    );
    expect(response.body).toContain(
      'data-tooltip="Validate the current Hub event form without saving."',
    );
    expect(response.body).not.toContain("admin-token");
    expect(response.body).not.toContain("internal-test-token");
    expect(response.body).not.toContain('dateStyle: "medium"');
    expect(response.body).toContain('timeZoneName: "short"');
    expect(response.body).toContain("/v1/internal/admin/overview");
    expect(response.body).toContain("/v1/internal/jobs/notifications/drain");
    expect(response.body).toContain("/v1/internal/schedulers/youtube/renew-subscriptions");
    expect(response.body).toContain("/v1/internal/schedulers/chzzk/live-status");
    expectAdminThemeSupport(response.body);
    expectHubEventAdminConsoleSupport(response.body);
    expect(response.body).toContain("Not checked yet");
    expect(response.body).toContain("stellive.admin.internalApiToken");
    expect(response.body).toContain("window.sessionStorage");
    expect(response.body).toContain('tokenInput.addEventListener("input", persistInternalToken)');
    expect(response.body).toContain('logoutForm.addEventListener("submit", clearStoredInternalToken)');
    expect(response.body).toContain("function formatUptime(seconds)");
    expect(response.body).toContain("setInterval(renderUptimeTick, 1000)");
    expect(response.body).toContain("Date.now() - uptimeBaseTimestamp");
  });

  it("serves a login form when enabled without leaking the admin token", async () => {
    const adminToken = "admin-token";
    const app = await buildApp({
      env: {
        DATABASE_URL: testEnv.DATABASE_URL,
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: adminToken
      },
      useProcessEnv: false
    });
    const response = await app.inject({ method: "GET", url: "/admin/login" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response.body).toContain("Stellive Hub Admin");
    expect(response.body).toContain('form method="post" action="/admin/login"');
    expect(response.body).toContain('name="token"');
    expectAdminThemeSupport(response.body);
    expect(response.body).not.toContain(adminToken);
  });

  it("returns 401 HTML and no session cookie for wrong browser login tokens", async () => {
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
      url: "/admin/login",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ token: "wrong-token" }).toString()
    });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.body).toContain("Invalid admin token.");
    expect(response.body).not.toContain("admin-token");
  });

  it("returns 303 to /admin with an HttpOnly SameSite=Strict session cookie for valid browser login tokens", async () => {
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
      url: "/admin/login",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ token: "admin-token" }).toString()
    });
    await app.close();

    const setCookie = response.headers["set-cookie"];
    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("/admin");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(setCookie).toEqual(expect.stringContaining(`${adminSessionCookieName}=`));
    expect(setCookie).toEqual(expect.stringContaining("HttpOnly"));
    expect(setCookie).toEqual(expect.stringContaining("SameSite=Strict"));
    expect(setCookie).toEqual(expect.stringContaining("Path=/"));
    expect(setCookie).not.toEqual(expect.stringContaining("Secure"));
    expect(setCookie).not.toEqual(expect.stringContaining("admin-token"));
  });

  it("does not trust arbitrary forwarded proto headers for secure browser login cookies", async () => {
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
      url: "/admin/login",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-forwarded-proto": "https"
      },
      payload: new URLSearchParams({ token: "admin-token" }).toString()
    });
    await app.close();

    expect(response.statusCode).toBe(303);
    expect(response.headers["set-cookie"]).not.toEqual(expect.stringContaining("Secure"));
  });

  it("adds Secure to the session cookie when ADMIN_CONSOLE_COOKIE_SECURE is enabled", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: testEnv.DATABASE_URL,
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: "admin-token",
        ADMIN_CONSOLE_COOKIE_SECURE: "true"
      },
      useProcessEnv: false
    });
    const response = await app.inject({
      method: "POST",
      url: "/admin/login",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ token: "admin-token" }).toString()
    });
    await app.close();

    expect(response.statusCode).toBe(303);
    expect(response.headers["set-cookie"]).toEqual(expect.stringContaining("Secure"));
  });

  it("serves the admin console with a valid admin session cookie", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: testEnv.DATABASE_URL,
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: "admin-token"
      },
      useProcessEnv: false
    });
    const loginResponse = await app.inject({
      method: "POST",
      url: "/admin/login",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ token: "admin-token" }).toString()
    });
    const cookie = String(loginResponse.headers["set-cookie"]).split(";")[0];
    const response = await app.inject({
      method: "GET",
      url: "/admin",
      headers: { cookie }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("Stellive Hub Admin");
    expect(response.body).toContain('action="/admin/logout"');
    expect(response.body).toContain("/v1/internal/admin/overview");
  });

  it("returns 303 to login and clears the session cookie on logout", async () => {
    const app = await buildApp({
      env: {
        DATABASE_URL: testEnv.DATABASE_URL,
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: "admin-token"
      },
      useProcessEnv: false
    });
    const response = await app.inject({ method: "POST", url: "/admin/logout" });
    await app.close();

    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toBe("/admin/login");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(response.headers["set-cookie"]).toEqual(expect.stringContaining(`${adminSessionCookieName}=`));
    expect(response.headers["set-cookie"]).toEqual(expect.stringContaining("Max-Age=0"));
    expect(response.headers["set-cookie"]).toEqual(expect.stringContaining("HttpOnly"));
    expect(response.headers["set-cookie"]).toEqual(expect.stringContaining("SameSite=Strict"));
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

  it("does not answer admin login preflight requests with CORS headers", async () => {
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
      url: "/admin/login",
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

  it("does not answer admin logout preflight requests with CORS headers", async () => {
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
      url: "/admin/logout",
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

  it("does not leak configured tokens into admin html response bodies", async () => {
    const adminToken = "review-admin-token-123";
    const internalToken = "review-internal-token-456";
    const app = await buildApp({
      env: {
        DATABASE_URL: testEnv.DATABASE_URL,
        INTERNAL_API_TOKEN: internalToken,
        ADMIN_CONSOLE_ENABLED: "true",
        ADMIN_CONSOLE_TOKEN: adminToken
      },
      useProcessEnv: false
    });
    const consoleResponse = await app.inject({
      method: "GET",
      url: "/admin",
      headers: {
        authorization: `Bearer ${adminToken}`,
        origin: "https://example.com"
      }
    });
    const loginResponse = await app.inject({ method: "GET", url: "/admin/login" });
    await app.close();

    expect(consoleResponse.statusCode).toBe(200);
    expect(loginResponse.statusCode).toBe(200);
    expect(consoleResponse.body).not.toContain(adminToken);
    expect(consoleResponse.body).not.toContain(internalToken);
    expect(loginResponse.body).not.toContain(adminToken);
    expect(loginResponse.body).not.toContain(internalToken);
  });
});
describe("notification worker drain route", () => {
  it("calls an injected notification worker with the clamped body limit", async () => {
    const drainCalls: unknown[] = [];
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
      status: "partial"
    });
    expect(drainCalls).toEqual([{ limit: 100 }]);
  });
});
