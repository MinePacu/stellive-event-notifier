import type { Prisma } from "@prisma/client";
import type { AdapterHealth, AdapterHealthSource, AdapterHealthStatus } from "../admin/adminTypes.js";
import { getPrismaClient } from "../storage/prisma.js";

export interface PlatformApiStateInput {
  source: string;
  key: string;
  value: Prisma.InputJsonValue;
  status: string;
}

export interface PlatformApiStateRecord {
  source: string;
  key: string;
  value: Prisma.JsonValue;
  status: string;
  updatedAt: Date;
}

interface PlatformApiStateDelegate {
  platformApiState: {
    upsert(args: {
      where: { source_key: { source: string; key: string } };
      create: { source: string; key: string; value: Prisma.InputJsonValue; status: string };
      update: { value: Prisma.InputJsonValue; status: string };
    }): Promise<unknown>;
    findUnique?(args: {
      where: { source_key: { source: string; key: string } };
      select?: {
        source?: true;
        key?: true;
        value?: true;
        status?: true;
        updatedAt?: true;
      };
    }): Promise<PlatformApiStateRecord | null>;
    findMany?(args: {
      where: { key: string; source: { in: AdapterHealthSource[] } };
      orderBy?: { updatedAt: "desc" };
      select?: {
        source: true;
        key?: true;
        value: true;
        status: true;
        updatedAt: true;
      };
    }): Promise<PlatformApiStateRecord[]>;
  };
}

const adapterHealthSources = new Set<AdapterHealthSource>(["youtube", "chzzk", "naver_cafe"]);
const adapterHealthSourceList: AdapterHealthSource[] = ["youtube", "chzzk", "naver_cafe"];
const adapterHealthStatuses = new Set<AdapterHealthStatus>(["enabled", "disabled", "verify_required", "rate_limited"]);

function isAdapterHealthSource(source: string): source is AdapterHealthSource {
  return adapterHealthSources.has(source as AdapterHealthSource);
}

function toJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toAdapterHealth(record: Pick<PlatformApiStateRecord, "source" | "value" | "status" | "updatedAt">): AdapterHealth {
  const value = toJsonObject(record.value);
  const status = adapterHealthStatuses.has(record.status as AdapterHealthStatus)
    ? (record.status as AdapterHealthStatus)
    : "verify_required";

  return {
    source: isAdapterHealthSource(record.source) ? record.source : "chzzk",
    status,
    reason: typeof value.reason === "string" ? value.reason : "adapter_health_state_recorded",
    lastCheckedAt:
      typeof value.lastCheckedAt === "string" ? value.lastCheckedAt : record.updatedAt.toISOString()
  };
}

export class PlatformApiStateRepository {
  constructor(private readonly prisma: PlatformApiStateDelegate = getPrismaClient()) {}

  async upsert(input: PlatformApiStateInput) {
    return this.prisma.platformApiState.upsert({
      where: { source_key: { source: input.source, key: input.key } },
      create: {
        source: input.source,
        key: input.key,
        value: input.value,
        status: input.status
      },
      update: {
        value: input.value,
        status: input.status
      }
    });
  }

  async upsertState(source: string, key: string, value: Prisma.InputJsonValue, status: string) {
    return this.upsert({ source, key, value, status });
  }

  async getState(source: string, key: string): Promise<PlatformApiStateRecord | null> {
    if (!this.prisma.platformApiState.findUnique) {
      throw new Error("platform_api_state_find_unique_unavailable");
    }

    return this.prisma.platformApiState.findUnique({
      where: { source_key: { source, key } },
      select: {
        source: true,
        key: true,
        value: true,
        status: true,
        updatedAt: true
      }
    });
  }

  async upsertAdapterHealth(source: AdapterHealthSource, health: AdapterHealth) {
    return this.upsertState(
      source,
      "health",
      {
        reason: health.reason,
        lastCheckedAt: health.lastCheckedAt
      },
      health.status
    );
  }

  async getLatestAdapterHealth(source: AdapterHealthSource): Promise<AdapterHealth | null> {
    const state = await this.getState(source, "health");
    return state ? toAdapterHealth(state) : null;
  }

  async listAdapterHealth(): Promise<AdapterHealth[]> {
    if (!this.prisma.platformApiState.findMany) {
      throw new Error("platform_api_state_health_unavailable");
    }

    const records = await this.prisma.platformApiState.findMany({
      where: { key: "health", source: { in: adapterHealthSourceList } },
      orderBy: { updatedAt: "desc" },
      select: {
        source: true,
        value: true,
        status: true,
        updatedAt: true
      }
    });

    const latestBySource = new Map<AdapterHealthSource, AdapterHealth>();

    for (const record of records) {
      if (!isAdapterHealthSource(record.source) || latestBySource.has(record.source)) continue;
      latestBySource.set(record.source, toAdapterHealth(record));
    }

    return Array.from(latestBySource.values());
  }
}
