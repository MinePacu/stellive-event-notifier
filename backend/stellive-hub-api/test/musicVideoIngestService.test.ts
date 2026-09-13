import { describe, expect, it, vi } from "vitest";

import { MusicVideoIngestService } from "../src/music/musicVideoIngestService.js";
import type { YoutubeVideoDetail } from "../src/adapters/youtube/youtubeDataApiClient.js";

const videoA = "abcdefghijk";
const videoB = "123456789_-";
const videoC = "zyxwvutsrqp";

function detail(videoId: string): YoutubeVideoDetail {
  return {
    videoId,
    title: `title-${videoId}`,
    tags: [],
  };
}

describe("MusicVideoIngestService", () => {
  it("fetches one batch, reports missing IDs, and isolates per-video failures", async () => {
    const fetchVideos = vi.fn(async () => ({ status: "ok" as const, items: [detail(videoA), detail(videoB)] }));
    const ingestVideoDetail = vi.fn(async (input: YoutubeVideoDetail) => {
      if (input.videoId === videoB) throw new Error("database URL must not escape");
      return {
        action: "inserted" as const,
        classificationType: "original",
        classificationReason: "trusted_structured_title",
        structuredMatchKind: "single",
        memberIds: ["member-1"],
        reviewRequired: false,
      };
    });
    const service = new MusicVideoIngestService({
      youtube: { fetchVideos },
      processor: { ingestVideoDetail },
    });

    const result = await service.ingestVideos({
      videoIds: [videoA, videoB, videoC],
      requestedCount: 4,
    });

    expect(fetchVideos).toHaveBeenCalledOnce();
    expect(fetchVideos).toHaveBeenCalledWith([videoA, videoB, videoC]);
    expect(result.items).toEqual([
      {
        videoId: videoA,
        status: "ok",
        action: "inserted",
        classificationType: "original",
        classificationReason: "trusted_structured_title",
        structuredMatchKind: "single",
        memberIds: ["member-1"],
        reviewRequired: false,
        error: null,
      },
      {
        videoId: videoB,
        status: "failed",
        action: "failed",
        classificationType: null,
        classificationReason: null,
        structuredMatchKind: null,
        memberIds: [],
        reviewRequired: false,
        error: "video_processing_failed",
      },
      {
        videoId: videoC,
        status: "not_found",
        action: "not_found",
        classificationType: null,
        classificationReason: null,
        structuredMatchKind: null,
        memberIds: [],
        reviewRequired: false,
        error: null,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("database URL");
    expect(result.summary).toEqual({
      requested: 4,
      uniqueRequested: 3,
      fetched: 2,
      inserted: 1,
      updated: 0,
      needsReview: 0,
      skipped: 0,
      notFound: 1,
      failed: 1,
      dryRun: false,
    });
  });

  it("passes dryRun to the shared processor and retains dry-run actions", async () => {
    const ingestVideoDetail = vi.fn(async () => ({
      action: "would_update" as const,
      classificationType: "cover",
      classificationReason: "trusted_member_channel",
      structuredMatchKind: "collaboration",
      memberIds: ["member-1", "member-2"],
      reviewRequired: false,
    }));
    const service = new MusicVideoIngestService({
      youtube: { fetchVideos: async () => ({ status: "ok" as const, items: [detail(videoA)] }) },
      processor: { ingestVideoDetail },
    });

    const result = await service.ingestVideos({ videoIds: [videoA], dryRun: true });

    expect(ingestVideoDetail).toHaveBeenCalledWith(detail(videoA), { dryRun: true });
    expect(result.items[0]?.action).toBe("would_update");
    expect(result.summary).toMatchObject({ dryRun: true, inserted: 0, updated: 0 });
  });

  it("counts persisted review rows in both persistence and review totals", async () => {
    const service = new MusicVideoIngestService({
      youtube: { fetchVideos: async () => ({ status: "ok" as const, items: [detail(videoA)] }) },
      processor: {
        ingestVideoDetail: async () => ({
          action: "needs_review",
          persistenceAction: "inserted",
          classificationType: "unknown",
          classificationReason: "partial_structured_title",
          structuredMatchKind: "partial",
          memberIds: [],
          reviewRequired: true,
        }),
      },
    });

    const result = await service.ingestVideos({ videoIds: [videoA] });

    expect(result.items[0]).toMatchObject({
      action: "needs_review",
      reviewRequired: true,
    });
    expect(result.summary).toMatchObject({ inserted: 1, needsReview: 1 });
  });
});
