import { describe, expect, it } from "vitest";
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
    adapterHealth: { listAdapterHealth: async () => [] },
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
      status: "not_available",
      reason: "notification_worker_not_available",
      requestedLimit: 100
    });
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
    expect(response.body).toContain("/v1/internal/admin/overview");
    expect(response.body).toContain("/v1/internal/jobs/notifications/drain");
    expect(response.body).toContain("/v1/internal/schedulers/youtube/renew-subscriptions");
    expect(response.body).toContain("/v1/internal/schedulers/chzzk/live-status");
    expectAdminThemeSupport(response.body);
    expect(response.body).toContain("Not checked yet");
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
    expect(setCookie).toEqual(expect.stringContaining("Path=/admin"));
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
