import { describe, expect, it, vi } from "vitest";

import { MusicReconciliationService } from "../src/music/musicReconciliationService.js";

describe("MusicReconciliationService", () => {
  it("reports category, member, and missing-item diagnostics without raw external payloads", async () => {
    const service = new MusicReconciliationService({
      repository: {
        listAllMusicItemsForReconciliation: async () => ({
          items: [{
            youtubeVideoId: "video-1",
            type: "cover" as const,
            memberIds: ["ayatsuno-yuni"],
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

  it("does not report private, excluded or unreviewed rows as missing_in_db", async () => {
    const listAllMusicItemsForReconciliation = vi.fn(async () => ({
      // Rows the public catalog listing filters out (private / excluded / NEEDS_REVIEW)
      // must still be visible here, otherwise they are falsely reported as missing.
      items: [
        { youtubeVideoId: "private-1", type: "cover" as const, memberIds: ["ayatsuno-yuni"] },
        { youtubeVideoId: "excluded-1", type: "original" as const, memberIds: [] },
      ],
      nextCursor: null,
    }));
    const service = new MusicReconciliationService({
      repository: { listAllMusicItemsForReconciliation },
    });

    const report = await service.compareWithOfficialSource([
      { youtubeVideoId: "private-1", type: "cover", memberIds: ["ayatsuno-yuni"] },
      { youtubeVideoId: "excluded-1", type: "original", memberIds: [] },
    ]);

    expect(listAllMusicItemsForReconciliation).toHaveBeenCalledWith({ limit: 200, cursor: undefined });
    expect(report).toEqual({ checkedCount: 2, diagnostics: [] });
  });
});
