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

interface PreferenceDelegate {
  notificationPreference: {
    findMany(args: unknown): Promise<PreferenceRecord[]>;
    deleteMany(args: { where: { deviceId: string } }): Promise<unknown>;
    createMany(args: { data: PreferenceRecord[] }): Promise<unknown>;
  };
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
    clientUpdatedAt: string;
  }): Promise<{ preferences: UserNotificationPreference[]; updatedAt: string }> {
    const updatedAt = this.now();
    const records = input.preferences.map((preference) =>
      toRecord(input.deviceId, preference, updatedAt),
    );

    await this.prisma.notificationPreference.deleteMany({
      where: { deviceId: input.deviceId },
    });
    if (records.length > 0) {
      await this.prisma.notificationPreference.createMany({ data: records });
    }

    return {
      preferences: records.map(toPreference),
      updatedAt: updatedAt.toISOString(),
    };
  }
}
