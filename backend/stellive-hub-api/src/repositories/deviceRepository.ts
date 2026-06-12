import { randomUUID } from "node:crypto";
import { getPrismaClient } from "../storage/prisma.js";

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

interface DeviceDelegate {
  device: {
    upsert(args: {
      where: { id: string };
      create: {
        id: string;
        platform: string;
        deviceToken?: string | null;
        tokenStatus: string;
        locale?: string | null;
        timezone?: string | null;
        appVersion?: string | null;
        realtimeEnabled?: boolean;
        realtimeAcknowledged?: boolean;
        lastSeenAt?: Date | null;
      };
      update: {
        platform?: string;
        deviceToken?: string | null;
        tokenStatus?: string;
        locale?: string | null;
        timezone?: string | null;
        appVersion?: string | null;
        lastSeenAt?: Date | null;
      };
    }): Promise<unknown>;
    findUnique(args: {
      where: { id: string };
      select?: { id: true; tokenStatus: true };
    }): Promise<DeviceRecord | null>;
  };
}

export default class DeviceRepository {
  constructor(
    private readonly prisma: DeviceDelegate = getPrismaClient(),
    private readonly now: () => Date = () => new Date(),
    private readonly createDeviceId: () => string = () => `device_${randomUUID()}`,
  ) {}

  async register(
    input: DeviceRegistrationInput,
  ): Promise<{ deviceId: string; registered: true }> {
    const deviceId = input.deviceId ?? this.createDeviceId();
    const lastSeenAt = this.now();

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
        lastSeenAt,
      },
      update: {
        platform: input.platform,
        locale: input.locale ?? null,
        timezone: input.timezone ?? null,
        appVersion: input.appVersion ?? null,
        lastSeenAt,
      },
    });

    return { deviceId, registered: true };
  }

  async updateToken(
    input: DeviceTokenInput,
  ): Promise<{ updated: true; tokenStatus: "active" }> {
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
        lastSeenAt: this.now(),
      },
      update: {
        platform: input.platform,
        deviceToken: input.token,
        tokenStatus: "active",
        locale: input.locale ?? null,
        timezone: input.timezone ?? null,
        appVersion: input.appVersion ?? null,
        lastSeenAt: this.now(),
      },
    });

    return { updated: true, tokenStatus: "active" };
  }

  async getDevice(
    deviceId: string,
  ): Promise<{ deviceId: string; tokenStatus: string } | undefined> {
    const record = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, tokenStatus: true },
    });

    if (!record) return undefined;
    return { deviceId: record.id, tokenStatus: record.tokenStatus };
  }
}
