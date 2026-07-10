import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { createChzzkOAuthState, verifyChzzkOAuthState } from "../src/adapters/chzzk/chzzkOAuthState.js";
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
  X_API_COST_POLICY: "no_paid_api" as const,
  X_FREE_API_ENABLED: false,
  X_FREE_STREAM_ENABLED: false,
  X_FREE_POLLING_ENABLED: false,
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
  ADMIN_OVERVIEW_CACHE_TTL_SECONDS: 15,
  EXTERNAL_API_LOG_RETENTION_DAYS: 31,
  ADMIN_CONSOLE_COOKIE_SECURE: false
};

describe("CHZZK OAuth state signing", () => {
  const secret = "local-state-secret";
  const now = new Date("2026-06-11T00:00:00.000Z");

  it("creates and verifies a URL-safe signed state", () => {
    const state = createChzzkOAuthState(secret, now);

    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifyChzzkOAuthState(secret, state, now)).toEqual({ ok: true });
  });

  it("rejects a tampered state", () => {
    const state = createChzzkOAuthState(secret, now);
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [payload] = decoded.split(".");
    const tampered = Buffer.from(`${payload}.invalid-signature`, "utf8").toString("base64url");

    expect(verifyChzzkOAuthState(secret, tampered, now)).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("rejects an expired state", () => {
    const state = createChzzkOAuthState(secret, now);
    const tooLate = new Date(now.getTime() + 10 * 60 * 1000 + 1);

    expect(verifyChzzkOAuthState(secret, state, tooLate)).toEqual({ ok: false, reason: "expired" });
  });
});

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
      stateRepository: {
        upsertState: async () => undefined,
        upsertAdapterHealth: async () => undefined
      },
      now: () => new Date("2026-06-11T00:00:00.000Z")
    });

    const response = await app.inject({ method: "GET", url: "/v1/auth/chzzk/start" });
    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "chzzk_oauth_not_configured" });
  });

  it("redirects to the CHZZK authorization URL when configured", async () => {
    const app = Fastify();
    await registerChzzkAuthRoutes(app, {
      env: routeEnv,
      authClient: {
        buildAuthorizeUrl: ({ state }) => `https://chzzk.naver.com/account-interlock?state=${state}`,
        exchangeCodeForToken: async () => {
          throw new Error("should_not_exchange");
        }
      },
      stateRepository: {
        upsertState: async () => undefined,
        upsertAdapterHealth: async () => undefined
      },
      now: () => new Date("2026-06-11T00:00:00.000Z")
    });

    const response = await app.inject({ method: "GET", url: "/v1/auth/chzzk/start" });
    await app.close();

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain("https://chzzk.naver.com/account-interlock?state=");
  });

  it("adds configured OAuth scopes to the default authorization redirect", async () => {
    const app = Fastify();
    await registerChzzkAuthRoutes(app, {
      env: { ...routeEnv, CHZZK_OAUTH_SCOPES: "user:read channel:read live:read" },
      stateRepository: {
        upsertState: async () => undefined,
        upsertAdapterHealth: async () => undefined
      },
      now: () => new Date("2026-06-11T00:00:00.000Z")
    });

    const response = await app.inject({ method: "GET", url: "/v1/auth/chzzk/start" });
    await app.close();

    const location = new URL(response.headers.location as string);
    expect(response.statusCode).toBe(302);
    expect(location.searchParams.get("scope")).toBe("user:read channel:read live:read");
  });

  it("rejects callback requests with missing code or invalid state", async () => {
    const app = Fastify();
    await registerChzzkAuthRoutes(app, {
      env: routeEnv,
      authClient: {
        buildAuthorizeUrl: () => "https://chzzk.naver.com/account-interlock",
        exchangeCodeForToken: async () => {
          throw new Error("should_not_exchange");
        }
      },
      stateRepository: {
        upsertState: async () => undefined,
        upsertAdapterHealth: async () => undefined
      },
      now: () => new Date("2026-06-11T00:00:00.000Z")
    });

    const missingCode = await app.inject({ method: "GET", url: "/v1/auth/chzzk/callback?state=invalid" });
    const invalidState = await app.inject({ method: "GET", url: "/v1/auth/chzzk/callback?code=auth-code&state=invalid" });
    await app.close();

    expect(missingCode.statusCode).toBe(400);
    expect(missingCode.json()).toEqual({ error: "chzzk_oauth_code_missing" });
    expect(invalidState.statusCode).toBe(400);
    expect(invalidState.json()).toEqual({ error: "invalid_oauth_state" });
  });

  it("exchanges valid callbacks and stores token metadata", async () => {
    const app = Fastify();
    const stored: Array<{ source: string; key: string; value: unknown; status: string }> = [];
    const state = createChzzkOAuthState(routeEnv.CHZZK_AUTH_STATE_SECRET, new Date("2026-06-11T00:00:00.000Z"));

    await registerChzzkAuthRoutes(app, {
      env: routeEnv,
      authClient: {
        buildAuthorizeUrl: () => "https://chzzk.naver.com/account-interlock",
        exchangeCodeForToken: async () => ({
          accessToken: "access-token",
          refreshToken: "refresh-token",
          tokenType: "Bearer",
          expiresIn: 86400,
          scope: "channel"
        })
      },
      stateRepository: {
        upsertState: async (source, key, value, status) => {
          stored.push({ source, key, value, status });
        },
        upsertAdapterHealth: async (source, health) => {
          stored.push({ source, key: "health", value: health, status: health.status });
        }
      },
      now: () => new Date("2026-06-11T00:00:00.000Z")
    });

    const response = await app.inject({
      method: "GET",
      url: `/v1/auth/chzzk/callback?code=auth-code&state=${state}`
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ connected: true, source: "chzzk" });
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
