import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import PreferenceRepository from "../src/repositories/preferenceRepository.js";
import type { UserNotificationPreference } from "../src/types.js";

interface FakePreferenceRecord {
  deviceId: string;
  scope: string;
  generationId: string | null;
  memberId: string | null;
  source: string | null;
  eventType: string | null;
  enabled: boolean;
  explicitOverride: boolean;
  tapAction: string;
  deliveryMode: string;
  data: Record<string, unknown> | null;
  updatedAt: Date;
}

function preference(
  overrides: Partial<UserNotificationPreference>,
): UserNotificationPreference {
  return {
    deviceId: "device-1",
    scope: "global",
    enabled: true,
    explicitOverride: true,
    tapAction: "open_app",
    deliveryMode: "standard",
    updatedAt: "2026-06-11T00:00:00.000Z",
    ...overrides,
  };
}

function createFakePrisma() {
  const records: FakePreferenceRecord[] = [];

  return {
    records,
    prisma: {
      notificationPreference: {
        async findMany(args: { where: { deviceId: string } }) {
          return records.filter((record) => record.deviceId === args.where.deviceId);
        },
        async deleteMany(args: { where: { deviceId: string } }) {
          for (let index = records.length - 1; index >= 0; index -= 1) {
            if (records[index].deviceId === args.where.deviceId) records.splice(index, 1);
          }
        },
        async createMany(args: { data: FakePreferenceRecord[] }) {
          records.push(...args.data);
        },
      },
    },
  };
}

describe("PreferenceRepository", () => {
  it("lists server-side preferences using the shared preference shape", async () => {
    const { prisma, records } = createFakePrisma();
    records.push({
      deviceId: "device-1",
      scope: "platform",
      generationId: null,
      memberId: null,
      source: "chzzk",
      eventType: null,
      enabled: false,
      explicitOverride: true,
      tapAction: "open_platform",
      deliveryMode: "realtime_best_effort",
      data: {
        realtimePreference: "best_effort",
        keywordsBlocklist: ["spoiler"],
        maxNotificationsPerMinute: 3,
        serviceAnnouncementsEnabled: false,
      },
      updatedAt: new Date("2026-06-11T01:00:00.000Z"),
    });

    const repository = new PreferenceRepository(prisma);

    await expect(repository.listForDevice("device-1")).resolves.toEqual([
      {
        deviceId: "device-1",
        scope: "platform",
        source: "chzzk",
        enabled: false,
        explicitOverride: true,
        tapAction: "open_platform",
        deliveryMode: "realtime_best_effort",
        realtimePreference: "best_effort",
        keywordsBlocklist: ["spoiler"],
        maxNotificationsPerMinute: 3,
        serviceAnnouncementsEnabled: false,
        updatedAt: "2026-06-11T01:00:00.000Z",
      },
    ]);
  });

  it("replaces a full preference snapshot for the device", async () => {
    const { prisma, records } = createFakePrisma();
    const now = new Date("2026-06-11T02:00:00.000Z");
    const repository = new PreferenceRepository(prisma, () => now);

    const result = await repository.replaceForDevice({
      deviceId: "device-1",
      clientUpdatedAt: "2026-06-11T01:59:00.000Z",
      preferences: [
        preference({ scope: "global", enabled: true, serviceAnnouncementsEnabled: false }),
        preference({ scope: "generation", generationId: "official", enabled: false }),
        preference({ scope: "event_type", eventType: "chzzk_chat", enabled: false }),
      ],
    });

    expect(result.updatedAt).toBe("2026-06-11T02:00:00.000Z");
    expect(result.preferences).toHaveLength(3);
    expect(records).toHaveLength(3);
    expect(records.map((record) => record.scope)).toEqual([
      "global",
      "generation",
      "event_type",
    ]);
    expect(result.preferences.find((rule) => rule.eventType === "chzzk_chat")).toMatchObject({
      enabled: false,
      explicitOverride: true,
    });
    expect(records.find((record) => record.scope === "global")?.data).toMatchObject({
      serviceAnnouncementsEnabled: false,
    });
  });
});

const routeEnv = {
  DATABASE_URL: "postgresql://stellive:stellive@localhost:5432/stellive_hub",
};

describe("mobile preference routes", () => {
  it("syncs service topics after preferences are replaced", async () => {
    const synced: unknown[] = [];
    const rules = [preference({ scope: "global", enabled: true, serviceAnnouncementsEnabled: false })];
    const app = await buildApp({
      env: routeEnv,
      useProcessEnv: false,
      appRoutes: { dependencies: {
        preferences: { replaceForDevice: async () => ({ preferences: rules, updatedAt: "2026-07-06T00:00:00.000Z" }) },
        serviceTopicSubscriptions: { async syncDevice(input) { synced.push(input); return { status: "synced" }; } }
      } }
    });

    const response = await app.inject({ method: "PUT", url: "/v1/preferences", payload: { deviceId: "device-1", preferences: rules } });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(synced).toEqual([{ deviceId: "device-1", preferences: rules }]);
  });

  it("returns preferences from the injected repository", async () => {
    const app = await buildApp({
      env: routeEnv,
      useProcessEnv: false,
      appRoutes: {
        dependencies: {
          preferences: {
            listForDevice: async () => [
              preference({ scope: "global", enabled: true }),
            ],
          },
        },
      },
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/preferences?deviceId=device-1",
    });

    await app.close();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      deviceId: "device-1",
      preferences: [{ scope: "global", enabled: true }],
      updatedAt: expect.any(String),
    });
  });

  it("rejects preference reads without a device id", async () => {
    const app = await buildApp({ env: routeEnv, useProcessEnv: false });

    const response = await app.inject({
      method: "GET",
      url: "/v1/preferences",
    });

    await app.close();
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "device_not_registered" });
  });
});
