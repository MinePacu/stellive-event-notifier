import { describe, expect, it, vi } from "vitest";
import { loadEnv } from "../src/config/env.js";
import { disconnectPrismaClient, getPrismaClient } from "../src/storage/prisma.js";

const baseEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub"
};

describe("foundation configuration", () => {
  it("defaults X integration to no-paid-API disabled mode", () => {
    const env = loadEnv(baseEnv);

    expect(env.X_API_COST_POLICY).toBe("no_paid_api");
    expect(env.X_FREE_API_ENABLED).toBe(false);
    expect(env.X_FREE_STREAM_ENABLED).toBe(false);
    expect(env.X_FREE_POLLING_ENABLED).toBe(false);
  });

  it("rejects paid X API cost policies", () => {
    expect(() => loadEnv({ ...baseEnv, X_API_COST_POLICY: "paid_api" })).toThrow(/X_API_COST_POLICY/);
  });

  it("parses boolean feature flags from environment strings", () => {
    const env = loadEnv({
      ...baseEnv,
      YOUTUBE_WEBSUB_ENABLED: "true",
      X_FREE_API_ENABLED: "true",
      X_FREE_STREAM_ENABLED: "false"
    });

    expect(env.YOUTUBE_WEBSUB_ENABLED).toBe(true);
    expect(env.X_FREE_API_ENABLED).toBe(true);
    expect(env.X_FREE_STREAM_ENABLED).toBe(false);
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

  it("bounds admin observability configuration", () => {
    const defaults = loadEnv(baseEnv);
    expect(defaults.ADMIN_OVERVIEW_CACHE_TTL_SECONDS).toBe(15);

    expect(loadEnv({ ...baseEnv, ADMIN_OVERVIEW_CACHE_TTL_SECONDS: "-1" }).ADMIN_OVERVIEW_CACHE_TTL_SECONDS).toBe(0);
    expect(loadEnv({ ...baseEnv, ADMIN_OVERVIEW_CACHE_TTL_SECONDS: "99" }).ADMIN_OVERVIEW_CACHE_TTL_SECONDS).toBe(60);
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
