import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { adminAuthConfigurationWarnings } from "../src/app.js";
import { AuthFailureLimiter } from "../src/admin/authFailureLimiter.js";
import { loadEnv } from "../src/config/env.js";
import type { InternalRouteDependencies } from "../src/routes/internalRoutes.js";

const adminToken = "admin-token";
const baseEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
  INTERNAL_API_TOKEN: "internal-test-token",
  CHZZK_LIVE_POLLING_ENABLED: "false",
  ADMIN_CONSOLE_ENABLED: "true",
  ADMIN_CONSOLE_TOKEN: adminToken
};
const windowMs = 15 * 60 * 1000;

function createClock(start = Date.UTC(2026, 0, 1)) {
  const clock = { value: start };
  return { clock, now: () => clock.value };
}

async function createApp(env: Record<string, string> = {}) {
  const { clock, now } = createClock();
  const limiter = new AuthFailureLimiter({ now });
  const hubEventList = vi.fn(async () => ({ items: [] }));
  const listDiagnostics = vi.fn(async () => []);
  const app = await buildApp({
    env: {
      ...baseEnv,
      CHZZK_OAUTH_ENABLED: "true",
      CHZZK_CLIENT_ID: "client-id",
      CHZZK_CLIENT_SECRET: "client-secret",
      CHZZK_AUTH_STATE_SECRET: "local-state-secret",
      CHZZK_REDIRECT_URI: "http://localhost:4000/v1/auth/chzzk/callback",
      ...env
    },
    useProcessEnv: false,
    authFailureLimiter: limiter,
    chzzkAuthRoutes: { dependencies: { authClient: { buildAuthorizeUrl: () => "https://chzzk.example/authorize" } as never } },
    internalRoutes: {
      dependencies: { webhookSubscriptions: { listDiagnostics } } as unknown as InternalRouteDependencies
    },
    adminHubEventRoutes: { dependencies: { service: { list: hubEventList } as never } },
    adminServiceAnnouncementRoutes: { service: { list: vi.fn(async () => ({ items: [] })) } as never }
  });
  return { app, clock, limiter };
}

type App = Awaited<ReturnType<typeof createApp>>["app"];

function login(app: App, token: string, headers: Record<string, string> = {}, remoteAddress?: string) {
  return app.inject({
    method: "POST",
    url: "/admin/login",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    payload: `token=${encodeURIComponent(token)}`,
    remoteAddress
  });
}

function bearer(app: App, url: string, token: string, headers: Record<string, string> = {}, remoteAddress?: string) {
  return app.inject({ method: "GET", url, headers: { authorization: `Bearer ${token}`, ...headers }, remoteAddress });
}

describe("failed admin/internal auth throttling", () => {
  it("blocks the 11th admin login attempt even with the correct token, then recovers after the window", async () => {
    const { app, clock } = await createApp();
    for (let i = 0; i < 10; i += 1) {
      expect((await login(app, "wrong")).statusCode, `attempt ${i + 1}`).toBe(401);
    }

    const blocked = await login(app, adminToken);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers["content-type"]).toContain("text/html");
    expect(String(blocked.headers["set-cookie"])).not.toContain("stellive_admin_session");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(blocked.headers["retry-after"])).toBeLessThanOrEqual(windowMs / 1000);

    clock.value += windowMs + 1000;
    const recovered = await login(app, adminToken);
    expect(recovered.statusCode).toBe(303);
    await app.close();
  });

  it("returns the translated message on the throttled login page", async () => {
    const { app } = await createApp();
    for (let i = 0; i < 10; i += 1) await login(app, "wrong");
    const en = await login(app, adminToken, { "accept-language": "en" });
    expect(en.statusCode).toBe(429);
    expect(en.body).toContain("Too many failed attempts");
    const ko = await login(app, adminToken, { "accept-language": "ko" });
    expect(ko.body).toContain("시도");
    await app.close();
  });

  it("throttles wrong bearer tokens on admin hub-event routes but never counts missing credentials", async () => {
    const { app } = await createApp();
    for (let i = 0; i < 30; i += 1) {
      expect((await app.inject({ method: "GET", url: "/v1/admin/hub-events" })).statusCode).toBe(401);
    }
    for (let i = 0; i < 10; i += 1) {
      expect((await bearer(app, "/v1/admin/hub-events", "wrong")).statusCode, `attempt ${i + 1}`).toBe(401);
    }
    const blocked = await bearer(app, "/v1/admin/hub-events", adminToken);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toEqual({ error: "auth_rate_limited" });
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    await app.close();
  });

  it("shares the counter across admin hub-event, announcement, login and chzzk start routes", async () => {
    const { app } = await createApp();
    for (let i = 0; i < 4; i += 1) await bearer(app, "/v1/admin/hub-events", "wrong");
    for (let i = 0; i < 3; i += 1) await bearer(app, "/v1/admin/announcements", "wrong");
    for (let i = 0; i < 2; i += 1) await login(app, "wrong");
    expect((await bearer(app, "/v1/auth/chzzk/start", "wrong")).statusCode).toBe(401);
    expect((await bearer(app, "/v1/auth/chzzk/start", adminToken)).statusCode).toBe(429);
    expect((await bearer(app, "/v1/admin/announcements", adminToken)).statusCode).toBe(429);
    await app.close();
  });

  it("throttles wrong bearer tokens on internal routes", async () => {
    const { app } = await createApp();
    for (let i = 0; i < 10; i += 1) {
      expect((await bearer(app, "/v1/internal/webhooks/subscriptions", "wrong")).statusCode, `attempt ${i + 1}`).toBe(401);
    }
    const blocked = await bearer(app, "/v1/internal/webhooks/subscriptions", "internal-test-token");
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toEqual({ error: "auth_rate_limited" });
    await app.close();
  });

  it("does not count token_not_configured", async () => {
    const { app } = await createApp({ INTERNAL_API_TOKEN: "" });
    for (let i = 0; i < 15; i += 1) {
      expect((await bearer(app, "/v1/internal/webhooks/subscriptions", "anything")).statusCode).toBe(401);
    }
    await app.close();
  });

  it("clears the counter after a successful authentication", async () => {
    const { app } = await createApp();
    for (let i = 0; i < 9; i += 1) await login(app, "wrong");
    expect((await login(app, adminToken)).statusCode).toBe(303);
    for (let i = 0; i < 10; i += 1) {
      expect((await login(app, "wrong")).statusCode, `attempt ${i + 1}`).toBe(401);
    }
    expect((await login(app, "wrong")).statusCode).toBe(429);
    await app.close();
  });

  it("counts clients separately via X-Forwarded-For when TRUST_PROXY is true", async () => {
    const { app } = await createApp({ TRUST_PROXY: "true" });
    for (let i = 0; i < 10; i += 1) {
      expect((await login(app, "wrong", { "x-forwarded-for": "203.0.113.10" })).statusCode).toBe(401);
    }
    expect((await login(app, adminToken, { "x-forwarded-for": "203.0.113.10" })).statusCode).toBe(429);
    expect((await login(app, adminToken, { "x-forwarded-for": "203.0.113.11" })).statusCode).toBe(303);
    await app.close();
  });

  it("ignores X-Forwarded-For when TRUST_PROXY is false", async () => {
    const { app } = await createApp();
    for (let i = 0; i < 10; i += 1) {
      expect((await login(app, "wrong", { "x-forwarded-for": `203.0.113.${i}` }, "198.51.100.7")).statusCode).toBe(401);
    }
    expect((await login(app, adminToken, { "x-forwarded-for": "203.0.113.200" }, "198.51.100.7")).statusCode).toBe(429);
    expect((await login(app, adminToken, {}, "198.51.100.8")).statusCode).toBe(303);
    await app.close();
  });

  it("marks the admin session cookie Secure behind a trusted HTTPS proxy", async () => {
    const trusted = await createApp({ TRUST_PROXY: "true" });
    const secure = await login(trusted.app, adminToken, { "x-forwarded-proto": "https" });
    expect(secure.statusCode).toBe(303);
    expect(String(secure.headers["set-cookie"])).toContain("Secure");
    await trusted.app.close();

    const untrusted = await createApp();
    const insecure = await login(untrusted.app, adminToken, { "x-forwarded-proto": "https" });
    expect(String(insecure.headers["set-cookie"])).not.toContain("Secure");
    await untrusted.app.close();
  });
});

describe("weak token startup warnings", () => {
  it("warns for configured tokens shorter than 32 characters without leaking them", () => {
    const warnings = adminAuthConfigurationWarnings(
      loadEnv({ ...baseEnv, ADMIN_CONSOLE_TOKEN: "x".repeat(10), INTERNAL_API_TOKEN: "y".repeat(31) })
    );
    expect(warnings).toEqual(["admin_console_token_weak", "internal_api_token_weak"]);
  });

  it("does not warn for strong, unconfigured, placeholder or disabled-console tokens", () => {
    const strong = "z".repeat(40);
    expect(adminAuthConfigurationWarnings(loadEnv({ ...baseEnv, ADMIN_CONSOLE_TOKEN: strong, INTERNAL_API_TOKEN: strong }))).toEqual([]);
    expect(adminAuthConfigurationWarnings(loadEnv({ DATABASE_URL: baseEnv.DATABASE_URL, ADMIN_CONSOLE_ENABLED: "true", INTERNAL_API_TOKEN: "replace_with_internal_api_token" }))).toEqual([]);
    expect(
      adminAuthConfigurationWarnings(loadEnv({ ...baseEnv, ADMIN_CONSOLE_ENABLED: "false", ADMIN_CONSOLE_TOKEN: "short", INTERNAL_API_TOKEN: strong }))
    ).toEqual([]);
  });

  it("defaults TRUST_PROXY to false", () => {
    expect(loadEnv({ ...baseEnv }).TRUST_PROXY).toBe(false);
    expect(loadEnv({ ...baseEnv, TRUST_PROXY: "true" }).TRUST_PROXY).toBe(true);
  });
});

describe("AuthFailureLimiter", () => {
  it("limits after 10 failures per window and resets on success", () => {
    const { clock, now } = createClock();
    const limiter = new AuthFailureLimiter({ now });
    for (let i = 0; i < 10; i += 1) limiter.recordFailure("1.1.1.1");
    expect(limiter.retryAfterSeconds("1.1.1.1")).toBeGreaterThan(0);
    expect(limiter.retryAfterSeconds("2.2.2.2")).toBeUndefined();
    clock.value += windowMs;
    expect(limiter.retryAfterSeconds("1.1.1.1")).toBeUndefined();

    for (let i = 0; i < 10; i += 1) limiter.recordFailure("1.1.1.1");
    limiter.recordResult("1.1.1.1", { ok: true });
    expect(limiter.retryAfterSeconds("1.1.1.1")).toBeUndefined();
  });

  it("only counts invalid credentials", () => {
    const limiter = new AuthFailureLimiter({ now: () => 0 });
    for (let i = 0; i < 20; i += 1) {
      limiter.recordResult("1.1.1.1", { ok: false, reason: "missing_authorization" });
      limiter.recordResult("1.1.1.1", { ok: false, reason: "token_not_configured" });
    }
    expect(limiter.retryAfterSeconds("1.1.1.1")).toBeUndefined();
    for (let i = 0; i < 10; i += 1) limiter.recordResult("1.1.1.1", { ok: false, reason: "invalid_token" });
    expect(limiter.retryAfterSeconds("1.1.1.1")).toBeGreaterThan(0);
  });

  it("keeps its map bounded", () => {
    const { clock, now } = createClock();
    const limiter = new AuthFailureLimiter({ now, maxKeys: 100 });
    for (let i = 0; i < 1000; i += 1) {
      limiter.recordFailure(`10.0.${Math.floor(i / 256)}.${i % 256}`);
      expect(limiter.size).toBeLessThanOrEqual(100);
    }
    clock.value += windowMs + 1;
    limiter.recordFailure("192.0.2.1");
    expect(limiter.size).toBe(1);
  });
});
