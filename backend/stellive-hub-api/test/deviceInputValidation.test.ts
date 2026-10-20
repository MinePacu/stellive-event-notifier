import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import DeviceRepository from "../src/repositories/deviceRepository.js";
import PreferenceRepository from "../src/repositories/preferenceRepository.js";

const routeEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
};

const validUuidDeviceId = "device_123e4567-e89b-42d3-a456-426614174000";

function validRule(overrides: Record<string, unknown> = {}) {
  return {
    deviceId: "device-1",
    scope: "global",
    enabled: true,
    explicitOverride: true,
    tapAction: "open_app",
    deliveryMode: "standard",
    updatedAt: "2026-08-13T00:00:00.000Z",
    ...overrides,
  };
}

async function buildWithFakes() {
  const register = vi.fn(async (_input: Record<string, unknown>) => ({ deviceId: "device-fake", registered: true as const }));
  const updateToken = vi.fn(async () => ({ updated: true as const, tokenStatus: "active" as const }));
  const replaceForDevice = vi.fn(async () => ({ preferences: [], revision: 1, updatedAt: "2026-08-13T00:00:00.000Z" }));
  const getSnapshotForDevice = vi.fn(async () => ({ preferences: [], revision: 0, updatedAt: "2026-08-13T00:00:00.000Z" }));
  const getBootstrap = vi.fn(async () => ({}) as never);
  const app = await buildApp({
    env: routeEnv,
    useProcessEnv: false,
    appRoutes: {
      dependencies: {
        devices: { register, updateToken },
        preferences: { replaceForDevice, getSnapshotForDevice },
        bootstrap: { getBootstrap },
      },
    },
  });
  return { app, register, updateToken, replaceForDevice, getSnapshotForDevice, getBootstrap };
}

describe("PUT /v1/preferences input validation", () => {
  it("rejects an object deviceId (Prisma operator injection)", async () => {
    const { app, replaceForDevice } = await buildWithFakes();
    const response = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      payload: { deviceId: { not: "x" }, expectedRevision: 1, preferences: [] },
    });
    await app.close();
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "device_not_registered" });
    expect(replaceForDevice).not.toHaveBeenCalled();
  });

  it("rejects an array deviceId and malformed string deviceIds", async () => {
    const { app, replaceForDevice } = await buildWithFakes();
    for (const deviceId of [["a", "b"], "a b", "a".repeat(129), ""]) {
      const response = await app.inject({
        method: "PUT",
        url: "/v1/preferences",
        payload: { deviceId, expectedRevision: 1, preferences: [] },
      });
      expect(response.statusCode).toBe(400);
    }
    await app.close();
    expect(replaceForDevice).not.toHaveBeenCalled();
  });

  it("rejects preferences over the cap but accepts a plausible list", async () => {
    const { app, replaceForDevice } = await buildWithFakes();
    const tooMany = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      payload: { deviceId: "device-1", expectedRevision: 0, preferences: Array.from({ length: 2001 }, () => validRule()) },
    });
    expect(tooMany.statusCode).toBe(400);
    expect(tooMany.json()).toEqual({ error: "preferences_invalid" });
    expect(replaceForDevice).not.toHaveBeenCalled();

    const ok = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      payload: { deviceId: "device-1", expectedRevision: 0, preferences: Array.from({ length: 500 }, () => validRule()) },
    });
    await app.close();
    expect(ok.statusCode).toBe(200);
    expect(replaceForDevice).toHaveBeenCalledTimes(1);
  });
});

describe("GET /v1/preferences input validation", () => {
  it("rejects repeated deviceId query values", async () => {
    const { app, getSnapshotForDevice } = await buildWithFakes();
    const response = await app.inject({ method: "GET", url: "/v1/preferences?deviceId=a&deviceId=b" });
    const nested = await app.inject({ method: "GET", url: "/v1/preferences?deviceId[not]=x" });
    await app.close();
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "device_not_registered" });
    expect(nested.statusCode).toBe(400);
    expect(getSnapshotForDevice).not.toHaveBeenCalled();
  });

  it("accepts a well-formed deviceId", async () => {
    const { app, getSnapshotForDevice } = await buildWithFakes();
    const response = await app.inject({ method: "GET", url: `/v1/preferences?deviceId=${validUuidDeviceId}` });
    await app.close();
    expect(response.statusCode).toBe(200);
    expect(getSnapshotForDevice).toHaveBeenCalledWith(validUuidDeviceId);
  });
});

describe("PUT /v1/devices/token input validation", () => {
  const base = { deviceId: "device-1", platform: "android", provider: "fcm", token: "runtime-token" };

  it("rejects object token, object deviceId, and oversized token", async () => {
    const { app, updateToken } = await buildWithFakes();
    const payloads = [
      { ...base, token: { not: "x" } },
      { ...base, deviceId: { not: "x" } },
      { ...base, token: "t".repeat(5000) },
      { ...base, deviceId: "bad id!" },
    ];
    for (const payload of payloads) {
      const response = await app.inject({ method: "PUT", url: "/v1/devices/token", payload });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: "device_token_invalid" });
    }
    await app.close();
    expect(updateToken).not.toHaveBeenCalled();
  });

  it("drops oversized or non-string metadata instead of rejecting", async () => {
    const { app, updateToken } = await buildWithFakes();
    const response = await app.inject({
      method: "PUT",
      url: "/v1/devices/token",
      payload: { ...base, locale: "l".repeat(500), timezone: { a: 1 }, appVersion: "1.2.3" },
    });
    await app.close();
    expect(response.statusCode).toBe(200);
    expect(updateToken).toHaveBeenCalledWith(
      expect.objectContaining({ locale: undefined, timezone: undefined, appVersion: "1.2.3" }),
    );
  });
});

describe("POST /v1/devices/register input validation", () => {
  async function register(payload: Record<string, unknown>) {
    const ctx = await buildWithFakes();
    const response = await ctx.app.inject({ method: "POST", url: "/v1/devices/register", payload });
    await ctx.app.close();
    expect(response.statusCode).toBe(200);
    return ctx.register.mock.calls[0]![0];
  }

  it("discards guessable timestamp deviceIds so a fresh id is minted", async () => {
    expect((await register({ platform: "android", deviceId: "device_1791410816900" })).deviceId).toBeUndefined();
  });

  it("passes through a repository-format UUID deviceId", async () => {
    expect((await register({ platform: "android", deviceId: validUuidDeviceId })).deviceId).toBe(validUuidDeviceId);
  });

  it("discards non-string deviceIds", async () => {
    expect((await register({ platform: "android", deviceId: { not: "x" } })).deviceId).toBeUndefined();
  });

  it("drops overlong or non-string metadata", async () => {
    const input = await register({
      platform: "ios",
      locale: "l".repeat(500),
      timezone: ["Asia/Seoul"],
      appVersion: "1.0.0",
    });
    expect(input).toMatchObject({ locale: undefined, timezone: undefined, appVersion: "1.0.0" });
  });
});

describe("GET /v1/bootstrap query validation", () => {
  it("passes undefined for array/invalid query values instead of failing", async () => {
    const { app, getBootstrap } = await buildWithFakes();
    const response = await app.inject({
      method: "GET",
      url: "/v1/bootstrap?appVersion=a&appVersion=b&deviceId[not]=x&locale=" + "l".repeat(100) + "&timezone=Asia/Seoul",
    });
    await app.close();
    expect(response.statusCode).toBeLessThan(500);
    expect(getBootstrap).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: undefined,
        appVersion: undefined,
        locale: undefined,
        timezone: "Asia/Seoul",
      }),
    );
  });

  it("passes through valid values", async () => {
    const { app, getBootstrap } = await buildWithFakes();
    await app.inject({ method: "GET", url: "/v1/bootstrap?deviceId=device-1&appVersion=1.0&locale=ko-KR" });
    await app.close();
    expect(getBootstrap).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: "device-1", appVersion: "1.0", locale: "ko-KR" }),
    );
  });
});

describe("prisma-mode repository wiring", () => {
  const prismaEnv = {
    ...routeEnv,
    NODE_ENV: "production" as const,
    HUB_EVENTS_STORAGE_MODE: "prisma" as const,
    DATABASE_URL: "postgresql://x:x@127.0.0.1:1/x",
  };

  it("does not serve PUT /v1/devices/token from the in-memory fallback", async () => {
    const app = await buildApp({ env: prismaEnv, useProcessEnv: false });
    const response = await app.inject({
      method: "PUT",
      url: "/v1/devices/token",
      payload: { deviceId: "device-1", platform: "android", provider: "fcm", token: "runtime-token" },
    });
    await app.close();
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "internal_error" });
  });

  it("does not serve PUT /v1/preferences from the in-memory fallback", async () => {
    const app = await buildApp({ env: prismaEnv, useProcessEnv: false });
    const response = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      payload: { deviceId: "device-1", expectedRevision: 0, preferences: [] },
    });
    await app.close();
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "internal_error" });
  });
});

describe("repository defense in depth", () => {
  it("DeviceRepository.register rejects a non-string deviceId", async () => {
    const upsert = vi.fn();
    const repository = new DeviceRepository({ device: { upsert } } as never);
    await expect(repository.register({ platform: "android", deviceId: { not: "x" } as never })).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("DeviceRepository.updateToken rejects non-string deviceId or token", async () => {
    const transaction = vi.fn();
    const repository = new DeviceRepository({ device: {}, $transaction: transaction } as never);
    const base = { platform: "android" as const, provider: "fcm" as const };
    await expect(repository.updateToken({ ...base, deviceId: { not: "x" } as never, token: "t" })).rejects.toThrow();
    await expect(repository.updateToken({ ...base, deviceId: "d", token: { not: "x" } as never })).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("PreferenceRepository.replaceForDevice rejects a non-string deviceId", async () => {
    const transaction = vi.fn();
    const repository = new PreferenceRepository({ $transaction: transaction } as never);
    await expect(
      repository.replaceForDevice({ deviceId: { not: "x" } as never, preferences: [], expectedRevision: 0 }),
    ).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
});
