import { describe, expect, it } from "vitest";
import SongIngestionService from "../src/songs/songIngestionService.js";

describe("SongIngestionService", () => {
  it("normalizes classified YouTube uploads into repository upserts", async () => {
    const upserts: unknown[] = [];
    const service = new SongIngestionService({
      catalog: {
        findByYoutubeChannelId: () => ({
          memberId: "akane-lize",
          memberName: "아카네 리제",
          generationId: "gen2",
          generationName: "2기생",
        }),
      },
      songs: {
        upsertSongFromYoutubeUpload: async (input: unknown) => {
          upserts.push(input);
          return { id: "song-1" };
        },
      },
    });

    await expect(service.ingestYoutubeUpload({
      videoId: "abc123",
      channelId: "UC123",
      title: "별빛 항로 original song",
      sourceUrl: "https://www.youtube.com/watch?v=abc123",
      publishedAt: "2026-06-21T12:00:00.000Z",
      updatedAt: "2026-06-21T12:01:00.000Z",
      liveBroadcastContent: "upcoming",
      scheduledStartTime: "2026-07-01T12:00:00.000Z",
    })).resolves.toEqual({ ingested: true, songId: "song-1" });

    expect(upserts).toEqual([expect.objectContaining({
      youtubeVideoId: "abc123",
      youtubeChannelId: "UC123",
      dedupeKey: "youtube:upload:UC123:abc123",
      memberId: "akane-lize",
      generationId: "gen2",
      songType: "original",
      sourceUrl: "https://www.youtube.com/watch?v=abc123",
      youtubePresentationType: "premiere_assumed",
      youtubePremiereState: "scheduled",
      youtubeScheduledStartAt: "2026-07-01T12:00:00.000Z",
      listingPriority: 1,
    })]);
  });

  it("skips unknown channels and non-song generation categories", async () => {
    const unknownService = new SongIngestionService({
      catalog: { findByYoutubeChannelId: () => undefined },
      songs: { upsertSongFromYoutubeUpload: async () => ({ id: "unused" }) },
    });
    await expect(unknownService.ingestYoutubeUpload({
      videoId: "abc123",
      channelId: "missing",
      title: "original song",
      sourceUrl: "https://www.youtube.com/watch?v=abc123",
      publishedAt: "2026-06-21T12:00:00.000Z",
      updatedAt: "2026-06-21T12:01:00.000Z",
    })).resolves.toEqual({ ingested: false, reason: "unknown_youtube_channel" });

    const officialService = new SongIngestionService({
      catalog: {
        findByYoutubeChannelId: () => ({
          memberId: "stellive-official",
          memberName: "스텔라이브 공식",
          generationId: "official",
          generationName: "기타",
        }),
      },
      songs: { upsertSongFromYoutubeUpload: async () => ({ id: "unused" }) },
    });
    await expect(officialService.ingestYoutubeUpload({
      videoId: "official123",
      channelId: "official-channel",
      title: "official mv original song",
      sourceUrl: "https://www.youtube.com/watch?v=official123",
      publishedAt: "2026-06-21T12:00:00.000Z",
      updatedAt: "2026-06-21T12:01:00.000Z",
    })).resolves.toEqual({ ingested: false, reason: "unsupported_song_generation" });
  });

  it("skips uploads that cannot be classified as original or cover", async () => {
    const service = new SongIngestionService({
      catalog: {
        findByYoutubeChannelId: () => ({
          memberId: "akane-lize",
          memberName: "아카네 리제",
          generationId: "gen2",
          generationName: "2기생",
        }),
      },
      songs: { upsertSongFromYoutubeUpload: async () => ({ id: "unused" }) },
    });

    await expect(service.ingestYoutubeUpload({
      videoId: "unknown123",
      channelId: "UC123",
      title: "일반 업로드",
      sourceUrl: "https://www.youtube.com/watch?v=unknown123",
      publishedAt: "2026-06-21T12:00:00.000Z",
      updatedAt: "2026-06-21T12:01:00.000Z",
    })).resolves.toEqual({ ingested: false, reason: "unknown_song_type" });
  });

  it("does not clear stored premiere state when a WebSub candidate has no broadcast detail", async () => {
    const upserts: Array<Record<string, unknown>> = [];
    const service = new SongIngestionService({
      catalog: { findByYoutubeChannelId: () => ({ memberId: "member-1", memberName: "멤버", generationId: "gen1", generationName: "1기생" }) },
      songs: { upsertSongFromYoutubeUpload: async (input) => { upserts.push(input as unknown as Record<string, unknown>); return { id: "song-1" }; } },
    });

    await service.ingestYoutubeUpload({
      videoId: "video-1",
      channelId: "channel-1",
      title: "New Song Cover",
      sourceUrl: "https://www.youtube.com/watch?v=video-1",
      publishedAt: "2026-06-28T00:00:00.000Z",
      updatedAt: "2026-06-28T00:00:00.000Z",
    });

    expect(upserts[0]).not.toHaveProperty("youtubePresentationType");
    expect(upserts[0]).not.toHaveProperty("youtubePremiereState");
  });
});
