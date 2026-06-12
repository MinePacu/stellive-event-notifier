import { randomUUID } from "node:crypto";
import { getPrismaClient } from "../storage/prisma.js";
import type { PushTargetDevice } from "../push/pushSender.js";

export interface DeviceRegistrationInput {
  deviceId?: string;
  platform: "android" | "ios";
  appVersion?: string;
  locale?: string;
  timezone?: string;
  installationId?: string;
}

export interface DeviceTokenInput {
  deviceId: string;
  platform: "android" | "ios";
  provider: "fcm" | "apns_via_fcm";
  token: string;
  appVersion?: string;
  locale?: string;
  timezone?: string;
}

interface DeviceRecord {
  id: string;
  tokenStatus: string;
}

interface PushTargetRecord {
  id: string;
  platform: string;
  deviceToken: string | null;
  tokenStatus: string;
  timezone: string | null;
  locale: string | null;
  appVersion: string | null;
}

interface DeviceDelegate {
  device: {
    upsert?(args: unknown): Promise<unknown>;
    findUnique?(args: { where: { id: string }; select?: { id: true; tokenStatus: true } }): Promise<DeviceRecord | null>;
    findMany?(args: unknown): Promise<PushTargetRecord[]>;
    update?(args: unknown): Promise<unknown>;
  };
}

function pushProviderFor(platform: string): PushTargetDevice["pushProvider"] {
  return platform === "ios" ? "apns_via_fcm" : "fcm";
}

function platformFor(platform: string): PushTargetDevice["platform"] {
  return platform === "ios" ? "ios" : "android";
}

function toPushTarget(record: PushTargetRecord): PushTargetDevice | undefined {
  if (!record.deviceToken || record.tokenStatus !== "active") return undefined;
  return {
    deviceId: record.id,
    platform: platformFor(record.platform),
    pushProvider: pushProviderFor(record.platform),
    pushToken: record.deviceToken,
    tokenStatus: "active",
    timezone: record.timezone ?? undefined,
    locale: record.locale ?? undefined,
    appVersion: record.appVersion ?? undefined
  };
}

export class DeviceRepository {
  constructor(
    private readonly prisma: DeviceDelegate = getPrismaClient() as unknown as DeviceDelegate,
    private readonly now: () => Date = () => new Date(),
    private readonly createDeviceId: () => string = () => `device_${randomUUID()}`
  ) {}

  async register(input: DeviceRegistrationInput): Promise<{ deviceId: string; registered: true }> {
    if (!this.prisma.device.upsert) throw new Error("device_upsert_unavailable");
    const deviceId = input.deviceId ?? this.createDeviceId();
    await this.prisma.device.upsert({
      where: { id: deviceId },
      create: {
        id: deviceId,
        platform: input.platform,
        deviceToken: null,
        tokenStatus: "missing",
        locale: input.locale ?? null,
        timezone: input.timezone ?? null,
        appVersion: input.appVersion ?? null,
        realtimeEnabled: false,
        realtimeAcknowledged: false,
        lastSeenAt: this.now()
      },
      update: {
        platform: input.platform,
        locale: input.locale ?? null,
        timezone: input.timezone ?? null,
        appVersion: input.appVersion ?? null,
        lastSeenAt: this.now()
      }
    });
    return { deviceId, registered: true };
  }

  async updateToken(input: DeviceTokenInput): Promise<{ updated: true; tokenStatus: "active" }> {
    if (!this.prisma.device.upsert) throw new Error("device_upsert_unavailable");
    await this.prisma.device.upsert({
      where: { id: input.deviceId },
      create: {
        id: input.deviceId,
        platform: input.platform,
        deviceToken: input.token,
        tokenStatus: "active",
        locale: input.locale ?? null,
        timezone: input.timezone ?? null,
        appVersion: input.appVersion ?? null,
        realtimeEnabled: false,
        realtimeAcknowledged: false,
        lastSeenAt: this.now()
      },
      update: {
        platform: input.platform,
        deviceToken: input.token,
        tokenStatus: "active",
        locale: input.locale ?? null,
        timezone: input.timezone ?? null,
        appVersion: input.appVersion ?? null,
        lastSeenAt: this.now()
      }
    });
    return { updated: true, tokenStatus: "active" };
  }

  async getDevice(deviceId: string): Promise<{ deviceId: string; tokenStatus: string } | undefined> {
    if (!this.prisma.device.findUnique) throw new Error("device_lookup_unavailable");
    const record = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, tokenStatus: true }
    });
    if (!record) return undefined;
    return { deviceId: record.id, tokenStatus: record.tokenStatus };
  }

  async listPushTargets(): Promise<PushTargetDevice[]> {
    if (!this.prisma.device.findMany) throw new Error("device_push_target_listing_unavailable");
    const records = await this.prisma.device.findMany({
      where: {
        tokenStatus: "active",
        deviceToken: { not: null }
      },
      select: {
        id: true,
        platform: true,
        deviceToken: true,
        tokenStatus: true,
        timezone: true,
        locale: true,
        appVersion: true
      }
    });
    return records.flatMap((record) => {
      const target = toPushTarget(record);
      return target ? [target] : [];
    });
  }

  async markTokenInvalid(deviceId: string, _reason: string): Promise<void> {
    if (!this.prisma.device.update) throw new Error("device_token_update_unavailable");
    await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        tokenStatus: "invalid",
        lastSeenAt: this.now()
      }
    });
  }
}

export default DeviceRepository;
