import { getPrismaClient } from "../storage/prisma.js";

export type ChannelImageCacheStatus = "fresh" | "stale" | "missing" | "failed";
export type ChannelImageCacheSource = "youtube";

export interface ChannelImageCacheRecord {
  source: ChannelImageCacheSource;
  channelId: string;
  imageUrl?: string;
  title?: string;
  status: ChannelImageCacheStatus;
  refreshedAt?: string;
  lastAttemptedAt?: string;
  lastFailedAt?: string;
  nextRetryAt?: string;
  failureCount: number;
  failureReason?: string;
}

export interface ChannelImageCacheRepositoryPort {
  getByChannelId(source: ChannelImageCacheSource, channelId: string): Promise<ChannelImageCacheRecord | null>;
  listByChannelIds(source: ChannelImageCacheSource, channelIds: string[]): Promise<Map<string, ChannelImageCacheRecord>>;
  upsertSuccess(input: {
    source: ChannelImageCacheSource;
    channelId: string;
    imageUrl: string;
    title?: string;
    refreshedAt: Date;
  }): Promise<void>;
  markMissingOrFailed(input: {
    source: ChannelImageCacheSource;
    channelId: string;
    reason: string;
    now: Date;
    keepExistingUrl?: boolean;
  }): Promise<void>;
}

interface ChannelImageCacheRow {
  source: string;
  channelId: string;
  imageUrl: string | null;
  title: string | null;
  status: string;
  refreshedAt: Date | null;
  lastAttemptedAt: Date | null;
  lastFailedAt: Date | null;
  nextRetryAt: Date | null;
  failureCount: number;
  failureReason: string | null;
}

interface ChannelImageCacheData extends ChannelImageCacheRow {}

interface ChannelImageCacheDelegate {
  channelImageCache: {
    findUnique(input: {
      where: { source_channelId: { source: string; channelId: string } };
    }): Promise<ChannelImageCacheRow | null>;
    findMany(input: {
      where: { source: string; channelId: { in: string[] } };
    }): Promise<ChannelImageCacheRow[]>;
    upsert(input: {
      where: { source_channelId: { source: string; channelId: string } };
      create: ChannelImageCacheData;
      update: Partial<ChannelImageCacheData>;
    }): Promise<ChannelImageCacheRow>;
  };
}

const validStatuses = new Set<ChannelImageCacheStatus>(["fresh", "stale", "missing", "failed"]);

export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function nextRetryDelayMs(failureCount: number): number {
  const hours = Math.min(6, Math.max(1, 2 ** Math.max(0, failureCount - 1)));
  return hours * 60 * 60 * 1_000;
}

function toOptionalIso(value: Date | null): string | undefined {
  return value?.toISOString();
}

function toRecord(row: ChannelImageCacheRow): ChannelImageCacheRecord {
  return {
    source: "youtube",
    channelId: row.channelId,
    imageUrl: isHttpsUrl(row.imageUrl) ? row.imageUrl : undefined,
    title: row.title ?? undefined,
    status: validStatuses.has(row.status as ChannelImageCacheStatus)
      ? row.status as ChannelImageCacheStatus
      : "failed",
    refreshedAt: toOptionalIso(row.refreshedAt),
    lastAttemptedAt: toOptionalIso(row.lastAttemptedAt),
    lastFailedAt: toOptionalIso(row.lastFailedAt),
    nextRetryAt: toOptionalIso(row.nextRetryAt),
    failureCount: row.failureCount,
    failureReason: row.failureReason ?? undefined,
  };
}

export class ChannelImageCacheRepository implements ChannelImageCacheRepositoryPort {
  constructor(
    private readonly prisma: ChannelImageCacheDelegate = getPrismaClient() as unknown as ChannelImageCacheDelegate,
  ) {}

  async getByChannelId(source: ChannelImageCacheSource, channelId: string): Promise<ChannelImageCacheRecord | null> {
    const row = await this.prisma.channelImageCache.findUnique({
      where: { source_channelId: { source, channelId } },
    });
    return row ? toRecord(row) : null;
  }

  async listByChannelIds(
    source: ChannelImageCacheSource,
    channelIds: string[],
  ): Promise<Map<string, ChannelImageCacheRecord>> {
    const uniqueIds = [...new Set(channelIds.filter(Boolean))];
    if (uniqueIds.length === 0) return new Map();
    const rows = await this.prisma.channelImageCache.findMany({
      where: { source, channelId: { in: uniqueIds } },
    });
    return new Map(rows.map((row) => [row.channelId, toRecord(row)]));
  }

  async upsertSuccess(input: {
    source: ChannelImageCacheSource;
    channelId: string;
    imageUrl: string;
    title?: string;
    refreshedAt: Date;
  }): Promise<void> {
    if (!isHttpsUrl(input.imageUrl)) {
      throw new TypeError("Channel image cache accepts HTTPS URL metadata only");
    }
    const data: ChannelImageCacheData = {
      source: input.source,
      channelId: input.channelId,
      imageUrl: input.imageUrl,
      title: input.title ?? null,
      status: "fresh",
      refreshedAt: input.refreshedAt,
      lastAttemptedAt: input.refreshedAt,
      lastFailedAt: null,
      nextRetryAt: null,
      failureCount: 0,
      failureReason: null,
    };
    await this.prisma.channelImageCache.upsert({
      where: { source_channelId: { source: input.source, channelId: input.channelId } },
      create: data,
      update: data,
    });
  }

  async markMissingOrFailed(input: {
    source: ChannelImageCacheSource;
    channelId: string;
    reason: string;
    now: Date;
    keepExistingUrl?: boolean;
  }): Promise<void> {
    const where = { source_channelId: { source: input.source, channelId: input.channelId } };
    const existing = await this.prisma.channelImageCache.findUnique({ where });
    const failureCount = (existing?.failureCount ?? 0) + 1;
    const imageUrl = input.keepExistingUrl !== false && isHttpsUrl(existing?.imageUrl)
      ? existing.imageUrl
      : null;
    const status: ChannelImageCacheStatus = imageUrl
      ? "stale"
      : input.reason.includes("missing") ? "missing" : "failed";
    const nextRetryAt = new Date(input.now.getTime() + nextRetryDelayMs(failureCount));
    const data: ChannelImageCacheData = {
      source: input.source,
      channelId: input.channelId,
      imageUrl,
      title: existing?.title ?? null,
      status,
      refreshedAt: existing?.refreshedAt ?? null,
      lastAttemptedAt: input.now,
      lastFailedAt: input.now,
      nextRetryAt,
      failureCount,
      failureReason: input.reason,
    };
    await this.prisma.channelImageCache.upsert({ where, create: data, update: data });
  }
}
