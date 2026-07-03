import { describe, expect, it } from "vitest";
import {
  ChannelImageCacheRepository,
  nextRetryDelayMs,
} from "../src/repositories/channelImageCacheRepository.js";

describe("ChannelImageCacheRepository", () => {
  it("stores and returns HTTPS channel image metadata", async () => {
    const delegate = new FakeChannelImageCacheDelegate();
    const repository = new ChannelImageCacheRepository({ channelImageCache: delegate });
    const refreshedAt = new Date("2026-07-03T00:00:00.000Z");

    await repository.upsertSuccess({
      source: "youtube",
      channelId: "UC1",
      imageUrl: "https://yt.example/channel.jpg",
      title: "Channel",
      refreshedAt,
    });

    await expect(repository.getByChannelId("youtube", "UC1")).resolves.toMatchObject({
      source: "youtube",
      channelId: "UC1",
      imageUrl: "https://yt.example/channel.jpg",
      title: "Channel",
      status: "fresh",
      refreshedAt: refreshedAt.toISOString(),
      failureCount: 0,
    });
  });

  it("rejects non-HTTPS image metadata", async () => {
    const delegate = new FakeChannelImageCacheDelegate();
    const repository = new ChannelImageCacheRepository({ channelImageCache: delegate });

    await expect(repository.upsertSuccess({
      source: "youtube",
      channelId: "UC1",
      imageUrl: "data:image/png;base64,abc",
      refreshedAt: new Date("2026-07-03T00:00:00.000Z"),
    })).rejects.toThrow("HTTPS");
    expect(delegate.records.size).toBe(0);
  });

  it("applies capped exponential retry delays", () => {
    expect(nextRetryDelayMs(1)).toBe(60 * 60 * 1_000);
    expect(nextRetryDelayMs(2)).toBe(2 * 60 * 60 * 1_000);
    expect(nextRetryDelayMs(3)).toBe(4 * 60 * 60 * 1_000);
    expect(nextRetryDelayMs(4)).toBe(6 * 60 * 60 * 1_000);
    expect(nextRetryDelayMs(8)).toBe(6 * 60 * 60 * 1_000);
  });

  it("keeps a last known HTTPS URL when refresh fails", async () => {
    const delegate = new FakeChannelImageCacheDelegate();
    const repository = new ChannelImageCacheRepository({ channelImageCache: delegate });
    const initialRefresh = new Date("2026-06-20T00:00:00.000Z");
    const failedAt = new Date("2026-07-03T00:00:00.000Z");
    await repository.upsertSuccess({
      source: "youtube",
      channelId: "UC1",
      imageUrl: "https://yt.example/channel.jpg",
      refreshedAt: initialRefresh,
    });

    await repository.markMissingOrFailed({
      source: "youtube",
      channelId: "UC1",
      reason: "quota_exceeded",
      now: failedAt,
      keepExistingUrl: true,
    });

    await expect(repository.getByChannelId("youtube", "UC1")).resolves.toMatchObject({
      imageUrl: "https://yt.example/channel.jpg",
      status: "stale",
      refreshedAt: initialRefresh.toISOString(),
      lastFailedAt: failedAt.toISOString(),
      nextRetryAt: new Date(failedAt.getTime() + 60 * 60 * 1_000).toISOString(),
      failureCount: 1,
      failureReason: "quota_exceeded",
    });
  });
});

type CacheRow = {
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
};

class FakeChannelImageCacheDelegate {
  readonly records = new Map<string, CacheRow>();

  async findUnique({ where }: any): Promise<CacheRow | null> {
    return this.records.get(`${where.source_channelId.source}:${where.source_channelId.channelId}`) ?? null;
  }

  async findMany({ where }: any): Promise<CacheRow[]> {
    return [...this.records.values()].filter((record) =>
      record.source === where.source && where.channelId.in.includes(record.channelId));
  }

  async upsert({ where, create, update }: any): Promise<CacheRow> {
    const key = `${where.source_channelId.source}:${where.source_channelId.channelId}`;
    const existing = this.records.get(key);
    const record = { ...(existing ?? create), ...(existing ? update : {}) } as CacheRow;
    this.records.set(key, record);
    return record;
  }
}
