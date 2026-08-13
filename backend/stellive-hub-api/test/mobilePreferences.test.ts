import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import PreferenceRepository, {
  PreferenceConflictError,
} from "../src/repositories/preferenceRepository.js";
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

interface FakePreferenceSnapshotRecord {
  deviceId: string;
  revision: number;
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
  const snapshots = new Map<string, FakePreferenceSnapshotRecord>();
  const transactionIsolationLevels: string[] = [];
  let failNextCreateMany = false;
  let transactionFailuresRemaining = 0;
  let transactionTail = Promise.resolve();

  function createClient(
    workingRecords: FakePreferenceRecord[],
    workingSnapshots: Map<string, FakePreferenceSnapshotRecord>,
  ) {
    return {
      notificationPreference: {
        async findMany(args: { where: { deviceId: string | { in: string[] } } }) {
          const deviceIds = typeof args.where.deviceId === "string"
            ? [args.where.deviceId]
            : args.where.deviceId.in;
          return workingRecords.filter((record) => deviceIds.includes(record.deviceId));
        },
        async deleteMany(args: { where: { deviceId: string } }) {
          for (let index = workingRecords.length - 1; index >= 0; index -= 1) {
            if (workingRecords[index].deviceId === args.where.deviceId) {
              workingRecords.splice(index, 1);
            }
          }
        },
        async createMany(args: { data: FakePreferenceRecord[] }) {
          if (failNextCreateMany) {
            failNextCreateMany = false;
            throw new Error("createMany failed");
          }
          workingRecords.push(...args.data);
        },
      },
      notificationPreferenceSnapshot: {
        async findUnique(args: { where: { deviceId: string } }) {
          return workingSnapshots.get(args.where.deviceId) ?? null;
        },
        async updateMany(args: {
          where: { deviceId: string; revision: number };
          data: { revision: { increment: number }; updatedAt: Date };
        }) {
          const current = workingSnapshots.get(args.where.deviceId);
          if (!current || current.revision !== args.where.revision) return { count: 0 };
          workingSnapshots.set(args.where.deviceId, {
            ...current,
            revision: current.revision + args.data.revision.increment,
            updatedAt: args.data.updatedAt,
          });
          return { count: 1 };
        },
        async create(args: {
          data: { deviceId: string; revision: number; updatedAt: Date };
        }) {
          if (workingSnapshots.has(args.data.deviceId)) {
            throw Object.assign(new Error("unique constraint"), { code: "P2002" });
          }
          const snapshot = { ...args.data };
          workingSnapshots.set(snapshot.deviceId, snapshot);
          return snapshot;
        },
      },
    };
  }

  const rootClient = createClient(records, snapshots);

  return {
    records,
    snapshots,
    transactionIsolationLevels,
    failCreateManyOnce() {
      failNextCreateMany = true;
    },
    failTransactions(count: number) {
      transactionFailuresRemaining = count;
    },
    prisma: {
      ...rootClient,
      async $transaction<T>(
        operation: (transaction: ReturnType<typeof createClient>) => Promise<T>,
        options: { isolationLevel: string },
      ): Promise<T> {
        transactionIsolationLevels.push(options.isolationLevel);
        if (transactionFailuresRemaining > 0) {
          transactionFailuresRemaining -= 1;
          throw Object.assign(new Error("serialization failure"), { code: "P2034" });
        }

        let release!: () => void;
        const previous = transactionTail;
        transactionTail = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;

        const workingRecords = records.map((record) => ({
          ...record,
          data: record.data ? { ...record.data } : null,
        }));
        const workingSnapshots = new Map(
          [...snapshots].map(([deviceId, snapshot]) => [deviceId, { ...snapshot }]),
        );
        try {
          const result = await operation(createClient(workingRecords, workingSnapshots));
          records.splice(0, records.length, ...workingRecords);
          snapshots.clear();
          for (const [deviceId, snapshot] of workingSnapshots) {
            snapshots.set(deviceId, snapshot);
          }
          return result;
        } finally {
          release();
        }
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
    const { prisma, records, snapshots } = createFakePrisma();
    const now = new Date("2026-06-11T02:00:00.000Z");
    const repository = new PreferenceRepository(prisma, () => now);

    const result = await repository.replaceForDevice({
      deviceId: "device-1",
      expectedRevision: 0,
      preferences: [
        preference({ scope: "global", enabled: true, serviceAnnouncementsEnabled: false }),
        preference({ scope: "generation", generationId: "official", enabled: false }),
        preference({ scope: "event_type", eventType: "chzzk_chat", enabled: false }),
      ],
    });

    expect(result.updatedAt).toBe("2026-06-11T02:00:00.000Z");
    expect(result.revision).toBe(1);
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
    expect(snapshots.get("device-1")?.revision).toBe(1);
  });

  it("returns a stable empty snapshot and advances its revision on replacement", async () => {
    const { prisma, transactionIsolationLevels } = createFakePrisma();
    const now = new Date("2026-06-11T02:00:00.000Z");
    const repository = new PreferenceRepository(prisma, () => now);

    await expect(repository.getSnapshotForDevice("device-1")).resolves.toEqual({
      preferences: [],
      revision: 0,
      updatedAt: "1970-01-01T00:00:00.000Z",
    });
    await expect(repository.replaceForDevice({
      deviceId: "device-1",
      expectedRevision: 0,
      preferences: [],
    })).resolves.toMatchObject({ preferences: [], revision: 1 });
    await expect(repository.getSnapshotForDevice("device-1")).resolves.toMatchObject({
      preferences: [],
      revision: 1,
      updatedAt: now.toISOString(),
    });
    expect(transactionIsolationLevels).toEqual([
      "RepeatableRead",
      "Serializable",
      "RepeatableRead",
    ]);
  });

  it("rolls back a failed snapshot replacement and preserves global off", async () => {
    const fake = createFakePrisma();
    fake.records.push({
      deviceId: "device-1",
      scope: "global",
      generationId: null,
      memberId: null,
      source: null,
      eventType: null,
      enabled: false,
      explicitOverride: true,
      tapAction: "open_app",
      deliveryMode: "standard",
      data: null,
      updatedAt: new Date("2026-06-11T01:00:00.000Z"),
    });
    fake.snapshots.set("device-1", {
      deviceId: "device-1",
      revision: 0,
      updatedAt: new Date("2026-06-11T01:00:00.000Z"),
    });
    fake.failCreateManyOnce();
    const repository = new PreferenceRepository(fake.prisma);

    await expect(repository.replaceForDevice({
      deviceId: "device-1",
      expectedRevision: 0,
      preferences: [preference({ enabled: true })],
    })).rejects.toThrow("createMany failed");

    expect(fake.snapshots.get("device-1")?.revision).toBe(0);
    expect(fake.records).toHaveLength(1);
    expect(fake.records[0]).toMatchObject({ scope: "global", enabled: false });
  });

  it("allows only one concurrent replacement for the same revision", async () => {
    const fake = createFakePrisma();
    const repository = new PreferenceRepository(fake.prisma);

    const results = await Promise.allSettled([
      repository.replaceForDevice({
        deviceId: "device-1",
        expectedRevision: 0,
        preferences: [preference({ enabled: false })],
      }),
      repository.replaceForDevice({
        deviceId: "device-1",
        expectedRevision: 0,
        preferences: [preference({ enabled: true })],
      }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.any(PreferenceConflictError),
    });
    expect(fake.snapshots.get("device-1")?.revision).toBe(1);
    expect(fake.records).toHaveLength(1);
  });

  it("keeps snapshot revisions isolated per device", async () => {
    const fake = createFakePrisma();
    const repository = new PreferenceRepository(fake.prisma);

    await Promise.all([
      repository.replaceForDevice({
        deviceId: "device-1",
        expectedRevision: 0,
        preferences: [preference({ enabled: false })],
      }),
      repository.replaceForDevice({
        deviceId: "device-2",
        expectedRevision: 0,
        preferences: [preference({ deviceId: "device-2", enabled: true })],
      }),
    ]);

    expect(fake.snapshots.get("device-1")?.revision).toBe(1);
    expect(fake.snapshots.get("device-2")?.revision).toBe(1);
    expect(fake.records.map((record) => record.deviceId).sort()).toEqual([
      "device-1",
      "device-2",
    ]);
  });

  it("retries one serialization failure before replacing", async () => {
    const fake = createFakePrisma();
    fake.failTransactions(1);
    const repository = new PreferenceRepository(fake.prisma);

    await expect(repository.replaceForDevice({
      deviceId: "device-1",
      expectedRevision: 0,
      preferences: [preference({ enabled: false })],
    })).resolves.toMatchObject({ revision: 1 });
    expect(fake.transactionIsolationLevels).toEqual(["Serializable", "Serializable"]);
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
        preferences: { replaceForDevice: async () => ({ preferences: rules, revision: 1, updatedAt: "2026-07-06T00:00:00.000Z" }) },
        serviceTopicSubscriptions: { async syncDevice(input) { synced.push(input); return { status: "synced" }; } }
      } }
    });

    const response = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      payload: { deviceId: "device-1", preferences: rules, expectedRevision: 0 },
    });
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
            getSnapshotForDevice: async () => ({
              preferences: [preference({ scope: "global", enabled: true })],
              revision: 4,
              updatedAt: "2026-07-06T00:00:00.000Z",
            }),
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
      revision: 4,
      updatedAt: expect.any(String),
    });
  });

  it("returns a conflict without syncing service topics", async () => {
    const synced: unknown[] = [];
    const app = await buildApp({
      env: routeEnv,
      useProcessEnv: false,
      appRoutes: {
        dependencies: {
          preferences: {
            replaceForDevice: async () => {
              throw new PreferenceConflictError();
            },
          },
          serviceTopicSubscriptions: {
            async syncDevice(input) {
              synced.push(input);
            },
          },
        },
      },
    });

    const response = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      payload: { deviceId: "device-1", preferences: [], expectedRevision: 2 },
    });

    await app.close();
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "preference_conflict" });
    expect(synced).toEqual([]);
  });

  it("requires a non-negative integer expected revision", async () => {
    const app = await buildApp({ env: routeEnv, useProcessEnv: false });

    const response = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      payload: { deviceId: "device-1", preferences: [] },
    });

    await app.close();
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "preference_revision_invalid" });
  });

  it("applies fallback snapshots with compare-and-swap semantics", async () => {
    const app = await buildApp({ env: routeEnv, useProcessEnv: false });

    const first = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      payload: { deviceId: "device-1", preferences: [], expectedRevision: 0 },
    });
    const stale = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      payload: { deviceId: "device-1", preferences: [], expectedRevision: 0 },
    });
    const read = await app.inject({
      method: "GET",
      url: "/v1/preferences?deviceId=device-1",
    });

    await app.close();
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ revision: 1 });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({ error: "preference_conflict" });
    expect(read.json()).toMatchObject({ revision: 1, preferences: [] });
  });

  it("rejects fallback writes with an older client timestamp without replacing settings", async () => {
    const app = await buildApp({ env: routeEnv, useProcessEnv: false });
    const first = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      payload: { deviceId: "device-1", preferences: [preference({ enabled: true })], expectedRevision: 0, clientUpdatedAt: "2026-08-13T00:00:02Z" },
    });
    const stale = await app.inject({
      method: "PUT",
      url: "/v1/preferences",
      payload: { deviceId: "device-1", preferences: [preference({ enabled: false })], expectedRevision: 1, clientUpdatedAt: "2026-08-13T00:00:01Z" },
    });
    const read = await app.inject({ method: "GET", url: "/v1/preferences?deviceId=device-1" });
    await app.close();
    expect(first.statusCode).toBe(200);
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({ error: "preference_stale_update" });
    expect(read.json()).toMatchObject({ revision: 1, preferences: [{ enabled: true }] });
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
