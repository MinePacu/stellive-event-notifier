import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { RequestRateLimiter } from "../src/mobile/requestRateLimiter.js";

const routeEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
};

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

async function createApp(options: { env?: Record<string, string>; getDevice?: (deviceId: string) => Promise<unknown>; injectLimiters?: boolean } = {}) {
  const clock = { value: Date.UTC(2026, 0, 1) };
  const now = () => clock.value;
  const register = vi.fn(async () => ({ deviceId: "device-fake", registered: true as const }));
  const updateToken = vi.fn(async () => ({ updated: true as const, tokenStatus: "active" as const }));
  const replaceForDevice = vi.fn(async () => ({ preferences: [], revision: 1, updatedAt: "2026-08-13T00:00:00.000Z" }));
  const getSnapshotForDevice = vi.fn(async () => ({ preferences: [], revision: 0, updatedAt: "2026-08-13T00:00:00.000Z" }));
  const getBootstrap = vi.fn(async () => ({}) as never);
  const injectLimiters = options.injectLimiters ?? true;
  const app = await buildApp({
    env: { ...routeEnv, ...options.env },
    useProcessEnv: false,
    ...(injectLimiters
      ? {
          mobileRateLimiters: {
            write: new RequestRateLimiter({ maxRequests: 60, now }),
            read: new RequestRateLimiter({ maxRequests: 240, now }),
          },
        }
      : {}),
    appRoutes: {
      dependencies: {
        devices: { register, updateToken, ...(options.getDevice ? { getDevice: options.getDevice } : {}) } as never,
        preferences: { replaceForDevice, getSnapshotForDevice },
        bootstrap: { getBootstrap },
      },
    },
  });
  return { app, clock, register, updateToken, replaceForDevice, getSnapshotForDevice, getBootstrap };
}

type TestApp = Awaited<ReturnType<typeof createApp>>["app"];

function writeRequest(app: TestApp, index: number, remoteAddress?: string) {
  const kind = index % 3;
  if (kind === 0) {
    return app.inject({ method: "POST", url: "/v1/devices/register", payload: { platform: "android" }, remoteAddress });
  }
  if (kind === 1) {
    return app.inject({
      method: "PUT",
      url: "/v1/devices/token",
      payload: { deviceId: "device-1", platform: "android", provider: "fcm", token: "runtime-token" },
      remoteAddress,
    });
  }
  return app.inject({
    method: "PUT",
    url: "/v1/preferences",
    payload: { deviceId: "device-1", expectedRevision: 0, preferences: [] },
    remoteAddress,
  });
}

function readRequest(app: TestApp, index: number, remoteAddress?: string) {
  return index % 2 === 0
    ? app.inject({ method: "GET", url: "/v1/preferences?deviceId=device-1", remoteAddress })
    : app.inject({ method: "GET", url: "/v1/bootstrap?deviceId=device-1", remoteAddress });
}

describe("device write rate limit", () => {
  it("allows 60 mixed writes per IP, then 429s without touching repositories", async () => {
    const { app, register, updateToken, replaceForDevice } = await createApp();
    for (let i = 0; i < 60; i += 1) {
      const response = await writeRequest(app, i);
      expect(response.statusCode).toBe(200);
    }
    const calls = () => register.mock.calls.length + updateToken.mock.calls.length + replaceForDevice.mock.calls.length;
    expect(calls()).toBe(60);

    for (let i = 60; i < 63; i += 1) {
      const limited = await writeRequest(app, i);
      expect(limited.statusCode).toBe(429);
      expect(limited.json()).toEqual({ error: "rate_limited" });
      expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    }
    expect(calls()).toBe(60);
    await app.close();
  });

  it("does not affect another IP and recovers after the window", async () => {
    const { app, clock, register } = await createApp();
    for (let i = 0; i < 61; i += 1) await writeRequest(app, 0, "10.0.0.1");
    expect((await writeRequest(app, 0, "10.0.0.1")).statusCode).toBe(429);
    expect((await writeRequest(app, 0, "10.0.0.2")).statusCode).toBe(200);

    clock.value += 60_000;
    expect((await writeRequest(app, 0, "10.0.0.1")).statusCode).toBe(200);
    await app.close();
    expect(register).toHaveBeenCalledTimes(62);
  });

  it("rate limits before validation", async () => {
    const { app } = await createApp();
    for (let i = 0; i < 60; i += 1) await app.inject({ method: "PUT", url: "/v1/preferences", payload: { deviceId: "bad id" } });
    const limited = await app.inject({ method: "PUT", url: "/v1/preferences", payload: { deviceId: "bad id" } });
    await app.close();
    expect(limited.statusCode).toBe(429);
  });
});

describe("device read rate limit", () => {
  it("allows 240 mixed reads per IP, then 429 without touching repositories", async () => {
    const { app, getSnapshotForDevice, getBootstrap } = await createApp();
    for (let i = 0; i < 240; i += 1) {
      const response = await readRequest(app, i);
      expect(response.statusCode).toBe(200);
    }
    const calls = () => getSnapshotForDevice.mock.calls.length + getBootstrap.mock.calls.length;
    expect(calls()).toBe(240);

    const limited = await readRequest(app, 240);
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual({ error: "rate_limited" });
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect(calls()).toBe(240);
    expect((await readRequest(app, 241, "10.0.0.9")).statusCode).toBe(200);
    await app.close();
  });

  it("keeps read and write budgets independent", async () => {
    const { app } = await createApp();
    for (let i = 0; i < 60; i += 1) await writeRequest(app, i);
    expect((await writeRequest(app, 60)).statusCode).toBe(429);
    expect((await readRequest(app, 0)).statusCode).toBe(200);

    for (let i = 0; i < 239; i += 1) await readRequest(app, i);
    expect((await readRequest(app, 0)).statusCode).toBe(429);
    await app.close();
  });
});

describe("rate limit env configuration", () => {
  it("defaults to 60 writes and 240 reads per minute", () => {
    const env = loadEnv(routeEnv);
    expect(env.DEVICE_WRITE_RATE_LIMIT_PER_MINUTE).toBe(60);
    expect(env.DEVICE_READ_RATE_LIMIT_PER_MINUTE).toBe(240);
  });

  it("parses overrides, allows 0, clamps out-of-range values and falls back on garbage", () => {
    expect(loadEnv({ ...routeEnv, DEVICE_WRITE_RATE_LIMIT_PER_MINUTE: "5", DEVICE_READ_RATE_LIMIT_PER_MINUTE: "0" })).toMatchObject({
      DEVICE_WRITE_RATE_LIMIT_PER_MINUTE: 5,
      DEVICE_READ_RATE_LIMIT_PER_MINUTE: 0,
    });
    expect(loadEnv({ ...routeEnv, DEVICE_WRITE_RATE_LIMIT_PER_MINUTE: "-3" }).DEVICE_WRITE_RATE_LIMIT_PER_MINUTE).toBe(0);
    expect(loadEnv({ ...routeEnv, DEVICE_WRITE_RATE_LIMIT_PER_MINUTE: "99999999" }).DEVICE_WRITE_RATE_LIMIT_PER_MINUTE).toBe(100_000);
    expect(loadEnv({ ...routeEnv, DEVICE_READ_RATE_LIMIT_PER_MINUTE: "abc" }).DEVICE_READ_RATE_LIMIT_PER_MINUTE).toBe(240);
  });

  it("builds limiters from env when none are injected", async () => {
    const { app, register } = await createApp({ injectLimiters: false, env: { DEVICE_WRITE_RATE_LIMIT_PER_MINUTE: "2" } });
    expect((await writeRequest(app, 0)).statusCode).toBe(200);
    expect((await writeRequest(app, 0)).statusCode).toBe(200);
    expect((await writeRequest(app, 0)).statusCode).toBe(429);
    await app.close();
    expect(register).toHaveBeenCalledTimes(2);
  });

  it("0 disables the limits", async () => {
    const { app } = await createApp({
      injectLimiters: false,
      env: { DEVICE_WRITE_RATE_LIMIT_PER_MINUTE: "0", DEVICE_READ_RATE_LIMIT_PER_MINUTE: "0" },
    });
    for (let i = 0; i < 300; i += 1) {
      expect((await writeRequest(app, i)).statusCode).toBe(200);
      expect((await readRequest(app, i)).statusCode).toBe(200);
    }
    await app.close();
  });
});

describe("RequestRateLimiter", () => {
  it("bounds the number of tracked keys", () => {
    const limiter = new RequestRateLimiter({ maxRequests: 1, maxKeys: 3 });
    for (let i = 0; i < 10; i += 1) limiter.consume(`ip-${i}`);
    expect(limiter.size).toBeLessThanOrEqual(3);
  });

  it("does not limit when maxRequests is 0", () => {
    const limiter = new RequestRateLimiter({ maxRequests: 0 });
    for (let i = 0; i < 1000; i += 1) expect(limiter.consume("ip")).toBeUndefined();
  });
});

describe("PUT /v1/preferences device existence", () => {
  const payload = { deviceId: "device-1", expectedRevision: 0, preferences: [] };

  it("returns device_not_registered without writing when the device is unknown", async () => {
    const getDevice = vi.fn(async () => undefined);
    const { app, replaceForDevice } = await createApp({ getDevice });
    const response = await app.inject({ method: "PUT", url: "/v1/preferences", payload });
    await app.close();
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "device_not_registered" });
    expect(getDevice).toHaveBeenCalledWith("device-1");
    expect(replaceForDevice).not.toHaveBeenCalled();
  });

  it("writes when the device exists", async () => {
    const getDevice = vi.fn(async () => ({ deviceId: "device-1", tokenStatus: "active" }));
    const { app, replaceForDevice } = await createApp({ getDevice });
    const response = await app.inject({ method: "PUT", url: "/v1/preferences", payload });
    await app.close();
    expect(response.statusCode).toBe(200);
    expect(replaceForDevice).toHaveBeenCalledTimes(1);
  });

  it("keeps in-memory fallback behavior when there is no device lookup", async () => {
    const { app, replaceForDevice } = await createApp();
    const response = await app.inject({ method: "PUT", url: "/v1/preferences", payload });
    await app.close();
    expect(response.statusCode).toBe(200);
    expect(replaceForDevice).toHaveBeenCalledTimes(1);
  });
});

describe("PUT /v1/preferences rule cap", () => {
  it("rejects 501 rules and accepts 500", async () => {
    const { app, replaceForDevice } = await createApp();
    const tooMany = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      payload: { deviceId: "device-1", expectedRevision: 0, preferences: Array.from({ length: 601 }, () => validRule()) },
    });
    expect(tooMany.statusCode).toBe(400);
    expect(tooMany.json()).toEqual({ error: "preferences_invalid" });
    expect(replaceForDevice).not.toHaveBeenCalled();

    const ok = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      payload: { deviceId: "device-1", expectedRevision: 0, preferences: Array.from({ length: 600 }, () => validRule()) },
    });
    await app.close();
    expect(ok.statusCode).toBe(200);
    expect(replaceForDevice).toHaveBeenCalledTimes(1);
  });
});
