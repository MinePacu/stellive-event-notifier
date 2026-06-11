import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";
import { getPrismaClient } from "../src/storage/prisma.js";

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
});
