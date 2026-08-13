import { getPrismaClient } from "../storage/prisma.js";
import type { UserNotificationPreference } from "../types.js";

type PreferenceData = Pick<
  UserNotificationPreference,
  | "realtimePreference"
  | "quietHours"
  | "keywordsAllowlist"
  | "keywordsBlocklist"
  | "maxNotificationsPerMinute"
  | "serviceAnnouncementsEnabled"
>;

interface PreferenceRecord {
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
  data: unknown | null;
  updatedAt: Date | string;
}

interface PreferenceSnapshotRecord {
  deviceId: string;
  revision: number;
  lastClientUpdatedAt?: Date | string | null;
  updatedAt: Date | string;
}

interface PreferenceTransactionClient {
  notificationPreference: {
    findMany(args: unknown): Promise<PreferenceRecord[]>;
    deleteMany(args: { where: { deviceId: string } }): Promise<unknown>;
    createMany(args: { data: PreferenceRecord[] }): Promise<unknown>;
  };
  notificationPreferenceSnapshot: {
    findUnique(args: {
      where: { deviceId: string };
    }): Promise<PreferenceSnapshotRecord | null>;
    updateMany(args: {
      where: { deviceId: string; revision: number; OR?: unknown[] };
      data: { revision: { increment: number }; updatedAt: Date; lastClientUpdatedAt?: Date };
    }): Promise<{ count: number }>;
    create(args: {
      data: { deviceId: string; revision: number; updatedAt: Date; lastClientUpdatedAt?: Date };
    }): Promise<PreferenceSnapshotRecord>;
  };
}

interface PreferenceDelegate extends PreferenceTransactionClient {
  $transaction<T>(
    operation: (transaction: PreferenceTransactionClient) => Promise<T>,
    options: { isolationLevel: "RepeatableRead" | "Serializable" },
  ): Promise<T>;
}

export interface PreferenceSnapshot {
  preferences: UserNotificationPreference[];
  revision: number;
  updatedAt: string;
}

export class PreferenceConflictError extends Error {
  constructor() {
    super("preference snapshot revision conflict");
    this.name = "PreferenceConflictError";
  }
}

export class PreferenceStaleUpdateError extends Error {
  constructor() {
    super("preference client timestamp is stale");
    this.name = "PreferenceStaleUpdateError";
  }
}

function definedPreferenceData(
  preference: UserNotificationPreference,
): PreferenceData | null {
  const data: PreferenceData = {};
  if (preference.realtimePreference !== undefined) {
    data.realtimePreference = preference.realtimePreference;
  }
  if (preference.quietHours !== undefined) data.quietHours = preference.quietHours;
  if (preference.keywordsAllowlist !== undefined) {
    data.keywordsAllowlist = preference.keywordsAllowlist;
  }
  if (preference.keywordsBlocklist !== undefined) {
    data.keywordsBlocklist = preference.keywordsBlocklist;
  }
  if (preference.maxNotificationsPerMinute !== undefined) {
    data.maxNotificationsPerMinute = preference.maxNotificationsPerMinute;
  }
  if (preference.serviceAnnouncementsEnabled !== undefined) {
    data.serviceAnnouncementsEnabled = preference.serviceAnnouncementsEnabled;
  }

  return Object.keys(data).length > 0 ? data : null;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function latestUpdatedAt(records: PreferenceRecord[]): string {
  return (
    records
      .map((record) => toIsoString(record.updatedAt))
      .sort()
      .at(-1) ?? new Date(0).toISOString()
  );
}

function toPreferenceData(value: unknown): PreferenceData {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as PreferenceData) : {};
}

function toPreference(record: PreferenceRecord): UserNotificationPreference {
  const data = toPreferenceData(record.data);
  return {
    deviceId: record.deviceId,
    scope: record.scope,
    generationId: record.generationId ?? undefined,
    memberId: record.memberId ?? undefined,
    source: record.source ?? undefined,
    eventType: record.eventType ?? undefined,
    enabled: record.enabled,
    explicitOverride: record.explicitOverride,
    tapAction: record.tapAction,
    deliveryMode: record.deliveryMode,
    realtimePreference: data.realtimePreference,
    quietHours: data.quietHours,
    keywordsAllowlist: data.keywordsAllowlist,
    keywordsBlocklist: data.keywordsBlocklist,
    maxNotificationsPerMinute: data.maxNotificationsPerMinute,
    serviceAnnouncementsEnabled: data.serviceAnnouncementsEnabled,
    updatedAt: toIsoString(record.updatedAt),
  } as UserNotificationPreference;
}

function toRecord(
  deviceId: string,
  preference: UserNotificationPreference,
  updatedAt: Date,
): PreferenceRecord {
  return {
    deviceId,
    scope: preference.scope,
    generationId: preference.generationId ?? null,
    memberId: preference.memberId ?? null,
    source: preference.source ?? null,
    eventType: preference.eventType ?? null,
    enabled: preference.enabled,
    explicitOverride: preference.explicitOverride,
    tapAction: preference.tapAction,
    deliveryMode: preference.deliveryMode,
    data: definedPreferenceData(preference),
    updatedAt,
  };
}

export default class PreferenceRepository {
  constructor(
    private readonly prisma: PreferenceDelegate = getPrismaClient() as unknown as PreferenceDelegate,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listForDevice(deviceId: string): Promise<UserNotificationPreference[]> {
    const records = await this.prisma.notificationPreference.findMany({
      where: { deviceId },
      orderBy: { updatedAt: "desc" },
    });
    return records.map(toPreference);
  }

  async getSnapshotForDevice(deviceId: string): Promise<PreferenceSnapshot> {
    return this.prisma.$transaction(
      async (transaction) => {
        const snapshot = await transaction.notificationPreferenceSnapshot.findUnique({
          where: { deviceId },
        });
        const records = await transaction.notificationPreference.findMany({
          where: { deviceId },
          orderBy: { updatedAt: "desc" },
        });

        return {
          preferences: records.map(toPreference),
          revision: snapshot?.revision ?? 0,
          updatedAt: snapshot ? toIsoString(snapshot.updatedAt) : latestUpdatedAt(records),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }

  async listForDevices(deviceIds: string[]): Promise<UserNotificationPreference[]> {
    if (deviceIds.length === 0) return [];
    const records = await this.prisma.notificationPreference.findMany({
      where: { deviceId: { in: deviceIds } },
      orderBy: [{ deviceId: "asc" }, { updatedAt: "desc" }]
    });
    return records.map(toPreference);
  }

  async replaceForDevice(input: {
    deviceId: string;
    preferences: UserNotificationPreference[];
    expectedRevision: number;
    clientUpdatedAt?: string;
  }): Promise<PreferenceSnapshot> {
    const clientUpdatedAt = input.clientUpdatedAt ? new Date(input.clientUpdatedAt) : undefined;
    if (input.clientUpdatedAt && (!clientUpdatedAt || Number.isNaN(clientUpdatedAt.getTime()))) {
      throw new PreferenceStaleUpdateError();
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const updatedAt = this.now();
            const records = input.preferences.map((preference) =>
              toRecord(input.deviceId, preference, updatedAt),
            );

            const advanced = await transaction.notificationPreferenceSnapshot.updateMany({
              where: {
                deviceId: input.deviceId,
                revision: input.expectedRevision,
                ...(clientUpdatedAt
                  ? { OR: [{ lastClientUpdatedAt: null }, { lastClientUpdatedAt: { lt: clientUpdatedAt } }] }
                  : {}),
              },
              data: {
                revision: { increment: 1 },
                updatedAt,
                ...(clientUpdatedAt ? { lastClientUpdatedAt: clientUpdatedAt } : {}),
              },
            });

            if (advanced.count === 0) {
              const current = await transaction.notificationPreferenceSnapshot.findUnique({
                where: { deviceId: input.deviceId },
              });
              if (current || input.expectedRevision !== 0) {
                if (clientUpdatedAt && current?.lastClientUpdatedAt && new Date(current.lastClientUpdatedAt) >= clientUpdatedAt) {
                  throw new PreferenceStaleUpdateError();
                }
                throw new PreferenceConflictError();
              }
              await transaction.notificationPreferenceSnapshot.create({
                data: {
                  deviceId: input.deviceId,
                  revision: 1,
                  updatedAt,
                  ...(clientUpdatedAt ? { lastClientUpdatedAt: clientUpdatedAt } : {}),
                },
              });
            }

            await transaction.notificationPreference.deleteMany({
              where: { deviceId: input.deviceId },
            });
            if (records.length > 0) {
              await transaction.notificationPreference.createMany({ data: records });
            }

            return {
              preferences: records.map(toPreference),
              revision: input.expectedRevision + 1,
              updatedAt: updatedAt.toISOString(),
            };
          },
          { isolationLevel: "Serializable" },
        );
      } catch (error) {
        const code = errorCode(error);
        if (code === "P2034" && attempt === 0) continue;
        if (code === "P2002" && input.expectedRevision === 0) {
          throw new PreferenceConflictError();
        }
        throw error;
      }
    }

    throw new Error("unreachable preference transaction retry state");
  }
}
