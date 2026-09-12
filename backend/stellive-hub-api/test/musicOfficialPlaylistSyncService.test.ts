import { describe, expect, it, vi } from "vitest";

import { InMemoryMusicSyncLock } from "../src/music/musicLocks.js";
import { OfficialStelliveMusicSyncService } from "../src/music/officialStelliveMusicSyncService.js";
import {
  OFFICIAL_STELLIVE_MUSIC_COVER_PLAYLIST_ID,
  OFFICIAL_STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID,
} from "../src/music/musicSourcePlaylists.js";

const members = [
  { id: "akane-lize", aliases: ["아카네 리제", "Lize"], youtubeChannelId: "UC_LIZE" },
  { id: "ayatsuno-yuni", aliases: ["아야츠노 유니", "Yuni"], youtubeChannelId: "UC_YUNI" },
  { id: "gangzi", aliases: ["강지", "Gangzi"], youtubeChannelId: "UC_GANGZI" },
];

function createService() {
  const sourceRows = [
    { id: "source-cover", youtubePlaylistId: OFFICIAL_STELLIVE_MUSIC_COVER_PLAYLIST_ID, title: "COVER", type: "cover" as const, rawCategoryHint: "COVER" as const, memberId: null },
    { id: "source-original", youtubePlaylistId: OFFICIAL_STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID, title: "ORIGINAL", type: "original" as const, rawCategoryHint: "ORIGINAL" as const, memberId: null },
  ];
  const repository = {
    upsertOfficialSourcePlaylists: vi.fn(async () => sourceRows),
    upsertMusicItem: vi.fn(async (input) => ({ id: `music-${input.youtubeVideoId}`, youtubeVideoId: input.youtubeVideoId })),
    upsertMusicItemSourcePlaylist: vi.fn(async () => undefined),
    replaceMusicItemMembers: vi.fn(async () => undefined),
    getOverrideByVideoId: vi.fn(async (videoId: string) => videoId === "video-override"
      ? { forcedType: "original", forcedMemberIds: ["ayatsuno-yuni"], forceExcluded: true, exclusionReason: "manual" }
      : null),
  };
  const youtube = {
    fetchPlaylistItems: vi.fn(async (playlistId: string) => ({
      status: "ok" as const,
      pagesFetched: 1,
      quotaUnits: 1,
      items: playlistId === OFFICIAL_STELLIVE_MUSIC_COVER_PLAYLIST_ID
        ? [
          { playlistItemId: "pli-cover-1", videoId: "video-dup", title: "Lize cover", publishedAt: "2026-06-22T00:00:00.000Z", position: 0 },
          { playlistItemId: "pli-cover-2", videoId: "video-override", title: "Akane Lize cover", publishedAt: "2026-06-22T00:00:00.000Z", position: 1 },
        ]
        : [
          { playlistItemId: "pli-original-1", videoId: "video-dup", title: "Lize original", publishedAt: "2026-06-21T00:00:00.000Z", position: 0 },
        ],
    })),
    fetchVideos: vi.fn(async () => ({ status: "ok" as const, items: [
      {
        videoId: "video-dup",
        title: "STELLIVE cover",
        description: "",
        publishedAt: "2026-06-22T00:00:00.000Z",
        duration: "PT3M21S",
        channelId: "UC_OFFICIAL",
        channelTitle: "스텔라이브 StelLive Official",
        privacyStatus: "public",
        embeddable: true,
        madeForKids: false,
      },
      {
        videoId: "video-override",
        title: "Akane Lize teaser",
        description: "",
        publishedAt: "2026-06-22T00:00:00.000Z",
        duration: "PT45S",
        channelId: "UC_LIZE",
        channelTitle: "Akane Lize",
        privacyStatus: "public",
      },
    ] })),
  };
  const syncRuns = {
    startRun: vi.fn(async () => ({ id: "run-1" })),
    finishRun: vi.fn(async () => undefined),
    failRun: vi.fn(async () => undefined),
  };
  const service = new OfficialStelliveMusicSyncService({
    repository,
    youtube,
    syncRuns,
    locks: new InMemoryMusicSyncLock(),
    members,
    now: () => new Date("2026-06-23T00:00:00.000Z"),
  });
  return { service, repository, youtube, syncRuns };
}

describe("OfficialStelliveMusicSyncService", () => {
  it("syncs only the two official playlists, dedupes videos, preserves source mappings, and applies manual overrides", async () => {
    const { service, repository, youtube, syncRuns } = createService();

    await expect(service.syncOfficialStelliveMusicPlaylists("manual")).resolves.toMatchObject({
      status: "ok",
      totalPlaylistItems: 3,
      uniqueVideos: 2,
      needsReview: 1,
      excludedCandidates: 1,
      apiCallsEstimated: 3,
    });

    expect(youtube.fetchPlaylistItems).toHaveBeenCalledWith(OFFICIAL_STELLIVE_MUSIC_COVER_PLAYLIST_ID, {});
    expect(youtube.fetchPlaylistItems).toHaveBeenCalledWith(OFFICIAL_STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID, {});
    expect(youtube.fetchVideos).toHaveBeenCalledWith(["video-dup", "video-override"]);
    expect(repository.upsertMusicItem).toHaveBeenCalledTimes(2);
    expect(repository.upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "video-dup",
      type: "original",
      classificationStatus: "NEEDS_REVIEW",
      isAvailable: true,
      isExcluded: false,
    }));
    expect(repository.upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "video-override",
      type: "original",
      isExcluded: true,
      exclusionReason: "manual",
    }));
    expect(repository.upsertMusicItemSourcePlaylist).toHaveBeenCalledTimes(3);
    expect(repository.replaceMusicItemMembers).toHaveBeenCalledWith("music-video-override", [
      { memberId: "ayatsuno-yuni", role: "main", confidence: 1, source: "MANUAL" },
    ]);
    expect(repository.replaceMusicItemMembers).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ memberId: "gangzi" })]),
    );
    expect(syncRuns.finishRun).toHaveBeenCalledWith("run-1", expect.objectContaining({
      fetchedCount: 3,
      quotaUnits: 3,
      metadata: expect.objectContaining({ uniqueVideos: 2 }),
    }));
  });

  it("reuses structured-title matching for official playlist member links and partial review", async () => {
    const repository = {
      upsertOfficialSourcePlaylists: vi.fn(async () => [
        { id: "source-cover", youtubePlaylistId: OFFICIAL_STELLIVE_MUSIC_COVER_PLAYLIST_ID, title: "COVER", type: "cover" as const, rawCategoryHint: "COVER" as const, memberId: null },
        { id: "source-original", youtubePlaylistId: OFFICIAL_STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID, title: "ORIGINAL", type: "original" as const, rawCategoryHint: "ORIGINAL" as const, memberId: null },
      ]),
      upsertMusicItem: vi.fn(async (input) => ({ id: `music-${input.youtubeVideoId}` })),
      upsertMusicItemSourcePlaylist: vi.fn(async () => undefined),
      replaceMusicItemMembers: vi.fn(async () => undefined),
      getOverrideByVideoId: vi.fn(async () => null),
    };
    const exactTitle = "유즈하 리코(Yuzuha Riko) | 악당주의보 'Villain Warning'";
    const partialTitle = "유즈하 리코(Yuzuha Riko) | 악당주의보";
    const youtube = {
      fetchPlaylistItems: vi.fn(async (playlistId: string) => ({
        status: "ok" as const,
        pagesFetched: 1,
        quotaUnits: 1,
        items: playlistId === OFFICIAL_STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID
          ? [
              { videoId: "P_oxx3_VpIY", title: exactTitle, publishedAt: "2026-06-22T00:00:00.000Z" },
              { videoId: "partial-original", title: partialTitle, publishedAt: "2026-06-22T00:00:00.000Z" },
            ]
          : [],
      })),
      fetchVideos: vi.fn(async () => ({ status: "ok" as const, items: [
        {
          videoId: "P_oxx3_VpIY",
          title: exactTitle,
          duration: "PT3M",
          privacyStatus: "public",
        },
        {
          videoId: "partial-original",
          title: partialTitle,
          duration: "PT3M",
          privacyStatus: "public",
        },
      ] })),
    };
    const service = new OfficialStelliveMusicSyncService({
      repository,
      youtube,
      syncRuns: {
        startRun: vi.fn(async () => ({ id: "structured-run" })),
        finishRun: vi.fn(async () => undefined),
        failRun: vi.fn(async () => undefined),
      },
      locks: new InMemoryMusicSyncLock(),
      members: [{
        id: "yuzuha-riko",
        nameKo: "유즈하 리코",
        nameEn: "Yuzuha Riko",
        unitName: "Cliche",
        aliases: ["유즈하 리코", "Yuzuha Riko"],
      }],
      now: () => new Date("2026-06-23T00:00:00.000Z"),
    });

    await expect(service.syncOfficialStelliveMusicPlaylists()).resolves.toMatchObject({
      status: "ok",
      uniqueVideos: 2,
      needsReview: 1,
      excludedCandidates: 1,
    });
    expect(repository.upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "P_oxx3_VpIY",
      type: "original",
      classificationStatus: "AUTO_CLASSIFIED",
      specialFlags: ["structured_original_title", "bilingual_song_title"],
    }));
    expect(repository.upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "partial-original",
      type: "original",
      sourcePlaylistId: "source-original",
      classificationStatus: "NEEDS_REVIEW",
      isExcluded: true,
      exclusionReason: "malformed_song_quotes",
      rawCategoryHint: "UNKNOWN",
      specialFlags: [
        "partial_structured_original_title",
        "structured_original_malformed_song_quotes",
      ],
    }));
    expect(repository.upsertMusicItemSourcePlaylist).toHaveBeenCalledWith(expect.objectContaining({
      musicItemId: "music-partial-original",
      sourcePlaylistId: "source-original",
      sourcePlaylistType: "original",
    }));
    expect(repository.replaceMusicItemMembers).toHaveBeenCalledWith("music-P_oxx3_VpIY", [{
      memberId: "yuzuha-riko",
      role: "main",
      confidence: 0.95,
      source: "STRUCTURED_TITLE",
    }]);
  });
});
