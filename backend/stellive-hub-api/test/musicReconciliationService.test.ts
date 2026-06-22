import { describe, expect, it } from "vitest";

import { MusicReconciliationService } from "../src/music/musicReconciliationService.js";

describe("MusicReconciliationService", () => {
  it("reports category, member, and missing-item diagnostics without raw external payloads", async () => {
    const service = new MusicReconciliationService({
      repository: {
        listMusicItems: async () => ({
          items: [{
            id: "music-1",
            youtubeVideoId: "video-1",
            title: "유니 cover",
            type: "cover",
            publishedAt: "2026-06-21T12:00:00.000Z",
            thumbnailUrl: null,
            duration: null,
            members: [{ id: "ayatsuno-yuni", nameKo: "아야츠노 유니", nameEn: "Ayatsuno Yuni", role: "main" }],
            youtubeUrl: "https://www.youtube.com/watch?v=video-1",
            sourcePlaylistId: "source-1",
          }],
          nextCursor: null,
        }),
      },
    });

    const report = await service.compareWithOfficialSource([
      { youtubeVideoId: "video-1", type: "original", memberIds: ["shirayuki-hina"] },
      { youtubeVideoId: "video-2", type: "cover", memberIds: ["ayatsuno-yuni"] },
    ]);

    expect(report).toEqual({
      checkedCount: 2,
      diagnostics: [
        { kind: "category_mismatch", youtubeVideoId: "video-1", expected: "original", actual: "cover" },
        { kind: "member_mismatch", youtubeVideoId: "video-1", expected: ["shirayuki-hina"], actual: ["ayatsuno-yuni"] },
        { kind: "missing_in_db", youtubeVideoId: "video-2", expected: "cover" },
      ],
    });
    expect(JSON.stringify(report)).not.toContain("rawPayload");
  });
});
