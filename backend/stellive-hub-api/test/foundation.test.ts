import { describe, expect, it, vi } from "vitest";
import { loadEnv } from "../src/config/env.js";
import { disconnectPrismaClient, getPrismaClient } from "../src/storage/prisma.js";

const baseEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub"
};

describe("foundation configuration", () => {
  it("parses boolean feature flags from environment strings", () => {
    const env = loadEnv({
      ...baseEnv,
      YOUTUBE_WEBSUB_ENABLED: "true",
      NAVER_CAFE_SEARCH_ENABLED: "false"
    });

    expect(env.YOUTUBE_WEBSUB_ENABLED).toBe(true);
    expect(env.NAVER_CAFE_SEARCH_ENABLED).toBe(false);
  });

  it("validates bootstrap cache TTL configuration", () => {
    const defaults = loadEnv(baseEnv);
    expect(defaults.BOOTSTRAP_CATALOG_CACHE_TTL_SECONDS).toBe(30);
    expect(defaults.BOOTSTRAP_LIVE_STATUS_CACHE_TTL_SECONDS).toBe(10);
    expect(defaults.BOOTSTRAP_HUB_EVENTS_SUMMARY_CACHE_TTL_SECONDS).toBe(30);

    const configured = loadEnv({
      ...baseEnv,
      BOOTSTRAP_CATALOG_CACHE_TTL_SECONDS: "20",
      BOOTSTRAP_LIVE_STATUS_CACHE_TTL_SECONDS: "5",
      BOOTSTRAP_HUB_EVENTS_SUMMARY_CACHE_TTL_SECONDS: "25",
    });
    expect(configured.BOOTSTRAP_CATALOG_CACHE_TTL_SECONDS).toBe(20);
    expect(configured.BOOTSTRAP_LIVE_STATUS_CACHE_TTL_SECONDS).toBe(5);
    expect(configured.BOOTSTRAP_HUB_EVENTS_SUMMARY_CACHE_TTL_SECONDS).toBe(25);

    expect(() => loadEnv({
      ...baseEnv,
      BOOTSTRAP_LIVE_STATUS_CACHE_TTL_SECONDS: "11",
    })).toThrow(/BOOTSTRAP_LIVE_STATUS_CACHE_TTL_SECONDS/);
  });

  it("validates channel image cache timing configuration", () => {
    const defaults = loadEnv(baseEnv);
    expect(defaults.CHANNEL_IMAGE_CACHE_TTL_SECONDS).toBe(604800);
    expect(defaults.CHANNEL_IMAGE_REFRESH_WAIT_MS).toBe(1500);

    const configured = loadEnv({
      ...baseEnv,
      CHANNEL_IMAGE_CACHE_TTL_SECONDS: "3600",
      CHANNEL_IMAGE_REFRESH_WAIT_MS: "250",
    });
    expect(configured.CHANNEL_IMAGE_CACHE_TTL_SECONDS).toBe(3600);
    expect(configured.CHANNEL_IMAGE_REFRESH_WAIT_MS).toBe(250);
    expect(() => loadEnv({ ...baseEnv, CHANNEL_IMAGE_CACHE_TTL_SECONDS: "0" }))
      .toThrow(/CHANNEL_IMAGE_CACHE_TTL_SECONDS/);
    expect(() => loadEnv({ ...baseEnv, CHANNEL_IMAGE_REFRESH_WAIT_MS: "0" }))
      .toThrow(/CHANNEL_IMAGE_REFRESH_WAIT_MS/);
  });

  it("validates music channel discovery peak schedule configuration", () => {
    const defaults = loadEnv(baseEnv);
    expect(defaults.MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES).toBe(60);
    expect(defaults.MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES).toBe(5);
    expect(defaults.MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR).toBe(12);
    expect(defaults.MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR).toBe(24);
    expect(defaults.MUSIC_CHANNEL_DISCOVERY_TIME_ZONE).toBe("Asia/Seoul");

    const configured = loadEnv({
      ...baseEnv,
      MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES: "30",
      MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES: "3",
      MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR: "10",
      MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR: "22",
      MUSIC_CHANNEL_DISCOVERY_TIME_ZONE: "Asia/Tokyo",
    });
    expect(configured.MUSIC_CHANNEL_DISCOVERY_INTERVAL_MINUTES).toBe(30);
    expect(configured.MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES).toBe(3);
    expect(configured.MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR).toBe(10);
    expect(configured.MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR).toBe(22);
    expect(configured.MUSIC_CHANNEL_DISCOVERY_TIME_ZONE).toBe("Asia/Tokyo");

    expect(() => loadEnv({
      ...baseEnv,
      MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES: "0",
    })).toThrow(/MUSIC_CHANNEL_DISCOVERY_PEAK_INTERVAL_MINUTES/);
    expect(() => loadEnv({
      ...baseEnv,
      MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR: "24",
    })).toThrow(/MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR/);
    expect(() => loadEnv({
      ...baseEnv,
      MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR: "25",
    })).toThrow(/MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR/);
    expect(() => loadEnv({
      ...baseEnv,
      MUSIC_CHANNEL_DISCOVERY_PEAK_START_HOUR: "18",
      MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR: "12",
    })).toThrow(/MUSIC_CHANNEL_DISCOVERY_PEAK_END_HOUR/);
    expect(() => loadEnv({
      ...baseEnv,
      MUSIC_CHANNEL_DISCOVERY_TIME_ZONE: "Mars/Olympus_Mons",
    })).toThrow(/MUSIC_CHANNEL_DISCOVERY_TIME_ZONE/);
  });

  it("bounds admin observability configuration", () => {
    const defaults = loadEnv(baseEnv);
    expect(defaults.ADMIN_OVERVIEW_CACHE_TTL_SECONDS).toBe(15);
    expect(defaults.EXTERNAL_API_LOG_RETENTION_DAYS).toBe(31);
    expect(defaults.CHZZK_LIVE_LIST_MAX_PAGES).toBe(5);

    expect(loadEnv({ ...baseEnv, ADMIN_OVERVIEW_CACHE_TTL_SECONDS: "-1" }).ADMIN_OVERVIEW_CACHE_TTL_SECONDS).toBe(0);
    expect(loadEnv({ ...baseEnv, ADMIN_OVERVIEW_CACHE_TTL_SECONDS: "99" }).ADMIN_OVERVIEW_CACHE_TTL_SECONDS).toBe(60);
    expect(loadEnv({ ...baseEnv, EXTERNAL_API_LOG_RETENTION_DAYS: "1" }).EXTERNAL_API_LOG_RETENTION_DAYS).toBe(14);
    expect(loadEnv({ ...baseEnv, EXTERNAL_API_LOG_RETENTION_DAYS: "999" }).EXTERNAL_API_LOG_RETENTION_DAYS).toBe(365);
    expect(loadEnv({ ...baseEnv, CHZZK_LIVE_LIST_MAX_PAGES: "0" }).CHZZK_LIVE_LIST_MAX_PAGES).toBe(5);
    expect(loadEnv({ ...baseEnv, CHZZK_LIVE_LIST_MAX_PAGES: "invalid" }).CHZZK_LIVE_LIST_MAX_PAGES).toBe(5);
  });

  it("parses CHZZK OAuth configuration without enabling placeholders", () => {
    const configured = loadEnv({
      ...baseEnv,
      CHZZK_CLIENT_ID: "client-id",
      CHZZK_CLIENT_SECRET: "client-secret",
      CHZZK_REDIRECT_URI: "http://localhost:4000/v1/auth/chzzk/callback",
      CHZZK_AUTH_STATE_SECRET: "local-state-secret",
      CHZZK_OAUTH_ENABLED: "true",
      CHZZK_TOKEN_REFRESH_SKEW_SECONDS: "300",
      CHZZK_LIVE_POLLING_ENABLED: "false"
    });

    expect(configured.CHZZK_CLIENT_ID).toBe("client-id");
    expect(configured.CHZZK_CLIENT_SECRET).toBe("client-secret");
    expect(configured.CHZZK_REDIRECT_URI).toBe("http://localhost:4000/v1/auth/chzzk/callback");
    expect(configured.CHZZK_AUTH_STATE_SECRET).toBe("local-state-secret");
    expect(configured.CHZZK_OAUTH_ENABLED).toBe(true);
    expect(configured.CHZZK_OAUTH_CONFIGURED).toBe(true);
    expect(configured.CHZZK_TOKEN_REFRESH_SKEW_SECONDS).toBe(300);
    expect(configured.CHZZK_LIVE_POLLING_ENABLED).toBe(false);

    const placeholder = loadEnv({
      ...baseEnv,
      CHZZK_CLIENT_ID: "verify_required",
      CHZZK_CLIENT_SECRET: "verify_required",
      CHZZK_REDIRECT_URI: "http://localhost:4000/v1/auth/chzzk/callback",
      CHZZK_AUTH_STATE_SECRET: "replace_with_local_auth_state_secret",
      CHZZK_OAUTH_ENABLED: "true"
    });

    expect(placeholder.CHZZK_OAUTH_ENABLED).toBe(true);
    expect(placeholder.CHZZK_OAUTH_CONFIGURED).toBe(false);
  });
});

describe("Prisma storage", () => {
  it("returns a singleton Prisma client instance", () => {
    const first = getPrismaClient();
    const second = getPrismaClient();

    expect(second).toBe(first);
  });

  it("disconnects an initialized client at most once", async () => {
    const client = getPrismaClient();
    const disconnect = vi.spyOn(client, "$disconnect").mockResolvedValue();

    await disconnectPrismaClient();
    await disconnectPrismaClient();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
