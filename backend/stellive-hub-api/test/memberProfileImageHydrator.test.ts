import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { MemberProfileImageHydrator } from "../src/catalog/memberProfileImageHydrator.js";
import type { PlatformApiStateRecord } from "../src/repositories/platformApiStateRepository.js";
import type { Member } from "../src/types.js";
import type { YoutubeFetchChannelProfilesResult } from "../src/adapters/youtube/youtubeDataApiClient.js";

describe("MemberProfileImageHydrator", () => {
  it("uses fresh cache without calling YouTube", async () => {
    const state = new FakeStateRepository({
      UC1: {
        memberId: "ayatsuno-yuni",
        profileImageUrl: "https://yt.example/yuni.jpg",
        fetchedAt: "2026-06-29T00:00:00.000Z",
        expiresAt: "2026-07-01T00:00:00.000Z",
      },
    });
    const youtube = { fetchChannelProfilesByIds: vi.fn() };
    const hydrator = new MemberProfileImageHydrator({
      youtube,
      stateRepository: state,
      now: () => new Date("2026-06-30T00:00:00.000Z"),
    });

    const members = await hydrator.hydrateMembers([member("ayatsuno-yuni", "UC1")]);

    expect(youtube.fetchChannelProfilesByIds).not.toHaveBeenCalled();
    expect(members[0].profileImageUrl).toBe("https://yt.example/yuni.jpg");
    expect(members[0].avatar.imageUrl).toBe("https://yt.example/yuni.jpg");
    expect(members[0].avatar.preferredSource).toBe("youtube_api");
  });

  it("refreshes missing cache entries once and hydrates members", async () => {
    const state = new FakeStateRepository();
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
      stateRepository: state,
      now: () => new Date("2026-06-30T00:00:00.000Z"),
    });

    const members = await hydrator.hydrateMembers([member("ayatsuno-yuni", "UC1")]);

    expect(youtube.fetchChannelProfilesByIds).toHaveBeenCalledWith(["UC1"]);
    expect(members[0].profileImageUrl).toBe("https://yt.example/yuni.jpg");
    expect(state.records.get("UC1")?.status).toBe("fresh");
  });

  it("returns stale profile images when refresh fails", async () => {
    const state = new FakeStateRepository({
      UC1: {
        memberId: "ayatsuno-yuni",
        profileImageUrl: "https://yt.example/stale-yuni.jpg",
        fetchedAt: "2026-06-28T00:00:00.000Z",
        expiresAt: "2026-06-29T00:00:00.000Z",
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
      stateRepository: state,
      now: () => new Date("2026-06-30T00:00:00.000Z"),
    });

    const members = await hydrator.hydrateMembers([member("ayatsuno-yuni", "UC1")]);

    expect(members[0].profileImageUrl).toBe("https://yt.example/stale-yuni.jpg");
    expect(state.records.get("UC1")?.status).toBe("stale");
  });
});

class FakeStateRepository {
  readonly records = new Map<string, { value: Prisma.JsonValue; status: string }>();

  constructor(initial: Record<string, Record<string, unknown>> = {}) {
    Object.entries(initial).forEach(([key, value]) => {
      this.records.set(key, { value: value as Prisma.JsonValue, status: "fresh" });
    });
  }

  async getState(source: string, key: string): Promise<PlatformApiStateRecord | null> {
    const record = this.records.get(key);
    if (!record) return null;
    return {
      source,
      key,
      value: record.value,
      status: record.status,
      updatedAt: new Date("2026-06-30T00:00:00.000Z"),
    };
  }

  async upsertState(_source: string, key: string, value: Prisma.InputJsonValue, status: string): Promise<void> {
    this.records.set(key, { value: value as Prisma.JsonValue, status });
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
