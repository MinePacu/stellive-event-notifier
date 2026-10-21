import { randomUUID } from "node:crypto";
import { getPrismaClient } from "../storage/prisma.js";
import {
  checkDeviceSecret,
  DeviceAuthFailedError,
  generateDeviceSecret,
  type DeviceSecretCheck,
} from "../mobile/deviceSecret.js";
import type { PushTargetDevice } from "../push/pushSender.js";

export interface DeviceRegistrationInput {
  deviceId?: string;
  platform: "android" | "ios";
  appVersion?: string;
  locale?: string;
  timezone?: string;
  installationId?: string;
  deviceSecret?: string;
  deviceSecretSupported?: boolean;
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

export interface MarkTokenInvalidInput {
  deviceId: string;
  expectedToken: string;
  reason: string;
}

export interface PushTokenOwnershipInput {
  deviceId: string;
  pushToken: string;
}

export class DeviceTokenClaimUnavailableError extends Error {
  constructor() {
    super("device token ownership claim unavailable");
    this.name = "DeviceTokenClaimUnavailableError";
  }
}

interface DeviceRecord {
  id: string;
  tokenStatus: string;
  secretHash?: string | null;
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

interface DeviceClient {
  device: {
    create?(args: unknown): Promise<unknown>;
    upsert?(args: unknown): Promise<unknown>;
    findUnique?(args: {
      where: { id: string };
      select?: Partial<Record<"id" | "tokenStatus" | "secretHash", true>>;
    }): Promise<DeviceRecord | null>;
    findMany?(args: unknown): Promise<unknown[]>;
    updateMany?(args: unknown): Promise<{ count: number }>;
  };
}

interface DeviceDelegate extends DeviceClient {
  $transaction?<T>(
    operation: (transaction: DeviceClient) => Promise<T>,
    options: { isolationLevel: "Serializable" },
  ): Promise<T>;
}

function prismaErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function isRetryableTokenClaimError(error: unknown): boolean {
  const code = prismaErrorCode(error);
  return code === "P2002" || code === "P2034";
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

  async register(input: DeviceRegistrationInput): Promise<{ deviceId: string; registered: true; deviceSecret?: string }> {
    if (input.deviceId !== undefined && typeof input.deviceId !== "string") throw new Error("device_id_invalid");
    const device = this.prisma.device;
    if (!device.create || !device.upsert || !device.findUnique || !device.updateMany) {
      throw new Error("device_register_unavailable");
    }
    const metadata = {
      platform: input.platform,
      locale: input.locale ?? null,
      timezone: input.timezone ?? null,
      appVersion: input.appVersion ?? null,
      lastSeenAt: this.now()
    };
    const existing = input.deviceId
      ? await device.findUnique({ where: { id: input.deviceId }, select: { secretHash: true } })
      : null;

    if (input.deviceId && existing?.secretHash) {
      // Never rotate an issued secret; only its holder may refresh the registration.
      if (checkDeviceSecret(existing.secretHash, input.deviceSecret) !== "ok") throw new DeviceAuthFailedError();
      await device.updateMany({ where: { id: input.deviceId }, data: metadata });
      return { deviceId: input.deviceId, registered: true };
    }

    const deviceId = input.deviceId ?? this.createDeviceId();
    if (!input.deviceSecretSupported) {
      // Old app builds ignore deviceSecret, so issuing one would lock them out from their next request.
      await device.upsert({
        where: { id: deviceId },
        create: {
          id: deviceId,
          ...metadata,
          deviceToken: null,
          tokenStatus: "missing",
          realtimeEnabled: false,
          realtimeAcknowledged: false
        },
        update: metadata
      });
      return { deviceId, registered: true };
    }

    const { secret, hash } = generateDeviceSecret();
    if (existing) {
      // One-time claim for legacy rows; losing a concurrent claim means this caller cannot hold the issued secret.
      const { count } = await device.updateMany({
        where: { id: deviceId, secretHash: null },
        data: { ...metadata, secretHash: hash }
      });
      if (count !== 1) throw new DeviceAuthFailedError();
    } else {
      try {
        await device.create({
          data: {
            id: deviceId,
            ...metadata,
            deviceToken: null,
            tokenStatus: "missing",
            realtimeEnabled: false,
            realtimeAcknowledged: false,
            secretHash: hash
          }
        });
      } catch (error) {
        // A concurrent request created the row first; the client re-registers and claims or authenticates.
        if (prismaErrorCode(error) === "P2002") throw new DeviceAuthFailedError();
        throw error;
      }
    }
    return { deviceId, registered: true, deviceSecret: secret };
  }

  async verifyDeviceSecret(deviceId: string, provided: unknown): Promise<DeviceSecretCheck | "missing"> {
    if (!this.prisma.device.findUnique) throw new Error("device_lookup_unavailable");
    const record = await this.prisma.device.findUnique({ where: { id: deviceId }, select: { secretHash: true } });
    return record ? checkDeviceSecret(record.secretHash, provided) : "missing";
  }

  async updateToken(input: DeviceTokenInput): Promise<{ updated: true; tokenStatus: "active" }> {
    if (typeof input.deviceId !== "string" || typeof input.token !== "string") throw new Error("device_token_input_invalid");
    if (!this.prisma.$transaction) throw new Error("device_transaction_unavailable");

    // Fast path: the device already owns this active token (the unique constraint guarantees
    // no other row holds it), so skip the Serializable claim transaction.
    if (this.prisma.device.updateMany) {
      const { count } = await this.prisma.device.updateMany({
        where: { id: input.deviceId, deviceToken: input.token, tokenStatus: "active" },
        data: {
          platform: input.platform,
          locale: input.locale ?? null,
          timezone: input.timezone ?? null,
          appVersion: input.appVersion ?? null,
          lastSeenAt: this.now(),
        },
      });
      if (count === 1) return { updated: true, tokenStatus: "active" };
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            if (!transaction.device.updateMany || !transaction.device.upsert) {
              throw new Error("device_token_claim_unavailable");
            }
            const lastSeenAt = this.now();
            await transaction.device.updateMany({
              where: {
                deviceToken: input.token,
                id: { not: input.deviceId },
              },
              data: {
                deviceToken: null,
                tokenStatus: "missing",
              },
            });
            await transaction.device.upsert({
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
                lastSeenAt,
              },
              update: {
                platform: input.platform,
                deviceToken: input.token,
                tokenStatus: "active",
                locale: input.locale ?? null,
                timezone: input.timezone ?? null,
                appVersion: input.appVersion ?? null,
                lastSeenAt,
              },
            });
            return { updated: true as const, tokenStatus: "active" as const };
          },
          { isolationLevel: "Serializable" },
        );
      } catch (error) {
        if (!isRetryableTokenClaimError(error)) throw error;
        if (attempt === 2) throw new DeviceTokenClaimUnavailableError();
      }
    }

    throw new DeviceTokenClaimUnavailableError();
  }

  async getDevice(deviceId: string): Promise<{ deviceId: string; tokenStatus: string; secretHash: string | null } | undefined> {
    if (!this.prisma.device.findUnique) throw new Error("device_lookup_unavailable");
    const record = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, tokenStatus: true, secretHash: true }
    });
    if (!record) return undefined;
    return { deviceId: record.id, tokenStatus: record.tokenStatus, secretHash: record.secretHash ?? null };
  }

  async findPushTarget(deviceId: string): Promise<PushTargetDevice | undefined> {
    if (!this.prisma.device.findUnique) throw new Error("device_lookup_unavailable");
    const record = await this.prisma.device.findUnique({ where: { id: deviceId } }) as PushTargetRecord | null;
    return record ? toPushTarget(record) : undefined;
  }

  async listPushTargets(): Promise<PushTargetDevice[]> {
    const items: PushTargetDevice[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.listPushTargetsPage({ cursor, limit: 500 });
      items.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return items;
  }

  async listPushTargetsPage(input: { cursor?: string; limit: number }): Promise<{
    items: PushTargetDevice[];
    nextCursor: string | null;
  }> {
    if (!this.prisma.device.findMany) throw new Error("device_push_target_listing_unavailable");
    const limit = Math.max(1, Math.trunc(input.limit));
    const records = await this.prisma.device.findMany({
      where: {
        tokenStatus: "active",
        deviceToken: { not: null },
        ...(input.cursor ? { id: { gt: input.cursor } } : {})
      },
      orderBy: { id: "asc" },
      take: limit + 1,
      select: {
        id: true,
        platform: true,
        deviceToken: true,
        tokenStatus: true,
        timezone: true,
        locale: true,
        appVersion: true
      }
    }) as PushTargetRecord[];
    const pageRecords = records.slice(0, limit);
    const items = pageRecords.flatMap((record) => {
      const target = toPushTarget(record);
      return target ? [target] : [];
    });
    return {
      items,
      nextCursor: records.length > limit ? pageRecords.at(-1)?.id ?? null : null
    };
  }

  async listCurrentPushTokenOwnerIds(pairs: PushTokenOwnershipInput[]): Promise<Set<string>> {
    if (pairs.length === 0) return new Set();
    if (!this.prisma.device.findMany) throw new Error("device_push_token_ownership_lookup_unavailable");
    const records = await this.prisma.device.findMany({
      where: {
        tokenStatus: "active",
        OR: pairs.map((pair) => ({ id: pair.deviceId, deviceToken: pair.pushToken })),
      },
      select: { id: true, deviceToken: true },
    }) as Array<Pick<PushTargetRecord, "id" | "deviceToken">>;
    return new Set(records.map((record) => record.id));
  }

  async markTokenInvalid(input: MarkTokenInvalidInput): Promise<boolean> {
    if (!this.prisma.device.updateMany) throw new Error("device_token_update_unavailable");
    const result = await this.prisma.device.updateMany({
      where: {
        id: input.deviceId,
        deviceToken: input.expectedToken,
        tokenStatus: "active",
      },
      data: {
        deviceToken: null,
        tokenStatus: "invalid",
        lastSeenAt: this.now()
      }
    });
    return result.count === 1;
  }
}

export default DeviceRepository;
