import { describe, expect, it, vi } from "vitest";
import SongBackfillService from "../src/songs/songBackfillService.js";
import type { YoutubeUploadCandidate } from "../src/adapters/youtube/youtubeAtomParser.js";

describe("SongBackfillService", () => {
  it("runs capped channel backfill through song ingestion", async () => {
    const ingested: YoutubeUploadCandidate[] = [];
    const service = new SongBackfillService({
      maxPages: 1,
      maxChannels: 1,
      targets: [
        { memberId: "akane-lize", channelId: "UC1" },
        { memberId: "neneko-mashiro", channelId: "UC2" },
      ],
      youtube: {
        getUploadsPlaylistId: vi.fn(async (channelId) => ({
          status: "ok" as const,
          channelId,
          uploadsPlaylistId: `UU-${channelId}`,
          etag: "channel-etag",
        })),
        listUploads: vi.fn(async () => ({
          status: "ok" as const,
          candidates: [{
            videoId: "video-1",
            channelId: "UC1",
            title: "별빛 original song",
            sourceUrl: "https://www.youtube.com/watch?v=video-1",
            publishedAt: "2026-06-21T12:00:00.000Z",
            updatedAt: "2026-06-21T12:00:00.000Z",
          }],
          pagesFetched: 1,
          quotaUnits: 1,
          etag: "playlist-etag",
        })),
      },
      ingestion: {
        ingestYoutubeUpload: async (candidate) => {
          ingested.push(candidate);
          return { ingested: true as const, songId: candidate.videoId };
        },
      },
    });

    await expect(service.backfill()).resolves.toEqual({
      status: "ok",
      checkedChannels: 1,
      skippedChannels: 1,
      pagesFetched: 1,
      quotaUnits: 2,
      ingested: 1,
      skipped: 0,
      notModified: 0,
      failed: 0,
    });
    expect(ingested).toHaveLength(1);
    expect(service["dependencies"].youtube.listUploads).toHaveBeenCalledWith({
      channelId: "UC1",
      uploadsPlaylistId: "UU-UC1",
      maxPages: 1,
    });
  });

  it("does not enqueue ingestion for not-modified playlist responses", async () => {
    const ingestYoutubeUpload = vi.fn();
    const service = new SongBackfillService({
      maxPages: 1,
      maxChannels: 10,
      targets: [{ memberId: "akane-lize", channelId: "UC1", playlistEtag: "stored-etag" }],
      youtube: {
        getUploadsPlaylistId: async () => ({
          status: "ok" as const,
          channelId: "UC1",
          uploadsPlaylistId: "UU1",
        }),
        listUploads: async () => ({
          status: "not_modified" as const,
          candidates: [],
          pagesFetched: 0,
          quotaUnits: 1,
        }),
      },
      ingestion: { ingestYoutubeUpload },
    });

    await expect(service.reconcile()).resolves.toMatchObject({
      status: "ok",
      checkedChannels: 1,
      ingested: 0,
      notModified: 1,
    });
    expect(ingestYoutubeUpload).not.toHaveBeenCalled();
  });
});
