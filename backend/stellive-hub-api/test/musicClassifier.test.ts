import { describe, expect, it } from "vitest";

import {
  classifyMusicSource,
  classifyVideo,
  detectExcludeCandidate,
  detectInstrumental,
  detectSpecialFlags,
  mergeMusicItemTypes,
  normalizeTitle,
  parseDurationToSeconds,
} from "../src/music/musicClassifier.js";

describe("music classifier", () => {
  it("classifies source playlists by playlist type before title text", () => {
    expect(classifyMusicSource({ type: "cover", rawCategoryHint: "COVER" })).toBe("cover");
    expect(classifyMusicSource({ type: "original", rawCategoryHint: "SINGLE" })).toBe("original");
    expect(classifyMusicSource({ type: "original", rawCategoryHint: "EP" })).toBe("original");
    expect(classifyMusicSource({ type: "other", rawCategoryHint: "OTHERS" })).toBe("other");
    expect(classifyMusicSource(null)).toBe("unknown");
  });

  it("treats OTHERS source original only explicitly marked original-like", () => {
    expect(classifyMusicSource({ type: "other", rawCategoryHint: "OTHERS", originalLike: true })).toBe("original");
    expect(classifyMusicSource({ type: "other", rawCategoryHint: "OTHERS", originalLike: false })).toBe("other");
  });

  it("merges duplicate source classifications deterministic precedence", () => {
    expect(mergeMusicItemTypes(["cover", "original"])).toBe("original");
    expect(mergeMusicItemTypes(["other", "cover", "unknown"])).toBe("cover");
    expect(mergeMusicItemTypes(["unknown", "other"])).toBe("other");
    expect(mergeMusicItemTypes([])).toBe("unknown");
  });

  it("normalizes titles and parses ISO-8601 durations", () => {
    expect(normalizeTitle("  Heart   Score  ")).toBe("heart score");
    expect(parseDurationToSeconds("PT3M21S")).toBe(201);
    expect(parseDurationToSeconds("PT1H2M3S")).toBe(3723);
    expect(parseDurationToSeconds("PT45S")).toBe(45);
    expect(parseDurationToSeconds("bad")).toBeNull();
  });

  it("detects instrumental, exclusion candidates, and special flags", () => {
    expect(detectInstrumental("Heart Score (Inst.)")).toBe(true);
    expect(detectInstrumental("Off Vocal version")).toBe(true);
    expect(detectExcludeCandidate("teaser preview", "")).toEqual({ isExcluded: true, reason: "teaser" });
    expect(detectExcludeCandidate("normal cover", "#shorts")).toEqual({ isExcluded: true, reason: "shorts" });
    expect(detectSpecialFlags("J-POP Mashup OST Remix", "")).toEqual(["mashup", "ost", "remix"]);
    expect(detectSpecialFlags("추억의 투니버스 메들리", "")).toEqual(["medley"]);
  });

  it("classifies videos with review and visibility flags without deleting candidates", () => {
    expect(classifyVideo({
      sourceTypes: ["cover", "original"],
      title: "Heart Score (Inst.)",
      duration: "PT59S",
      privacyStatus: "private",
    })).toEqual({
      type: "original",
      classificationStatus: "NEEDS_REVIEW",
      durationSeconds: 59,
      isAvailable: false,
      isExcluded: false,
      exclusionReason: null,
      isInstrumental: true,
      specialFlags: ["short_or_preview"],
    });
  });
});
