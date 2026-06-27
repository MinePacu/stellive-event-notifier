import { describe, expect, it, vi } from "vitest";
import MusicChannelDiscoverySyncService from "../src/music/musicChannelDiscoverySyncService.js";
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
});
