import { describe, expect, it, vi } from "vitest";
import { MusicChannelDiscoveryReclassificationService } from "../src/music/musicChannelDiscoveryReclassificationService.js";
import MusicChannelDiscoverySyncService from "../src/music/musicChannelDiscoverySyncService.js";
import { MusicSourceTypeRepairService } from "../src/music/musicSourceTypeRepairService.js";
import { InMemoryMusicSyncLock } from "../src/music/musicLocks.js";

const candidate = {
  videoId: "video-1",
  channelId: "channel-1",
  title: "New Song Cover",
  sourceUrl: "https://www.youtube.com/watch?v=video-1",
  publishedAt: "2026-06-25T00:00:00.000Z",
  updatedAt: "2026-06-25T00:00:00.000Z",
};

describe("MusicChannelDiscoverySyncService", () => {
  it("dedupes uploads, preserves official source, and links the channel member", async () => {
    const fetchVideos = vi.fn(async () => [{
      videoId: "video-1",
      channelId: "channel-1",
      title: "New Song Cover",
      description: "",
      tags: [],
      publishedAt: candidate.publishedAt,
      duration: "PT3M",
      privacyStatus: "public",
    }]);
    const upsertMusicItem = vi.fn(async (input) => ({ id: "music-1", ...input }));
    const replaceMusicItemMembers = vi.fn(async () => undefined);
    const service = new MusicChannelDiscoverySyncService({
      youtube: {
        getUploadsPlaylistId: async (channelId) => ({
          status: "ok",
          channelId,
          uploadsPlaylistId: `uploads-${channelId}`,
        }),
        listUploads: async () => ({
          status: "ok",
          candidates: [candidate],
          pagesFetched: 1,
          quotaUnits: 1,
        }),
        fetchVideos,
      },
      repository: {
        getMusicItemByVideoId: async () => ({ id: "music-1", sourcePlaylistId: "official-cover-source" }),
        getOverrideByVideoId: async () => null,
        upsertMusicItem,
        replaceMusicItemMembers,
      },
      locks: new InMemoryMusicSyncLock(),
      members: [{ id: "member-1", aliases: ["Member One"] }],
      targets: [
        { memberId: "member-1", channelId: "channel-1" },
        { memberId: "member-1", channelId: "channel-1" },
      ],
      maxPages: 1,
    });

    const result = await service.discover();

    expect(fetchVideos).toHaveBeenCalledWith(["video-1"]);
    expect(upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "video-1",
      type: "cover",
      sourcePlaylistId: "official-cover-source",
    }));
    expect(replaceMusicItemMembers).toHaveBeenCalledWith("music-1", [
      expect.objectContaining({ memberId: "member-1", source: "CHANNEL_ID" }),
    ]);
    expect(result).toMatchObject({ uniqueVideos: 1, inserted: 0, updated: 1 });
  });

  it("keeps official-channel songs without a member in review", async () => {
    const upsertMusicItem = vi.fn(async (input) => ({ id: "music-2", ...input }));
    const service = new MusicChannelDiscoverySyncService({
      youtube: {
        getUploadsPlaylistId: async (channelId) => ({ status: "ok", channelId, uploadsPlaylistId: "uploads" }),
        listUploads: async () => ({ status: "ok", candidates: [candidate], pagesFetched: 1, quotaUnits: 1 }),
        fetchVideos: async () => [{
          videoId: "video-1",
          channelId: "official-channel",
          title: "Official MV",
          description: "",
          tags: [],
          duration: "PT3M",
          privacyStatus: "public",
        }],
      },
      repository: {
        getMusicItemByVideoId: async () => null,
        getOverrideByVideoId: async () => null,
        upsertMusicItem,
        replaceMusicItemMembers: async () => undefined,
      },
      locks: new InMemoryMusicSyncLock(),
      members: [],
      targets: [{ channelId: "official-channel" }],
    });

    const result = await service.discover();

    expect(upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      classificationStatus: "NEEDS_REVIEW",
    }));
    expect(result).toMatchObject({ inserted: 1, needsReview: 1 });
  });

  it("skips member channel clips that only have generic cover tags", async () => {
    const upsertMusicItem = vi.fn(async (input) => ({ id: "music-3", ...input }));
    const replaceMusicItemMembers = vi.fn(async () => undefined);
    const service = new MusicChannelDiscoverySyncService({
      youtube: {
        getUploadsPlaylistId: async (channelId) => ({ status: "ok", channelId, uploadsPlaylistId: "uploads" }),
        listUploads: async () => ({
          status: "ok",
          candidates: [{ ...candidate, title: "선배 생활 최대 위기 발생" }],
          pagesFetched: 1,
          quotaUnits: 1,
        }),
        fetchVideos: async () => [{
          videoId: "video-1",
          channelId: "channel-1",
          title: "선배 생활 최대 위기 발생",
          description: "치지직 생방송과 다시보기 링크",
          tags: ["스텔라이브", "cover", "커버곡", "여자커버"],
          duration: "PT3M",
          privacyStatus: "public",
        }],
      },
      repository: {
        getMusicItemByVideoId: async () => null,
        getOverrideByVideoId: async () => null,
        upsertMusicItem,
        replaceMusicItemMembers,
      },
      locks: new InMemoryMusicSyncLock(),
      members: [{ id: "member-1", aliases: ["Member One"], youtubeChannelId: "channel-1" }],
      targets: [{ memberId: "member-1", channelId: "channel-1" }],
    });

    const result = await service.discover();

    expect(upsertMusicItem).not.toHaveBeenCalled();
    expect(replaceMusicItemMembers).not.toHaveBeenCalled();
    expect(result).toMatchObject({ uniqueVideos: 1, inserted: 0, updated: 0 });
  });

  it("preserves source-backed original type when channel discovery sees the same upload", async () => {
    const upsertMusicItem = vi.fn(async (input) => ({ id: "music-original", ...input }));
    const service = new MusicChannelDiscoverySyncService({
      youtube: {
        getUploadsPlaylistId: async (channelId) => ({ status: "ok", channelId, uploadsPlaylistId: "uploads" }),
        listUploads: async () => ({
          status: "ok",
          candidates: [{ ...candidate, videoId: "original-1", title: "스텔라이브 Universe | 마음악보 Cover" }],
          pagesFetched: 1,
          quotaUnits: 1,
        }),
        fetchVideos: async () => [{
          videoId: "original-1",
          channelId: "official-channel",
          title: "스텔라이브 Universe | 마음악보 Cover",
          description: "",
          tags: ["cover"],
          duration: "PT3M",
          privacyStatus: "public",
        }],
      },
      repository: {
        getMusicItemByVideoId: async () => ({
          id: "music-original",
          sourcePlaylistId: "official-original-source",
          type: "original",
          rawCategoryHint: "ORIGINAL",
        }),
        getOverrideByVideoId: async () => null,
        upsertMusicItem,
        replaceMusicItemMembers: async () => undefined,
      },
      locks: new InMemoryMusicSyncLock(),
      members: [],
      targets: [{ channelId: "official-channel" }],
    });

    const result = await service.discover();

    expect(upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "original-1",
      type: "original",
      sourcePlaylistId: "official-original-source",
      rawCategoryHint: "ORIGINAL",
    }));
    expect(result).toMatchObject({ updated: 1 });
  });

  it("lets manual type overrides win over source-backed discovery preservation", async () => {
    const upsertMusicItem = vi.fn(async (input) => ({ id: "music-manual", ...input }));
    const service = new MusicChannelDiscoverySyncService({
      youtube: {
        getUploadsPlaylistId: async (channelId) => ({ status: "ok", channelId, uploadsPlaylistId: "uploads" }),
        listUploads: async () => ({
          status: "ok",
          candidates: [{ ...candidate, videoId: "manual-1", title: "Manual Cover" }],
          pagesFetched: 1,
          quotaUnits: 1,
        }),
        fetchVideos: async () => [{
          videoId: "manual-1",
          channelId: "channel-1",
          title: "Manual Cover",
          description: "",
          tags: [],
          duration: "PT3M",
          privacyStatus: "public",
        }],
      },
      repository: {
        getMusicItemByVideoId: async () => ({
          id: "music-manual",
          sourcePlaylistId: "official-original-source",
          type: "original",
          rawCategoryHint: "ORIGINAL",
        }),
        getOverrideByVideoId: async () => ({ forcedType: "cover" }),
        upsertMusicItem,
        replaceMusicItemMembers: async () => undefined,
      },
      locks: new InMemoryMusicSyncLock(),
      members: [],
      targets: [{ channelId: "channel-1" }],
    });

    await service.discover();

    expect(upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "manual-1",
      type: "cover",
      sourcePlaylistId: "official-original-source",
      rawCategoryHint: "ORIGINAL",
      classificationStatus: "MANUAL_CONFIRMED",
    }));
  });
});

describe("MusicChannelDiscoveryReclassificationService", () => {
  it("hides existing discovered clips that only matched generic cover tags", async () => {
    const updateMusicItemClassification = vi.fn(async () => undefined);
    const service = new MusicChannelDiscoveryReclassificationService({
      repository: {
        listDiscoveredMusicItemsForReclassification: async () => [{
          id: "music-1",
          youtubeVideoId: "video-1",
          title: "선배 생활 최대 위기 발생",
          description: "치지직 생방송과 다시보기 링크",
          type: "cover",
          duration: "PT3M",
          privacyStatus: "public",
          tags: ["스텔라이브", "cover", "커버곡"],
          classificationStatus: "AUTO_CLASSIFIED",
        }],
        updateMusicItemClassification,
      },
    });

    await expect(service.reclassify()).resolves.toEqual({
      status: "ok",
      checked: 1,
      hidden: 1,
      kept: 0,
      manualSkipped: 0,
    });
    expect(updateMusicItemClassification).toHaveBeenCalledWith("music-1", expect.objectContaining({
      classificationStatus: "NEEDS_REVIEW",
      isExcluded: true,
      exclusionReason: "non_music_upload",
    }));
  });
});

describe("MusicSourceTypeRepairService", () => {
  it("repairs source-backed type mismatches and skips manual rows", async () => {
    const repairMusicItemSourceType = vi.fn(async () => undefined);
    const service = new MusicSourceTypeRepairService({
      repository: {
        listSourceTypeMismatches: async () => [
          {
            id: "music-1",
            youtubeVideoId: "video-1",
            title: "Original Song",
            type: "cover",
            rawCategoryHint: "COVER",
            classificationStatus: "AUTO_CLASSIFIED",
            sourcePlaylist: { type: "original", rawCategoryHint: "ORIGINAL" },
          },
          {
            id: "music-2",
            youtubeVideoId: "video-2",
            title: "Manual Song",
            type: "cover",
            rawCategoryHint: "COVER",
            classificationStatus: "MANUAL_CONFIRMED",
            sourcePlaylist: { type: "original", rawCategoryHint: "ORIGINAL" },
          },
        ],
        repairMusicItemSourceType,
      },
    });

    await expect(service.repair()).resolves.toEqual({
      status: "ok",
      checked: 2,
      repaired: 1,
      manualSkipped: 1,
    });
    expect(repairMusicItemSourceType).toHaveBeenCalledWith("music-1", "original", "ORIGINAL");
  });
});
