import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import DeviceRepository, { DeviceTokenClaimUnavailableError } from "../src/repositories/deviceRepository.js";
import type { UserNotificationPreference } from "../src/types.js";

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
        async updateMany(args: {
          where: { deviceToken?: string; id?: { not: string } };
          data: Partial<FakeDeviceRecord>;
        }) {
          let count = 0;
          for (const [id, record] of records) {
            if (args.where.deviceToken !== undefined && record.deviceToken !== args.where.deviceToken) continue;
            if (args.where.id?.not === id) continue;
            records.set(id, { ...record, ...args.data });
            count += 1;
          }
          return { count };
        },
      },
      async $transaction<T>(operation: (transaction: unknown) => Promise<T>) {
        return operation(this);
      },
    },
  };
}

describe("DeviceRepository", () => {
  it("registers a new anonymous device and updates lastSeenAt", async () => {
    const { prisma, records } = createFakePrisma();
    const now = new Date("2026-06-11T01:00:00.000Z");
    const repository = new DeviceRepository(
      prisma as never,
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
      prisma as never,
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

  it("atomically transfers a token from an older installation", async () => {
    const { prisma, records } = createFakePrisma();
    const repository = new DeviceRepository(prisma as never);
    await repository.updateToken({
      deviceId: "old-device",
      platform: "android",
      provider: "fcm",
      token: "shared-runtime-token",
    });

    await repository.updateToken({
      deviceId: "new-device",
      platform: "android",
      provider: "fcm",
      token: "shared-runtime-token",
    });

    expect(records.get("old-device")).toMatchObject({ deviceToken: null, tokenStatus: "missing" });
    expect(records.get("new-device")).toMatchObject({ deviceToken: "shared-runtime-token", tokenStatus: "active" });
  });
});

const routeEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
};

function globalPreference(
  overrides: Partial<UserNotificationPreference>,
): UserNotificationPreference {
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

class ThisBoundDeviceDependency {
  calls: unknown[] = [];

  async register(input: unknown) {
    this.calls.push(input);
    return { deviceId: "device-bound", registered: true as const };
  }

  async updateToken(input: unknown) {
    this.calls.push(input);
    return { updated: true as const, tokenStatus: "active" as const };
  }
}

describe("mobile device routes", () => {
  it("preserves the device dependency this binding when registering", async () => {
    const devices = new ThisBoundDeviceDependency();
    const app = await buildApp({
      env: routeEnv,
      useProcessEnv: false,
      appRoutes: { dependencies: { devices } },
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/devices/register",
      payload: { platform: "android" },
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(devices.calls).toHaveLength(1);
  });

  it("preserves the device dependency this binding when updating a token", async () => {
    const devices = new ThisBoundDeviceDependency();
    const app = await buildApp({
      env: routeEnv,
      useProcessEnv: false,
      appRoutes: { dependencies: { devices } },
    });

    const response = await app.inject({
      method: "PUT",
      url: "/v1/devices/token",
      payload: { deviceId: "device-1", platform: "android", provider: "fcm", token: "runtime-token" },
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(devices.calls).toHaveLength(1);
  });

  it.skip("updates an enabled token before syncing service topics", async () => {
    const operations: string[] = [];
    const synced: unknown[] = [];
    const app = await buildApp({
      env: routeEnv,
      useProcessEnv: false,
      appRoutes: { dependencies: {
        devices: { updateToken: async () => {
          operations.push("update");
          return { updated: true, tokenStatus: "active" };
        } },
        preferences: { listForDevice: async () => [] },
        serviceTopicSubscriptions: { async syncToken(input) {
          operations.push("sync");
          synced.push(input);
          return { status: "synced" };
        } }
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
    expect(operations).toEqual(["update", "sync"]);
    expect(synced).toEqual([{ token: "runtime-token", preferences: [] }]);
    expect(JSON.stringify(response.json())).not.toContain("runtime-token");
  });

  it.skip("unsubscribes a stored global-off device before updating its token", async () => {
    const operations: string[] = [];
    const rules = [globalPreference({ enabled: false })];
    const app = await buildApp({
      env: routeEnv,
      useProcessEnv: false,
      appRoutes: { dependencies: {
        devices: { updateToken: async () => {
          operations.push("update");
          return { updated: true, tokenStatus: "active" };
        } },
        preferences: { listForDevice: async () => rules },
        serviceTopicSubscriptions: { async syncToken() {
          operations.push("sync");
          return { status: "synced" };
        } },
      } },
    });

    const response = await app.inject({
      method: "PUT",
      url: "/v1/devices/token",
      payload: { deviceId: "device-1", platform: "android", provider: "fcm", token: "runtime-token" },
    });

    await app.close();
    expect(response.statusCode).toBe(200);
    expect(operations).toEqual(["sync", "update"]);
  });

  it.skip("does not update an incoming token when stored opt-out sync is unsafe", async () => {
    let updateCalls = 0;
    let syncCalls = 0;
    const rules = [globalPreference({ serviceAnnouncementsEnabled: false })];
    const app = await buildApp({
      env: routeEnv,
      useProcessEnv: false,
      appRoutes: { dependencies: {
        devices: { updateToken: async () => {
          updateCalls += 1;
          return { updated: true, tokenStatus: "active" };
        } },
        preferences: { listForDevice: async () => rules },
        serviceTopicSubscriptions: { async syncToken() {
          syncCalls += 1;
          return { status: "disabled" };
        } },
      } },
    });

    const response = await app.inject({
      method: "PUT",
      url: "/v1/devices/token",
      payload: { deviceId: "device-1", platform: "android", provider: "fcm", token: "runtime-token" },
    });

    await app.close();
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "server_unavailable" });
    expect(updateCalls).toBe(0);
    expect(syncCalls).toBe(1);
  });

  it("returns server_unavailable when token ownership claim retries are exhausted", async () => {
    const app = await buildApp({
      env: routeEnv,
      useProcessEnv: false,
      appRoutes: {
        dependencies: {
          devices: {
            async updateToken() {
              throw new DeviceTokenClaimUnavailableError();
            },
          },
        },
      },
    });

    const response = await app.inject({
      method: "PUT",
      url: "/v1/devices/token",
      payload: { deviceId: "device-1", platform: "android", provider: "fcm", token: "runtime-token" },
    });
    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "server_unavailable" });
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
