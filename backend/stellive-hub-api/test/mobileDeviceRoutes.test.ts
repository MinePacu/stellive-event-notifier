import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import DeviceRepository from "../src/repositories/deviceRepository.js";

interface FakeDeviceRecord {
  id: string;
  platform: string;
  deviceToken: string | null;
  tokenStatus: string;
  locale: string | null;
  timezone: string | null;
  appVersion: string | null;
  realtimeEnabled: boolean;
  realtimeAcknowledged: boolean;
  lastSeenAt: Date | null;
}

function createFakePrisma() {
  const records = new Map<string, FakeDeviceRecord>();

  return {
    records,
    prisma: {
      device: {
        async upsert(args: {
          where: { id: string };
          create: FakeDeviceRecord;
          update: Partial<FakeDeviceRecord>;
        }) {
          const existing = records.get(args.where.id);
          const record = existing
            ? { ...existing, ...args.update }
            : { ...args.create };
          records.set(args.where.id, record);
          return record;
        },
        async findUnique(args: { where: { id: string } }) {
          return records.get(args.where.id) ?? null;
        },
      },
    },
  };
}

describe("DeviceRepository", () => {
  it("registers a new anonymous device and updates lastSeenAt", async () => {
    const { prisma, records } = createFakePrisma();
    const now = new Date("2026-06-11T01:00:00.000Z");
    const repository = new DeviceRepository(
      prisma,
      () => now,
      () => "device-generated",
    );

    const result = await repository.register({
      platform: "android",
      appVersion: "0.1.0",
      locale: "ko-KR",
      timezone: "Asia/Seoul",
      installationId: "install-1",
    });

    expect(result).toEqual({
      deviceId: "device-generated",
      registered: true,
    });
    expect(records.get("device-generated")).toMatchObject({
      id: "device-generated",
      platform: "android",
      locale: "ko-KR",
      timezone: "Asia/Seoul",
      appVersion: "0.1.0",
      tokenStatus: "missing",
      lastSeenAt: now,
    });
  });

  it("updates push token metadata without returning the raw token", async () => {
    const { prisma } = createFakePrisma();
    const now = new Date("2026-06-11T02:00:00.000Z");
    const repository = new DeviceRepository(
      prisma,
      () => now,
      () => "unused-device-id",
    );

    await repository.register({
      deviceId: "device-1",
      platform: "ios",
      appVersion: "0.1.0",
      locale: "ko-KR",
      timezone: "Asia/Seoul",
    });

    const result = await repository.updateToken({
      deviceId: "device-1",
      platform: "ios",
      provider: "apns_via_fcm",
      token: "runtime-secret-token",
      appVersion: "0.1.1",
      locale: "ko-KR",
      timezone: "Asia/Seoul",
    });

    expect(result).toEqual({ updated: true, tokenStatus: "active" });
    expect(JSON.stringify(result)).not.toContain("runtime-secret-token");
    await expect(repository.getDevice("device-1")).resolves.toEqual({
      deviceId: "device-1",
      tokenStatus: "active",
    });
  });
});

const routeEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
};

describe("mobile device routes", () => {
  it("syncs service topics after a token update", async () => {
    const synced: unknown[] = [];
    const app = await buildApp({
      env: routeEnv,
      useProcessEnv: false,
      appRoutes: { dependencies: {
        devices: { updateToken: async () => ({ updated: true, tokenStatus: "active" }) },
        preferences: { listForDevice: async () => [] },
        serviceTopicSubscriptions: { async syncToken(input) { synced.push(input); return { status: "synced" }; } }
      } }
    });

    const response = await app.inject({
      method: "PUT",
      url: "/v1/devices/token",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ deviceId: "device-1", platform: "android", provider: "fcm", token: "runtime-token" })
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(synced).toEqual([{ token: "runtime-token", preferences: [] }]);
    expect(JSON.stringify(response.json())).not.toContain("runtime-token");
  });

  it("registers devices through the durable mobile app route", async () => {
    const app = await buildApp({
      env: routeEnv,
      useProcessEnv: false,
      appRoutes: {
        dependencies: {
          devices: {
            register: async () => ({ deviceId: "device-route", registered: true }),
          },
        },
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/devices/register",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({
        platform: "android",
        appVersion: "0.1.0",
        locale: "ko-KR",
        timezone: "Asia/Seoul",
      }),
    });

    await app.close();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      deviceId: "device-route",
      registered: true,
      serverTime: expect.any(String),
    });
  });

  it("rejects device token updates that omit the token", async () => {
    const app = await buildApp({ env: routeEnv, useProcessEnv: false });

    const response = await app.inject({
      method: "PUT",
      url: "/v1/devices/token",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({
        deviceId: "device-1",
        platform: "android",
        provider: "fcm",
      }),
    });

    await app.close();
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "device_token_invalid" });
  });

  it("rejects device token updates with unsupported push providers", async () => {
    const app = await buildApp({ env: routeEnv, useProcessEnv: false });

    const response = await app.inject({
      method: "PUT",
      url: "/v1/devices/token",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({
        deviceId: "device-1",
        platform: "android",
        provider: "firebase_topic",
        token: "runtime-token"
      })
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "device_token_provider_invalid" });
  });
});
