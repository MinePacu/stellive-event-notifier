import { describe, expect, it } from "vitest";
import { classifyYoutubePremiere } from "../src/adapters/youtube/youtubePremiereClassifier.js";

describe("classifyYoutubePremiere", () => {
  it("marks an upcoming cover as an assumed scheduled premiere", () => {
    expect(classifyYoutubePremiere({
      musicType: "cover",
      liveBroadcastContent: "upcoming",
      scheduledStartTime: "2026-07-01T12:00:00.000Z",
    })).toEqual({
      presentationType: "premiere_assumed",
      state: "scheduled",
      scheduledStartAt: "2026-07-01T12:00:00.000Z",
      actualStartAt: null,
      actualEndAt: null,
      listingPriority: 1,
    });
  });

  it("prefers completed and live timestamps over snippet state", () => {
    expect(classifyYoutubePremiere({
      musicType: "original",
      liveBroadcastContent: "none",
      actualStartTime: "2026-07-01T12:00:00.000Z",
      actualEndTime: "2026-07-01T12:04:00.000Z",
    }).state).toBe("completed");

    expect(classifyYoutubePremiere({
      musicType: "cover",
      liveBroadcastContent: "none",
      actualStartTime: "2026-07-01T12:00:00.000Z",
    })).toMatchObject({ state: "live", listingPriority: 0 });
  });

  it("keeps non-music and videos without broadcast metadata regular", () => {
    expect(classifyYoutubePremiere({
      musicType: "other",
      liveBroadcastContent: "upcoming",
      scheduledStartTime: "2026-07-01T12:00:00.000Z",
    })).toEqual({ presentationType: "regular", state: null, scheduledStartAt: null, actualStartAt: null, actualEndAt: null, listingPriority: 2 });

    expect(classifyYoutubePremiere({ musicType: "cover", liveBroadcastContent: "none" }))
      .toEqual({ presentationType: "regular", state: null, scheduledStartAt: null, actualStartAt: null, actualEndAt: null, listingPriority: 2 });
  });

  it("marks ambiguous live metadata as unknown", () => {
    expect(classifyYoutubePremiere({
      musicType: "original",
      scheduledStartTime: "2020-01-01T00:00:00.000Z",
    })).toMatchObject({ presentationType: "premiere_assumed", state: "unknown", listingPriority: 2 });
  });
});
