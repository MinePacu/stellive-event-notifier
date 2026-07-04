import { describe, expect, it, vi } from "vitest";
import { MemberProfileImageHydrator } from "../src/catalog/memberProfileImageHydrator.js";
import type {
  ChannelImageCacheRecord,
  ChannelImageCacheRepositoryPort,
} from "../src/repositories/channelImageCacheRepository.js";
import type { Member } from "../src/types.js";
import type { YoutubeFetchChannelProfilesResult } from "../src/adapters/youtube/youtubeDataApiClient.js";

describe("MemberProfileImageHydrator", () => {
  it("refreshes under the distributed lock and releases ownership", async () => {
    const cache = new FakeChannelImageCacheRepository();
    const release = vi.fn();
    const refreshLock = { acquire: vi.fn(async () => release) };
    const youtube = {
      fetchChannelProfilesByIds: vi.fn(async () => ({
        status: "ok" as const,
        profiles: [{
          channelId: "UC1",
          title: "Yuni",
          profileImageUrl: "https://yt.example/yuni.jpg",
          fetchedAt: "2026-06-30T00:00:00.000Z",
        }],
        quotaUnits: 1,
      })),
    };
    const hydrator = new MemberProfileImageHydrator({
      youtube,
      channelImageCache: cache,
      refreshLock,
    });

    await hydrator.hydrateMembers([member("ayatsuno-yuni", "UC1")]);

    expect(refreshLock.acquire).toHaveBeenCalledWith("youtube:UC1", 30_000);
    expect(youtube.fetchChannelProfilesByIds).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("does not call YouTube when another worker owns the refresh lock", async () => {
    const cache = new FakeChannelImageCacheRepository();
    const youtube = { fetchChannelProfilesByIds: vi.fn() };
    const hydrator = new MemberProfileImageHydrator({
      youtube,
      channelImageCache: cache,
      refreshLock: { acquire: vi.fn(async () => null) },
      refreshWaitMs: 1,
    });

    await hydrator.hydrateMembers([member("ayatsuno-yuni", "UC1")]);

    expect(youtube.fetchChannelProfilesByIds).not.toHaveBeenCalled();
    expect(cache.listCalls).toBe(2);
  });

  it("does not call YouTube when distributed lock acquisition fails", async () => {
    const cache = new FakeChannelImageCacheRepository();
    const youtube = { fetchChannelProfilesByIds: vi.fn() };
    const hydrator = new MemberProfileImageHydrator({
      youtube,
      channelImageCache: cache,
      refreshLock: { acquire: vi.fn(async () => { throw new Error("redis unavailable"); }) },
      refreshWaitMs: 1,
    });

    await hydrator.hydrateMembers([member("ayatsuno-yuni", "UC1")]);

    expect(youtube.fetchChannelProfilesByIds).not.toHaveBeenCalled();
    expect(cache.listCalls).toBe(2);
  });

  it("returns original members without calling YouTube when the cache read fails", async () => {
    const cache = new FakeChannelImageCacheRepository();
    cache.listError = new Error("channel image cache unavailable");
    const youtube = { fetchChannelProfilesByIds: vi.fn() };
    const hydrator = new MemberProfileImageHydrator({
      youtube,
      channelImageCache: cache,
    });
    const original = member("ayatsuno-yuni", "UC1");

    const members = await hydrator.hydrateMembers([original]);

    expect(members).toEqual([original]);
    expect(members[0]).not.toBe(original);
    expect(youtube.fetchChannelProfilesByIds).not.toHaveBeenCalled();
  });

  it("uses fresh cache without calling YouTube", async () => {
    const cache = new FakeChannelImageCacheRepository({
      UC1: {
        imageUrl: "https://yt.example/yuni.jpg",
        title: "Yuni",
        status: "fresh",
        refreshedAt: "2026-06-29T00:00:00.000Z",
      },
    });
    const youtube = { fetchChannelProfilesByIds: vi.fn() };
    const hydrator = new MemberProfileImageHydrator({
      youtube,
      channelImageCache: cache,
      now: () => new Date("2026-06-30T00:00:00.000Z"),
    });

    const members = await hydrator.hydrateMembers([member("ayatsuno-yuni", "UC1")]);

    expect(youtube.fetchChannelProfilesByIds).not.toHaveBeenCalled();
    expect(members[0].profileImageUrl).toBe("https://yt.example/yuni.jpg");
    expect(members[0].avatar.imageUrl).toBe("https://yt.example/yuni.jpg");
    expect(members[0].avatar.preferredSource).toBe("youtube_api");
  });

  it("refreshes missing cache entries once and hydrates members", async () => {
    const cache = new FakeChannelImageCacheRepository();
    const youtube = {
      fetchChannelProfilesByIds: vi.fn(async (channelIds: string[]) => ({
        status: "ok" as const,
        profiles: channelIds.map((channelId) => ({
          channelId,
          title: "Yuni",
          profileImageUrl: "https://yt.example/yuni.jpg",
          fetchedAt: "2026-06-30T00:00:00.000Z",
        })),
        quotaUnits: 1,
      })),
    };
    const hydrator = new MemberProfileImageHydrator({
      youtube,
      channelImageCache: cache,
      now: () => new Date("2026-06-30T00:00:00.000Z"),
    });

    const members = await hydrator.hydrateMembers([member("ayatsuno-yuni", "UC1")]);

    expect(youtube.fetchChannelProfilesByIds).toHaveBeenCalledWith(["UC1"]);
    expect(members[0].profileImageUrl).toBe("https://yt.example/yuni.jpg");
    expect(cache.records.get("UC1")?.status).toBe("fresh");
  });

  it("returns stale profile images when refresh fails", async () => {
    const cache = new FakeChannelImageCacheRepository({
      UC1: {
        imageUrl: "https://yt.example/stale-yuni.jpg",
        status: "fresh",
        refreshedAt: "2026-06-20T00:00:00.000Z",
      },
    });
    const youtube = {
      fetchChannelProfilesByIds: vi.fn(async (): Promise<YoutubeFetchChannelProfilesResult> => ({
        status: "quota_exceeded" as const,
        profiles: [] as [],
        quotaUnits: 1,
      })),
    };
    const hydrator = new MemberProfileImageHydrator({
      youtube,
      channelImageCache: cache,
      now: () => new Date("2026-06-30T00:00:00.000Z"),
    });

    const members = await hydrator.hydrateMembers([member("ayatsuno-yuni", "UC1")]);

    expect(members[0].profileImageUrl).toBe("https://yt.example/stale-yuni.jpg");
    expect(cache.records.get("UC1")?.status).toBe("stale");
    expect(cache.records.get("UC1")?.imageUrl).toBe("https://yt.example/stale-yuni.jpg");
  });

  it("does not retry a failed cache entry before nextRetryAt", async () => {
    const cache = new FakeChannelImageCacheRepository({
      UC1: {
        status: "failed",
        nextRetryAt: "2026-06-30T02:00:00.000Z",
        failureCount: 1,
      },
    });
    const youtube = { fetchChannelProfilesByIds: vi.fn() };
    const hydrator = new MemberProfileImageHydrator({
      youtube,
      channelImageCache: cache,
      now: () => new Date("2026-06-30T01:00:00.000Z"),
    });

    const members = await hydrator.hydrateMembers([member("ayatsuno-yuni", "UC1")]);

    expect(youtube.fetchChannelProfilesByIds).not.toHaveBeenCalled();
    expect(members[0].profileImageUrl).toBeUndefined();
  });

  it("rejects non-HTTPS profile URLs and records a retry", async () => {
    const cache = new FakeChannelImageCacheRepository();
    const youtube = {
      fetchChannelProfilesByIds: vi.fn(async () => ({
        status: "ok" as const,
        profiles: [{
          channelId: "UC1",
          title: "Yuni",
          profileImageUrl: "http://yt.example/yuni.jpg",
          fetchedAt: "2026-06-30T00:00:00.000Z",
        }],
        quotaUnits: 1,
      })),
    };
    const hydrator = new MemberProfileImageHydrator({
      youtube,
      channelImageCache: cache,
      now: () => new Date("2026-06-30T00:00:00.000Z"),
    });

    const members = await hydrator.hydrateMembers([member("ayatsuno-yuni", "UC1")]);

    expect(members[0].profileImageUrl).toBeUndefined();
    expect(cache.records.get("UC1")).toMatchObject({ status: "failed", failureCount: 1 });
  });
});

class FakeChannelImageCacheRepository implements ChannelImageCacheRepositoryPort {
  readonly records = new Map<string, ChannelImageCacheRecord>();
  listError?: Error;
  listCalls = 0;

  constructor(initial: Record<string, Partial<ChannelImageCacheRecord>> = {}) {
    Object.entries(initial).forEach(([key, value]) => {
      this.records.set(key, {
        source: "youtube",
        channelId: key,
        status: "missing",
        failureCount: 0,
        ...value,
      });
    });
  }

  async getByChannelId(_source: "youtube", channelId: string): Promise<ChannelImageCacheRecord | null> {
    return this.records.get(channelId) ?? null;
  }

  async listByChannelIds(_source: "youtube", channelIds: string[]): Promise<Map<string, ChannelImageCacheRecord>> {
    this.listCalls += 1;
    if (this.listError) throw this.listError;
    return new Map(channelIds.flatMap((channelId) => {
      const record = this.records.get(channelId);
      return record ? [[channelId, record]] : [];
    }));
  }

  async upsertSuccess(input: {
    source: "youtube";
    channelId: string;
    imageUrl: string;
    title?: string;
    refreshedAt: Date;
  }): Promise<void> {
    this.records.set(input.channelId, {
      ...input,
      refreshedAt: input.refreshedAt.toISOString(),
      status: "fresh",
      failureCount: 0,
    });
  }

  async markMissingOrFailed(input: {
    source: "youtube";
    channelId: string;
    reason: string;
    now: Date;
    keepExistingUrl?: boolean;
  }): Promise<void> {
    const previous = this.records.get(input.channelId);
    const failureCount = (previous?.failureCount ?? 0) + 1;
    this.records.set(input.channelId, {
      source: "youtube",
      channelId: input.channelId,
      imageUrl: input.keepExistingUrl ? previous?.imageUrl : undefined,
      title: previous?.title,
      refreshedAt: previous?.refreshedAt,
      status: input.keepExistingUrl && previous?.imageUrl ? "stale" : "failed",
      lastAttemptedAt: input.now.toISOString(),
      lastFailedAt: input.now.toISOString(),
      nextRetryAt: new Date(input.now.getTime() + 60 * 60 * 1_000).toISOString(),
      failureCount,
      failureReason: input.reason,
    });
  }
}

function member(id: string, youtubeChannelId: string): Member {
  return {
    id,
    koreanName: "아야츠노 유니",
    englishName: "Ayatsuno Yuni",
    generationId: "gen1",
    generationName: "1기생",
    unitName: "Everys",
    catalogRole: "member",
    activeStatus: "active",
    isPerson: true,
    avatar: { preferredSource: "placeholder", licenseStatus: "unknown" },
    platforms: {
      youtubeChannelId,
      externalUrls: {},
    },
    supportedEventTypes: [],
  };
}
