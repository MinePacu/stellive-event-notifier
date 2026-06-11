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
});

describe("Prisma storage", () => {
  it("returns a singleton Prisma client instance", () => {
    const first = getPrismaClient();
    const second = getPrismaClient();

    expect(second).toBe(first);
  });
});
