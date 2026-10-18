import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { createChzzkOAuthState, verifyChzzkOAuthState } from "../src/adapters/chzzk/chzzkOAuthState.js";
import { createAdminSessionCookie } from "../src/admin/adminAuth.js";
import { registerChzzkAuthRoutes } from "../src/routes/chzzkAuthRoutes.js";

const routeEnv = {
  NODE_ENV: "test",
  PORT: 4000,
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub_test",
  HUB_EVENTS_STORAGE_MODE: "memory" as const,
  BOOTSTRAP_CATALOG_CACHE_TTL_SECONDS: 30,
  BOOTSTRAP_LIVE_STATUS_CACHE_TTL_SECONDS: 10,
  BOOTSTRAP_HUB_EVENTS_SUMMARY_CACHE_TTL_SECONDS: 30,
  CHANNEL_IMAGE_CACHE_TTL_SECONDS: 604800,
  CHANNEL_IMAGE_REFRESH_WAIT_MS: 1500,
  YOUTUBE_WEBSUB_ENABLED: true,
  YOUTUBE_DATA_API_FALLBACK_ENABLED: false,
  YOUTUBE_API_BASE_URL: "https://www.googleapis.com/youtube/v3",
  YOUTUBE_SONG_BACKFILL_MAX_PAGES: 1,
  YOUTUBE_SONG_RECONCILE_MAX_CHANNELS: 10,
  MUSIC_SYNC_ENABLED: false,
  MUSIC_CHANNEL_DISCOVERY_SYNC_ENABLED: false,
  MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES: 60,
  MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES: 5,
  MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR: 12,
  MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR: 24,
  MUSIC_CHANNEL_DISCOVERY_TIME_ZONE: "Asia/Seoul",
  MUSIC_CHANNEL_DISCOVERY_RECENT_PAGES: 1,
  MUSIC_CACHE_TTL_SECONDS: 600,
  MUSIC_CACHE_STALE_SECONDS: 600,
  MUSIC_CACHE_MAX_ENTRIES: 256,
  MUSIC_SYNC_LOCK_SECONDS: 30,
  LIGHT_SYNC_INTERVAL_MINUTES: 10,
  FULL_SYNC_INTERVAL_MINUTES: 60,
  STELLIVE_MUSIC_SYNC_INTERVAL_MINUTES: 60,
  STELLIVE_MUSIC_COVER_PLAYLIST_ID: "PLLjd981H8qSN9PQ8-X6wINqBF1GjGxusy",
  STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID: "PLLjd981H8qSMGC4Nir0hD2Gj9n9PDUoHX",
  DAILY_RECONCILE_CRON: "0 4 * * *",
  MUSIC_LIGHT_SYNC_MAX_PAGES: 2,
  NAVER_CAFE_SEARCH_ENABLED: false,
  CHZZK_CLIENT_ID: "client-id",
  CHZZK_CLIENT_SECRET: "client-secret",
  CHZZK_REDIRECT_URI: "http://localhost:4000/v1/auth/chzzk/callback",
  CHZZK_AUTH_STATE_SECRET: "local-state-secret",
  CHZZK_OAUTH_ENABLED: true,
  CHZZK_OAUTH_CONFIGURED: true,
  CHZZK_TOKEN_REFRESH_SKEW_SECONDS: 300,
  CHZZK_LIVE_POLLING_ENABLED: false,
  CHZZK_LIVE_LIST_MAX_PAGES: 5,
  DB_NOTIFICATION_QUEUE_ENABLED: true,
  FOREGROUND_SSE_ENABLED: false,
  FCM_RATE_LIMIT_ENABLED: true,
  FCM_SEND_MAX_PER_SECOND: 500,
  FCM_SEND_MAX_PER_MINUTE: 30_000,
  FCM_SEND_BURST: 1_000,
  NOTIFICATION_DEVICE_BATCH_SIZE: 500,
  NOTIFICATION_PREFERENCE_BATCH_SIZE: 500,
  DELIVERY_ATTEMPT_BATCH_SIZE: 500,
  ADMIN_CONSOLE_ENABLED: false,
  ADMIN_CONSOLE_TOKEN: "admin-token",
  ADMIN_OVERVIEW_CACHE_TTL_SECONDS: 15,
  EXTERNAL_API_LOG_RETENTION_DAYS: 31,
  DELIVERY_ATTEMPT_RETENTION_DAYS: 30,
  LOG_RETENTION_INTERVAL_MINUTES: 60,
  LOG_RETENTION_ENABLED: true,
  YOUTUBE_WEBSUB_AUTO_RENEW_ENABLED: true,
  YOUTUBE_WEBSUB_RENEW_CHECK_INTERVAL_MINUTES: 60,
  YOUTUBE_WEBSUB_RENEW_BEFORE_HOURS: 48,
  ADMIN_CONSOLE_COOKIE_SECURE: false,
  TRUST_PROXY: false,
  DEVICE_WRITE_RATE_LIMIT_PER_MINUTE: 60,
  DEVICE_READ_RATE_LIMIT_PER_MINUTE: 240
};

describe("CHZZK OAuth state signing", () => {
  const secret = "local-state-secret";
  const now = new Date("2026-06-11T00:00:00.000Z");

  it("creates and verifies a URL-safe signed state that carries its nonce", () => {
    const { state, nonce } = createChzzkOAuthState(secret, now);

    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifyChzzkOAuthState(secret, state, now)).toEqual({ ok: true, nonce });
  });

  it("rejects a tampered state", () => {
    const { state } = createChzzkOAuthState(secret, now);
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [payload] = decoded.split(".");
    const tampered = Buffer.from(`${payload}.invalid-signature`, "utf8").toString("base64url");

    expect(verifyChzzkOAuthState(secret, tampered, now)).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("rejects an expired state", () => {
    const { state } = createChzzkOAuthState(secret, now);
    const tooLate = new Date(now.getTime() + 10 * 60 * 1000 + 1);

    expect(verifyChzzkOAuthState(secret, state, tooLate)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a state issued more than 60 seconds in the future", () => {
    const { state } = createChzzkOAuthState(secret, new Date(now.getTime() + 5 * 60 * 1000));

    expect(verifyChzzkOAuthState(secret, state, now)).toEqual({ ok: false, reason: "future" });
  });
});

const fixedNow = new Date("2026-06-11T00:00:00.000Z");
const adminEnv = { ...routeEnv, ADMIN_CONSOLE_ENABLED: true };

function adminCookieHeader(): string {
  const cookie = createAdminSessionCookie({ adminToken: "admin-token", secure: false });
  return `${cookie!.name}=${cookie!.value}`;
}

function readSetCookie(response: { headers: Record<string, unknown> }): string[] {
  const value = response.headers["set-cookie"];
  if (!value) return [];
  return Array.isArray(value) ? (value as string[]) : [String(value)];
}

function createStateRepository(stored: Array<{ source: string; key: string; value: unknown; status: string }> = []) {
  return {
    upsertState: async (source: string, key: string, value: unknown, status: string) => {
      stored.push({ source, key, value, status });
    },
    upsertAdapterHealth: async (source: string, health: { status: string }) => {
      stored.push({ source, key: "health", value: health, status: health.status });
    }
  };
}

async function buildCallbackApp(options: { exchange?: () => Promise<never> | Promise<any>; stored?: Array<{ source: string; key: string; value: unknown; status: string }>; env?: typeof routeEnv } = {}) {
  const app = Fastify();
  const exchange = vi.fn(
    options.exchange ??
      (async () => ({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        tokenType: "Bearer",
        expiresIn: 86400,
        scope: "channel"
      }))
  );
  await registerChzzkAuthRoutes(app, {
    env: options.env ?? routeEnv,
    authClient: {
      buildAuthorizeUrl: () => "https://chzzk.naver.com/account-interlock",
      exchangeCodeForToken: exchange
    },
    stateRepository: createStateRepository(options.stored),
    now: () => fixedNow
  });
  return { app, exchange };
}

describe("CHZZK OAuth routes", () => {
  it("returns 503 when OAuth is disabled or not configured", async () => {
    const app = Fastify();
    await registerChzzkAuthRoutes(app, {
      env: { ...routeEnv, CHZZK_OAUTH_ENABLED: false, CHZZK_OAUTH_CONFIGURED: false },
      authClient: {
        buildAuthorizeUrl: () => "https://chzzk.naver.com/account-interlock",
        exchangeCodeForToken: async () => {
          throw new Error("should_not_exchange");
        }
      },
      stateRepository: createStateRepository(),
      now: () => fixedNow
    });

    const response = await app.inject({ method: "GET", url: "/v1/auth/chzzk/start" });
    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "chzzk_oauth_not_configured" });
  });

  it("redirects to the CHZZK authorization URL for an admin session and binds the state to a nonce cookie", async () => {
    const app = Fastify();
    await registerChzzkAuthRoutes(app, {
      env: adminEnv,
      authClient: {
        buildAuthorizeUrl: ({ state }) => `https://chzzk.naver.com/account-interlock?state=${state}`,
        exchangeCodeForToken: async () => {
          throw new Error("should_not_exchange");
        }
      },
      stateRepository: createStateRepository(),
      now: () => fixedNow
    });

    const response = await app.inject({ method: "GET", url: "/v1/auth/chzzk/start", headers: { cookie: adminCookieHeader() } });
    await app.close();

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain("https://chzzk.naver.com/account-interlock?state=");

    const nonceCookie = readSetCookie(response).find((cookie) => cookie.startsWith("chzzk_oauth_nonce="));
    expect(nonceCookie).toBeDefined();
    expect(nonceCookie).toContain("HttpOnly");
    expect(nonceCookie).toContain("SameSite=Lax");
    expect(nonceCookie).toContain("Path=/v1/auth/chzzk");
    expect(nonceCookie).toContain("Max-Age=600");
    expect(nonceCookie).not.toContain("Secure");

    const stateParam = new URL(response.headers.location as string).searchParams.get("state")!;
    const verified = verifyChzzkOAuthState(adminEnv.CHZZK_AUTH_STATE_SECRET, stateParam, fixedNow);
    expect(verified.ok).toBe(true);
    const cookieNonce = nonceCookie!.split(";")[0].split("=")[1];
    expect(verified.ok && verified.nonce).toBe(cookieNonce);
  });

  it("accepts an admin bearer token on start and marks the nonce cookie Secure when forced", async () => {
    const app = Fastify();
    await registerChzzkAuthRoutes(app, {
      env: { ...adminEnv, ADMIN_CONSOLE_COOKIE_SECURE: true },
      authClient: {
        buildAuthorizeUrl: ({ state }) => `https://chzzk.naver.com/account-interlock?state=${state}`,
        exchangeCodeForToken: async () => {
          throw new Error("should_not_exchange");
        }
      },
      stateRepository: createStateRepository(),
      now: () => fixedNow
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/chzzk/start",
      headers: { authorization: "Bearer admin-token" }
    });
    await app.close();

    expect(response.statusCode).toBe(302);
    const nonceCookie = readSetCookie(response).find((cookie) => cookie.startsWith("chzzk_oauth_nonce="));
    expect(nonceCookie).toContain("Secure");
  });

  it("rejects start without admin authentication and does not redirect", async () => {
    const app = Fastify();
    await registerChzzkAuthRoutes(app, {
      env: adminEnv,
      authClient: {
        buildAuthorizeUrl: ({ state }) => `https://chzzk.naver.com/account-interlock?state=${state}`,
        exchangeCodeForToken: async () => {
          throw new Error("should_not_exchange");
        }
      },
      stateRepository: createStateRepository(),
      now: () => fixedNow
    });

    const anonymous = await app.inject({ method: "GET", url: "/v1/auth/chzzk/start" });
    const wrongToken = await app.inject({
      method: "GET",
      url: "/v1/auth/chzzk/start",
      headers: { authorization: "Bearer wrong" }
    });
    await app.close();

    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.headers.location).toBeUndefined();
    expect(readSetCookie(anonymous)).toEqual([]);
    expect(anonymous.json()).toEqual({ error: "missing_authorization" });
    expect(wrongToken.statusCode).toBe(401);
    expect(wrongToken.json()).toEqual({ error: "invalid_token" });
  });

  it("returns 404 on start when the admin console is disabled", async () => {
    const app = Fastify();
    await registerChzzkAuthRoutes(app, {
      env: routeEnv,
      authClient: {
        buildAuthorizeUrl: ({ state }) => `https://chzzk.naver.com/account-interlock?state=${state}`,
        exchangeCodeForToken: async () => {
          throw new Error("should_not_exchange");
        }
      },
      stateRepository: createStateRepository(),
      now: () => fixedNow
    });

    const response = await app.inject({ method: "GET", url: "/v1/auth/chzzk/start", headers: { cookie: adminCookieHeader() } });
    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.headers.location).toBeUndefined();
  });

  it("returns 503 on start when the admin token is not configured", async () => {
    const app = Fastify();
    await registerChzzkAuthRoutes(app, {
      env: { ...adminEnv, ADMIN_CONSOLE_TOKEN: undefined },
      authClient: {
        buildAuthorizeUrl: ({ state }) => `https://chzzk.naver.com/account-interlock?state=${state}`,
        exchangeCodeForToken: async () => {
          throw new Error("should_not_exchange");
        }
      },
      stateRepository: createStateRepository(),
      now: () => fixedNow
    });

    const response = await app.inject({ method: "GET", url: "/v1/auth/chzzk/start" });
    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "admin_console_token_missing" });
  });

  it("adds configured OAuth scopes to the default authorization redirect", async () => {
    const app = Fastify();
    await registerChzzkAuthRoutes(app, {
      env: { ...adminEnv, CHZZK_OAUTH_SCOPES: "user:read channel:read live:read" },
      stateRepository: createStateRepository(),
      now: () => fixedNow
    });

    const response = await app.inject({ method: "GET", url: "/v1/auth/chzzk/start", headers: { cookie: adminCookieHeader() } });
    await app.close();

    const location = new URL(response.headers.location as string);
    expect(response.statusCode).toBe(302);
    expect(location.searchParams.get("scope")).toBe("user:read channel:read live:read");
  });

  it("rejects callback requests with missing code or invalid state", async () => {
    const { app, exchange } = await buildCallbackApp();

    const missingCode = await app.inject({ method: "GET", url: "/v1/auth/chzzk/callback?state=invalid" });
    const invalidState = await app.inject({ method: "GET", url: "/v1/auth/chzzk/callback?code=auth-code&state=invalid" });
    await app.close();

    expect(missingCode.statusCode).toBe(400);
    expect(missingCode.json()).toEqual({ error: "chzzk_oauth_code_missing" });
    expect(invalidState.statusCode).toBe(400);
    expect(invalidState.json()).toEqual({ error: "invalid_oauth_state" });
    expect(exchange).not.toHaveBeenCalled();
  });

  it("rejects a callback with a valid state but no nonce cookie", async () => {
    const { app, exchange } = await buildCallbackApp();
    const { state } = createChzzkOAuthState(routeEnv.CHZZK_AUTH_STATE_SECRET, fixedNow);

    const response = await app.inject({ method: "GET", url: `/v1/auth/chzzk/callback?code=auth-code&state=${state}` });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_oauth_state" });
    expect(exchange).not.toHaveBeenCalled();
  });

  it("rejects a callback whose nonce cookie does not match the state nonce", async () => {
    const { app, exchange } = await buildCallbackApp();
    const { state } = createChzzkOAuthState(routeEnv.CHZZK_AUTH_STATE_SECRET, fixedNow);

    const response = await app.inject({
      method: "GET",
      url: `/v1/auth/chzzk/callback?code=auth-code&state=${state}`,
      headers: { cookie: "chzzk_oauth_nonce=some-other-nonce" }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_oauth_state" });
    expect(exchange).not.toHaveBeenCalled();
    const cleared = readSetCookie(response).find((cookie) => cookie.startsWith("chzzk_oauth_nonce="));
    expect(cleared).toContain("Max-Age=0");
  });

  it("exchanges valid callbacks, stores token metadata, and clears the nonce cookie", async () => {
    const stored: Array<{ source: string; key: string; value: unknown; status: string }> = [];
    const { app, exchange } = await buildCallbackApp({ stored });
    const { state, nonce } = createChzzkOAuthState(routeEnv.CHZZK_AUTH_STATE_SECRET, fixedNow);

    const response = await app.inject({
      method: "GET",
      url: `/v1/auth/chzzk/callback?code=auth-code&state=${state}`,
      headers: { cookie: `other=1; chzzk_oauth_nonce=${nonce}` }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ connected: true, source: "chzzk" });
    expect(exchange).toHaveBeenCalledTimes(1);
    const cleared = readSetCookie(response).find((cookie) => cookie.startsWith("chzzk_oauth_nonce="));
    expect(cleared).toContain("chzzk_oauth_nonce=;");
    expect(cleared).toContain("Max-Age=0");
    expect(cleared).toContain("Path=/v1/auth/chzzk");
    expect(cleared).toContain("HttpOnly");
    expect(cleared).toContain("SameSite=Lax");
    expect(stored).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "chzzk", key: "oauth.accessToken", status: "enabled" }),
        expect.objectContaining({ source: "chzzk", key: "oauth.refreshToken", status: "enabled" }),
        expect.objectContaining({ source: "chzzk", key: "oauth.expiresAt", status: "enabled" }),
        expect.objectContaining({ source: "chzzk", key: "oauth.scope", status: "enabled" }),
        expect.objectContaining({ source: "chzzk", key: "oauth.tokenType", status: "enabled" }),
        expect.objectContaining({ source: "chzzk", key: "oauth.lastRefreshedAt", status: "enabled" }),
        expect.objectContaining({ source: "chzzk", key: "health", status: "verify_required" })
      ])
    );
  });
});
