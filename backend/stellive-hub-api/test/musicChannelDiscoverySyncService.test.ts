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
  it("limits official discovery to 10 items, dedupes by video id, and stores premiere metadata only once", async () => {
    const listUploads = vi.fn(async () => ({
      status: "ok" as const,
      candidates: [candidate, { ...candidate }],
      pagesFetched: 1,
      quotaUnits: 1,
    }));
    const upsertMusicItem = vi.fn(async (input) => ({ id: "official-music-1", ...input }));
    const ingestYoutubeUpload = vi.fn(async () => ({ ingested: false as const, reason: "unsupported_song_generation" as const }));
    const service = new MusicChannelDiscoverySyncService({
      youtube: {
        getUploadsPlaylistId: async (channelId) => ({ status: "ok", channelId, uploadsPlaylistId: "official-uploads" }),
        listUploads,
        fetchVideos: async () => ({ status: "ok" as const, items: [{
          videoId: "video-1",
          channelId: "official-channel",
          title: "Official Song Cover",
          description: "",
          tags: ["cover"],
          duration: "PT3M",
          privacyStatus: "public",
          liveBroadcastContent: "upcoming",
          scheduledStartTime: "2026-07-01T12:00:00.000Z",
        }] }),
      },
      repository: {
        getMusicItemByVideoId: async () => null,
        getOverrideByVideoId: async () => null,
        upsertMusicItem,
        replaceMusicItemMembers: async () => undefined,
      },
      songIngestion: { ingestYoutubeUpload },
      locks: new InMemoryMusicSyncLock(),
      members: [],
      targets: [{ kind: "stellive_official", channelId: "official-channel", maxResults: 10 }],
    });

    const result = await service.discover();

    expect(listUploads).toHaveBeenCalledWith(expect.objectContaining({ maxResults: 10 }));
    expect(upsertMusicItem).toHaveBeenCalledTimes(1);
    expect(upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "video-1",
      youtubePresentationType: "premiere_assumed",
      youtubePremiereState: "scheduled",
      youtubeScheduledStartAt: "2026-07-01T12:00:00.000Z",
    }));
    expect(ingestYoutubeUpload).not.toHaveBeenCalled();
    expect(result).toMatchObject({ uniqueVideos: 1, inserted: 1 });
  });

  it("reuses fresh completed metadata without spending a video detail request", async () => {
    const fetchVideos = vi.fn(async () => ({ status: "ok" as const, items: [] }));
    const upsertMusicItem = vi.fn(async (input) => ({ id: "music-1", ...input }));
    const service = new MusicChannelDiscoverySyncService({
      youtube: {
        getUploadsPlaylistId: async (channelId) => ({ status: "ok", channelId, uploadsPlaylistId: "uploads" }),
        listUploads: async () => ({ status: "ok", candidates: [candidate], pagesFetched: 1, quotaUnits: 1 }),
        fetchVideos,
      },
      repository: {
        getMusicItemsByVideoIds: async () => [{
          id: "music-1",
          youtubeVideoId: "video-1",
          title: "New Song Cover",
          type: "cover",
          channelId: "channel-1",
          duration: "PT3M",
          privacyStatus: "public",
          publishedAt: new Date(candidate.publishedAt),
          youtubePresentationType: "premiere_assumed",
          youtubePremiereState: "completed",
          youtubeScheduledStartAt: new Date("2026-06-25T00:00:00.000Z"),
          youtubeActualStartAt: new Date("2026-06-25T00:00:00.000Z"),
          youtubeActualEndAt: new Date("2026-06-25T00:03:00.000Z"),
          youtubeMetadataFetchedAt: new Date("2026-06-28T00:00:00.000Z"),
        }],
        getMusicItemByVideoId: async () => ({ id: "music-1" }),
        getOverrideByVideoId: async () => null,
        upsertMusicItem,
        replaceMusicItemMembers: async () => undefined,
      },
      locks: new InMemoryMusicSyncLock(),
      members: [{ id: "member-1", aliases: ["Member One"] }],
      targets: [{ kind: "member", memberId: "member-1", channelId: "channel-1" }],
      now: () => new Date("2026-06-28T12:00:00.000Z"),
    });

    await service.discover();

    expect(fetchVideos).not.toHaveBeenCalled();
    expect(upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubePremiereState: "completed",
      youtubePresentationType: "premiere_assumed",
      youtubeActualEndAt: "2026-06-25T00:03:00.000Z",
    }));
  });

  it("dedupes uploads, preserves official source, and links the channel member", async () => {
    const fetchVideos = vi.fn(async () => ({ status: "ok" as const, items: [{
      videoId: "video-1",
      channelId: "channel-1",
      title: "New Song Cover",
      description: "",
      tags: [],
      publishedAt: candidate.publishedAt,
      duration: "PT3M",
      privacyStatus: "public",
    }] }));
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
        { kind: "member", memberId: "member-1", channelId: "channel-1" },
        { kind: "member", memberId: "member-1", channelId: "channel-1" },
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
        fetchVideos: async () => ({ status: "ok" as const, items: [{
          videoId: "video-1",
          channelId: "official-channel",
          title: "Official MV",
          description: "",
          tags: [],
          duration: "PT3M",
          privacyStatus: "public",
        }] }),
      },
      repository: {
        getMusicItemByVideoId: async () => null,
        getOverrideByVideoId: async () => null,
        upsertMusicItem,
        replaceMusicItemMembers: async () => undefined,
      },
      locks: new InMemoryMusicSyncLock(),
      members: [],
      targets: [{ kind: "stellive_official", channelId: "official-channel" }],
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
        fetchVideos: async () => ({ status: "ok" as const, items: [{
          videoId: "video-1",
          channelId: "channel-1",
          title: "선배 생활 최대 위기 발생",
          description: "치지직 생방송과 다시보기 링크",
          tags: ["스텔라이브", "cover", "커버곡", "여자커버"],
          duration: "PT3M",
          privacyStatus: "public",
        }] }),
      },
      repository: {
        getMusicItemByVideoId: async () => null,
        getOverrideByVideoId: async () => null,
        upsertMusicItem,
        replaceMusicItemMembers,
      },
      locks: new InMemoryMusicSyncLock(),
      members: [{ id: "member-1", aliases: ["Member One"], youtubeChannelId: "channel-1" }],
      targets: [{ kind: "member", memberId: "member-1", channelId: "channel-1" }],
    });

    const result = await service.discover();

    expect(upsertMusicItem).not.toHaveBeenCalled();
    expect(replaceMusicItemMembers).not.toHaveBeenCalled();
    expect(result).toMatchObject({ uniqueVideos: 1, inserted: 0, updated: 0 });
  });

  it("auto-classifies a long Playlist upload from a registered member channel", async () => {
    const playlistCandidate = {
      ...candidate,
      videoId: "X7pjwim9NHE",
      title: "[Playlist] 새벽 감성 노래 모음",
    };
    const upsertMusicItem = vi.fn(async (input) => ({ id: "music-playlist", ...input }));
    const replaceMusicItemMembers = vi.fn(async () => undefined);
    const service = new MusicChannelDiscoverySyncService({
      youtube: {
        getUploadsPlaylistId: async (channelId) => ({ status: "ok", channelId, uploadsPlaylistId: "uploads" }),
        listUploads: async () => ({ status: "ok", candidates: [playlistCandidate], pagesFetched: 1, quotaUnits: 1 }),
        fetchVideos: async () => ({ status: "ok" as const, items: [{
          videoId: "X7pjwim9NHE",
          channelId: "channel-1",
          title: "[Playlist] 새벽 감성 노래 모음",
          description: "여러 커버곡을 모았습니다.",
          tags: ["music"],
          duration: "PT39M12S",
          privacyStatus: "public",
          liveBroadcastContent: "none",
        }] }),
      },
      repository: {
        getMusicItemByVideoId: async () => null,
        getOverrideByVideoId: async () => null,
        upsertMusicItem,
        replaceMusicItemMembers,
      },
      locks: new InMemoryMusicSyncLock(),
      members: [{ id: "member-1", aliases: ["Member One"], youtubeChannelId: "channel-1" }],
      targets: [{ kind: "member", memberId: "member-1", channelId: "channel-1" }],
    });

    const result = await service.discover();

    expect(upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "X7pjwim9NHE",
      type: "cover",
      classificationStatus: "AUTO_CLASSIFIED",
      isExcluded: false,
      specialFlags: ["playlist_compilation", "live_or_long_form"],
    }));
    expect(replaceMusicItemMembers).toHaveBeenCalledWith("music-playlist", [
      expect.objectContaining({ memberId: "member-1", source: "CHANNEL_ID" }),
    ]);
    expect(result).toMatchObject({ inserted: 1, needsReview: 0 });
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
        fetchVideos: async () => ({ status: "ok" as const, items: [{
          videoId: "original-1",
          channelId: "official-channel",
          title: "스텔라이브 Universe | 마음악보 Cover",
          description: "",
          tags: ["cover"],
          duration: "PT3M",
          privacyStatus: "public",
        }] }),
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
      targets: [{ kind: "stellive_official", channelId: "official-channel" }],
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
          candidates: [{
            ...candidate,
            videoId: "manual-1",
            title: "유즈하 리코(Yuzuha Riko) | 수동 원곡 'Manual Original'",
          }],
          pagesFetched: 1,
          quotaUnits: 1,
        }),
        fetchVideos: async () => ({ status: "ok" as const, items: [{
          videoId: "manual-1",
          channelId: "channel-1",
          title: "유즈하 리코(Yuzuha Riko) | 수동 원곡 'Manual Original'",
          description: "",
          tags: [],
          duration: "PT3M",
          privacyStatus: "public",
        }] }),
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
      members: [{
        id: "yuzuha-riko",
        nameKo: "유즈하 리코",
        nameEn: "Yuzuha Riko",
        unitName: "Cliche",
        aliases: ["유즈하 리코", "Yuzuha Riko"],
      }],
      targets: [{ kind: "stellive_official", channelId: "channel-1" }],
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

  it("collects fixed structured-original fixtures by title, reviews partials, and ignores ordinary quoted uploads", async () => {
    const fixtures = [
      {
        ...candidate,
        videoId: "P_oxx3_VpIY",
        title: "유즈하 리코(Yuzuha Riko) | '악당주의보'",
      },
      {
        ...candidate,
        videoId: "nsZmnwC9ukE",
        title: "스텔라이브 (STELLIVE) Cliche | '우리의 노래'",
      },
      {
        ...candidate,
        videoId: "partial-structured",
        title: "유즈하 리코(Yuzuha Riko) | 악당주의보",
      },
      {
        ...candidate,
        videoId: "ordinary-quoted",
        title: "게임 방송 | '오늘의 하이라이트'",
      },
    ];
    const upsertMusicItem = vi.fn(async (input) => ({ id: `music-${input.youtubeVideoId}`, ...input }));
    const replaceMusicItemMembers = vi.fn(async () => undefined);
    const service = new MusicChannelDiscoverySyncService({
      youtube: {
        getUploadsPlaylistId: async (channelId) => ({ status: "ok", channelId, uploadsPlaylistId: "uploads" }),
        listUploads: async () => ({ status: "ok", candidates: fixtures, pagesFetched: 1, quotaUnits: 1 }),
        fetchVideos: async (videoIds) => ({ status: "ok" as const, items: fixtures
          .filter((fixture) => videoIds.includes(fixture.videoId))
          .map((fixture) => ({
            videoId: fixture.videoId,
            channelId: "official-channel",
            title: fixture.title,
            description: "",
            tags: [],
            duration: "PT3M",
            privacyStatus: "public",
          })) }),
      },
      repository: {
        getMusicItemByVideoId: async () => null,
        getOverrideByVideoId: async () => null,
        upsertMusicItem,
        replaceMusicItemMembers,
      },
      locks: new InMemoryMusicSyncLock(),
      members: [
        {
          id: "aokumo-rin",
          nameKo: "아오쿠모 린",
          nameEn: "Aokumo Rin",
          unitName: "Cliche",
          aliases: ["아오쿠모 린", "Aokumo Rin"],
        },
        {
          id: "yuzuha-riko",
          nameKo: "유즈하 리코",
          nameEn: "Yuzuha Riko",
          unitName: "Cliche",
          aliases: ["유즈하 리코", "Yuzuha Riko"],
        },
      ],
      targets: [{ kind: "stellive_official", channelId: "official-channel" }],
    });

    await expect(service.discover()).resolves.toMatchObject({
      uniqueVideos: 4,
      inserted: 3,
      needsReview: 2,
    });
    expect(upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "P_oxx3_VpIY",
      type: "original",
      classificationStatus: "NEEDS_REVIEW",
      isExcluded: true,
      exclusionReason: "member_title_on_official_channel",
      specialFlags: [
        "structured_original_title",
        "structured_original_member_on_official_channel",
      ],
    }));
    expect(upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "nsZmnwC9ukE",
      type: "original",
      classificationStatus: "AUTO_CLASSIFIED",
    }));
    expect(upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "partial-structured",
      type: "unknown",
      classificationStatus: "NEEDS_REVIEW",
      isExcluded: true,
      rawCategoryHint: "UNKNOWN",
      specialFlags: [
        "partial_structured_original_title",
        "structured_original_malformed_song_quotes",
      ],
    }));
    expect(upsertMusicItem).not.toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "ordinary-quoted",
    }));
    expect(replaceMusicItemMembers).toHaveBeenCalledWith("music-P_oxx3_VpIY", [{
      memberId: "yuzuha-riko",
      role: "main",
      confidence: 0.95,
      source: "STRUCTURED_TITLE",
    }]);
    expect(replaceMusicItemMembers).toHaveBeenCalledWith("music-nsZmnwC9ukE", [
      expect.objectContaining({ memberId: "aokumo-rin", role: "group", source: "STRUCTURED_TITLE" }),
      expect.objectContaining({ memberId: "yuzuha-riko", role: "group", source: "STRUCTURED_TITLE" }),
    ]);
  });

  it("classifies the Tenko bilingual regression from a trusted member channel without unit expansion", async () => {
    const title =
      "텐코 시부키(Tenko Shibuki) | 베리 베리 스트로베리 'Berry Verry Strawberry'";
    const shibukiCandidate = {
      ...candidate,
      videoId: "nsZmnwC9ukE",
      channelId: "shibuki-channel",
      title,
    };
    const upsertMusicItem = vi.fn(async (input) => ({ id: "music-shibuki", ...input }));
    const replaceMusicItemMembers = vi.fn(async () => undefined);
    const service = new MusicChannelDiscoverySyncService({
      youtube: {
        getUploadsPlaylistId: async (channelId) => ({ status: "ok", channelId, uploadsPlaylistId: "uploads" }),
        listUploads: async () => ({
          status: "ok",
          candidates: [shibukiCandidate],
          pagesFetched: 1,
          quotaUnits: 1,
        }),
        fetchVideos: async () => ({ status: "ok" as const, items: [{
          videoId: "nsZmnwC9ukE",
          channelId: "shibuki-channel",
          title,
          description: "STELLIVE Cliche 1st EP",
          tags: [],
          duration: "PT3M",
          privacyStatus: "public",
        }] }),
      },
      repository: {
        getMusicItemByVideoId: async () => null,
        getOverrideByVideoId: async () => null,
        upsertMusicItem,
        replaceMusicItemMembers,
      },
      locks: new InMemoryMusicSyncLock(),
      members: [
        {
          id: "tenko-shibuki",
          nameKo: "텐코 시부키",
          nameEn: "Tenko Shibuki",
          unitName: "Cliche",
          aliases: ["텐코 시부키", "Tenko Shibuki"],
          youtubeChannelId: "shibuki-channel",
        },
        {
          id: "aokumo-rin",
          nameKo: "아오쿠모 린",
          nameEn: "Aokumo Rin",
          unitName: "Cliche",
          aliases: ["아오쿠모 린", "Aokumo Rin"],
          youtubeChannelId: "rin-channel",
        },
      ],
      targets: [{
        kind: "member",
        memberId: "tenko-shibuki",
        channelId: "shibuki-channel",
      }],
    });

    await expect(service.discover()).resolves.toMatchObject({
      uniqueVideos: 1,
      inserted: 1,
      needsReview: 0,
      excludedCandidates: 0,
    });
    expect(upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "nsZmnwC9ukE",
      type: "original",
      classificationStatus: "AUTO_CLASSIFIED",
      isExcluded: false,
      rawCategoryHint: "ORIGINAL",
      specialFlags: ["structured_original_title", "bilingual_song_title"],
    }));
    expect(replaceMusicItemMembers).toHaveBeenCalledWith("music-shibuki", [{
      memberId: "tenko-shibuki",
      role: "main",
      confidence: 0.95,
      source: "STRUCTURED_TITLE",
    }]);
  });

  it("keeps source playlist type ahead of a structured match and keeps exclusions review-only", async () => {
    const sourceBacked = {
      ...candidate,
      videoId: "source-cover-structured",
      title: "유즈하 리코(Yuzuha Riko) | 'Cover Source Wins'",
    };
    const excluded = {
      ...candidate,
      videoId: "structured-teaser",
      title: "유즈하 리코(Yuzuha Riko) | 예고편 'Teaser'",
    };
    const upsertMusicItem = vi.fn(async (input) => ({ id: `music-${input.youtubeVideoId}`, ...input }));
    const service = new MusicChannelDiscoverySyncService({
      youtube: {
        getUploadsPlaylistId: async (channelId) => ({ status: "ok", channelId, uploadsPlaylistId: "uploads" }),
        listUploads: async () => ({ status: "ok", candidates: [sourceBacked, excluded], pagesFetched: 1, quotaUnits: 1 }),
        fetchVideos: async () => ({ status: "ok" as const, items: [sourceBacked, excluded].map((fixture) => ({
          videoId: fixture.videoId,
          channelId: "official-channel",
          title: fixture.title,
          description: "",
          tags: [],
          duration: "PT3M",
          privacyStatus: "public",
        })) }),
      },
      repository: {
        getMusicItemByVideoId: async (videoId) => videoId === sourceBacked.videoId
          ? {
              id: "existing-cover",
              sourcePlaylistId: "official-cover",
              type: "cover",
              rawCategoryHint: "COVER",
            }
          : null,
        getOverrideByVideoId: async () => null,
        upsertMusicItem,
        replaceMusicItemMembers: async () => undefined,
      },
      locks: new InMemoryMusicSyncLock(),
      members: [{
        id: "yuzuha-riko",
        nameKo: "유즈하 리코",
        nameEn: "Yuzuha Riko",
        unitName: "Cliche",
        aliases: ["유즈하 리코", "Yuzuha Riko"],
      }],
      targets: [{ kind: "stellive_official", channelId: "official-channel" }],
    });

    await expect(service.discover()).resolves.toMatchObject({
      inserted: 1,
      updated: 1,
      needsReview: 2,
      excludedCandidates: 2,
    });
    expect(upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: sourceBacked.videoId,
      type: "cover",
      sourcePlaylistId: "official-cover",
      rawCategoryHint: "COVER",
    }));
    expect(upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: excluded.videoId,
      type: "original",
      isExcluded: true,
      exclusionReason: "teaser",
      classificationStatus: "NEEDS_REVIEW",
    }));
  });

  it("reuses the trusted pipeline for direct dry-runs, uploader mismatches, and external skips", async () => {
    const upsertMusicItem = vi.fn(async (input) => ({ id: `music-${input.youtubeVideoId}`, ...input }));
    const replaceMusicItemMembers = vi.fn(async () => undefined);
    const service = new MusicChannelDiscoverySyncService({
      youtube: {
        getUploadsPlaylistId: async (channelId) => ({ status: "ok", channelId, uploadsPlaylistId: "uploads" }),
        listUploads: async () => ({ status: "ok", candidates: [], pagesFetched: 1, quotaUnits: 1 }),
        fetchVideos: async () => ({ status: "ok" as const, items: [] }),
      },
      repository: {
        getMusicItemByVideoId: async () => null,
        getOverrideByVideoId: async () => null,
        upsertMusicItem,
        replaceMusicItemMembers,
      },
      locks: new InMemoryMusicSyncLock(),
      members: [
        {
          id: "yuzuha-riko",
          nameKo: "유즈하 리코",
          nameEn: "Yuzuha Riko",
          unitName: "Cliche",
          aliases: ["유즈하 리코", "Yuzuha Riko"],
          youtubeChannelId: "riko-channel",
        },
        {
          id: "ayatsuno-yuni",
          nameKo: "아야츠노 유니",
          nameEn: "Ayatsuno Yuni",
          unitName: "Everys",
          aliases: ["아야츠노 유니", "Ayatsuno Yuni"],
          youtubeChannelId: "yuni-channel",
        },
      ],
      targets: [{
        kind: "member",
        memberId: "yuzuha-riko",
        channelId: "riko-channel",
      }],
    });

    await expect(service.ingestVideoDetail({
      videoId: "dry-run-video",
      channelId: "riko-channel",
      title: "유즈하 리코(Yuzuha Riko) | 악당주의보 'Villain Warning'",
      tags: [],
      duration: "PT3M",
      privacyStatus: "public",
    }, { dryRun: true })).resolves.toMatchObject({
      action: "would_insert",
      persistenceAction: "would_insert",
      classificationType: "original",
      classificationReason: "trusted_member_title",
      structuredMatchKind: "member",
      memberIds: ["yuzuha-riko"],
      reviewRequired: false,
    });
    expect(upsertMusicItem).not.toHaveBeenCalled();

    await expect(service.ingestVideoDetail({
      videoId: "mismatch-video",
      channelId: "riko-channel",
      title: "아야츠노 유니(Ayatsuno Yuni) | 나의 노래 'My Song'",
      tags: [],
      duration: "PT3M",
      privacyStatus: "public",
    }, { dryRun: false })).resolves.toMatchObject({
      action: "needs_review",
      persistenceAction: "inserted",
      classificationReason: "member_channel_title_mismatch",
      memberIds: ["ayatsuno-yuni"],
      reviewRequired: true,
      isExcluded: true,
    });
    expect(upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "mismatch-video",
      classificationStatus: "NEEDS_REVIEW",
      isExcluded: true,
      exclusionReason: "member_channel_title_mismatch",
    }));

    await expect(service.ingestVideoDetail({
      videoId: "external-video",
      channelId: "external-channel",
      title: "유즈하 리코(Yuzuha Riko) | 복사된 형식 'Copied Format'",
      tags: [],
      duration: "PT3M",
      privacyStatus: "public",
    }, { dryRun: false })).resolves.toMatchObject({
      action: "skipped_untrusted_channel",
      classificationReason: "untrusted_channel",
    });
    expect(upsertMusicItem).toHaveBeenCalledTimes(1);
    expect(replaceMusicItemMembers).toHaveBeenCalledTimes(1);
  });

  it("counts quota_exceeded upload listings as failures and reports video detail failures", async () => {
    const upsertMusicItem = vi.fn(async (input) => ({ id: "music-1", ...input }));
    const makeService = (
      youtube: ConstructorParameters<typeof MusicChannelDiscoverySyncService>[0]["youtube"],
    ) => new MusicChannelDiscoverySyncService({
      youtube,
      repository: {
        getMusicItemByVideoId: async () => null,
        getOverrideByVideoId: async () => null,
        upsertMusicItem,
        replaceMusicItemMembers: async () => undefined,
      },
      locks: new InMemoryMusicSyncLock(),
      members: [{ id: "member-1", aliases: ["Member One"] }],
      targets: [{ kind: "member", memberId: "member-1", channelId: "channel-1" }],
    });

    await expect(makeService({
      getUploadsPlaylistId: async (channelId) => ({ status: "ok", channelId, uploadsPlaylistId: "uploads" }),
      listUploads: async () => ({ status: "quota_exceeded", candidates: [], pagesFetched: 0, quotaUnits: 1 }),
      fetchVideos: async () => ({ status: "ok" as const, items: [] }),
    }).discover()).resolves.toMatchObject({ channelsChecked: 1, uniqueVideos: 0, failed: 1 });

    await expect(makeService({
      getUploadsPlaylistId: async (channelId) => ({ status: "ok", channelId, uploadsPlaylistId: "uploads" }),
      listUploads: async () => ({ status: "ok", candidates: [candidate], pagesFetched: 1, quotaUnits: 1 }),
      fetchVideos: async () => ({ status: "error" as const, items: [] }),
    }).discover()).resolves.toMatchObject({ uniqueVideos: 1, inserted: 0, failed: 1 });

    expect(upsertMusicItem).not.toHaveBeenCalled();
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
      members: [],
      targets: [],
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
      exclusionReason: "untrusted_channel",
    }));
  });

  it("reclassifies only member-channel Playlists and preserves manual rows", async () => {
    const updateMusicItemClassification = vi.fn(async () => undefined);
    const baseRow = {
      title: "[Playlist] 새벽 감성 노래 모음",
      description: "여러 커버곡을 모았습니다.",
      type: "unknown" as const,
      duration: "PT39M12S",
      privacyStatus: "public",
      tags: ["music"],
      classificationStatus: "NEEDS_REVIEW",
      youtubePresentationType: "regular",
      youtubePremiereState: null,
    };
    const service = new MusicChannelDiscoveryReclassificationService({
      repository: {
        listDiscoveredMusicItemsForReclassification: async () => [
          { ...baseRow, id: "member-playlist", youtubeVideoId: "member-video", channelId: "member-channel" },
          { ...baseRow, id: "external-playlist", youtubeVideoId: "external-video", channelId: "external-channel" },
          { ...baseRow, id: "scheduled-playlist", youtubeVideoId: "scheduled-video", channelId: "member-channel", youtubePresentationType: "premiere_assumed", youtubePremiereState: "scheduled" },
          { ...baseRow, id: "live-playlist", youtubeVideoId: "live-video", channelId: "member-channel", youtubePresentationType: "premiere_assumed", youtubePremiereState: "live" },
          {
            ...baseRow,
            id: "manual-playlist",
            youtubeVideoId: "manual-video",
            channelId: "member-channel",
            title: "텐코 시부키(Tenko Shibuki) | 베리 베리 스트로베리 'Berry Verry Strawberry'",
            classificationStatus: "MANUAL_EXCLUDED",
          },
        ],
        updateMusicItemClassification,
      },
      members: [{
        id: "member-1",
        nameKo: "텐코 시부키",
        nameEn: "Tenko Shibuki",
        aliases: [],
        youtubeChannelId: "member-channel",
      }],
      targets: [{
        kind: "member",
        memberId: "member-1",
        channelId: "member-channel",
      }],
    });

    await expect(service.reclassify()).resolves.toEqual({
      status: "ok",
      checked: 5,
      hidden: 3,
      kept: 1,
      manualSkipped: 1,
    });
    expect(updateMusicItemClassification).toHaveBeenCalledWith("member-playlist", expect.objectContaining({
      type: "cover",
      classificationStatus: "AUTO_CLASSIFIED",
      isExcluded: false,
      specialFlags: ["playlist_compilation", "live_or_long_form"],
    }));
    expect(updateMusicItemClassification).toHaveBeenCalledWith("external-playlist", expect.objectContaining({
      classificationStatus: "NEEDS_REVIEW",
      isExcluded: true,
      exclusionReason: "untrusted_channel",
    }));
    expect(updateMusicItemClassification).toHaveBeenCalledWith("scheduled-playlist", expect.objectContaining({
      classificationStatus: "NEEDS_REVIEW",
      isExcluded: true,
    }));
    expect(updateMusicItemClassification).toHaveBeenCalledWith("live-playlist", expect.objectContaining({
      classificationStatus: "NEEDS_REVIEW",
      isExcluded: true,
    }));
    expect(updateMusicItemClassification).not.toHaveBeenCalledWith("manual-playlist", expect.anything());
  });

  it("reuses structured parsing and official-channel trust during reclassification", async () => {
    const updateMusicItemClassification = vi.fn(async () => undefined);
    const baseRow = {
      description: "",
      type: "unknown" as const,
      duration: "PT3M",
      privacyStatus: "public",
      tags: [],
      classificationStatus: "AUTO_CLASSIFIED",
      channelId: "official-channel",
    };
    const members = [
      {
        id: "yuzuha-riko",
        nameKo: "유즈하 리코",
        nameEn: "Yuzuha Riko",
        unitName: "Cliche",
        aliases: ["유즈하 리코", "Yuzuha Riko"],
      },
      {
        id: "aokumo-rin",
        nameKo: "아오쿠모 린",
        nameEn: "Aokumo Rin",
        unitName: "Cliche",
        aliases: ["아오쿠모 린", "Aokumo Rin"],
      },
    ];
    const service = new MusicChannelDiscoveryReclassificationService({
      repository: {
        listDiscoveredMusicItemsForReclassification: async () => [
          {
            ...baseRow,
            id: "unit-original",
            youtubeVideoId: "unit-video",
            title: "스텔라이브 (STELLIVE) Cliche | 우리의 노래 'Our Song'",
          },
          {
            ...baseRow,
            id: "personal-original",
            youtubeVideoId: "personal-video",
            title: "유즈하 리코(Yuzuha Riko) | '악당주의보'",
          },
          {
            ...baseRow,
            id: "partial-original",
            youtubeVideoId: "partial-video",
            title: "유즈하 리코(Yuzuha Riko) | 악당주의보",
          },
        ],
        updateMusicItemClassification,
      },
      members,
      targets: [{ kind: "stellive_official", channelId: "official-channel" }],
    });

    await expect(service.reclassify()).resolves.toEqual({
      status: "ok",
      checked: 3,
      hidden: 2,
      kept: 1,
      manualSkipped: 0,
    });
    expect(updateMusicItemClassification).toHaveBeenCalledWith("unit-original", expect.objectContaining({
      type: "original",
      classificationStatus: "AUTO_CLASSIFIED",
      isExcluded: false,
      rawCategoryHint: "ORIGINAL",
      specialFlags: ["structured_original_title", "bilingual_song_title"],
    }));
    expect(updateMusicItemClassification).toHaveBeenCalledWith("personal-original", expect.objectContaining({
      type: "original",
      classificationStatus: "NEEDS_REVIEW",
      isExcluded: true,
      exclusionReason: "member_title_on_official_channel",
    }));
    expect(updateMusicItemClassification).toHaveBeenCalledWith("partial-original", expect.objectContaining({
      type: "unknown",
      classificationStatus: "NEEDS_REVIEW",
      isExcluded: true,
      rawCategoryHint: "UNKNOWN",
      specialFlags: [
        "partial_structured_original_title",
        "structured_original_malformed_song_quotes",
      ],
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
