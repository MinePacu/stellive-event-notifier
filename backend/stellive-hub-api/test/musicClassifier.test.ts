import { describe, expect, it } from "vitest";

import { classifyMusicSource, mergeMusicItemTypes } from "../src/music/musicClassifier.js";

describe("music classifier", () => {
  it("classifies source playlists by playlist type before title text", () => {
    expect(classifyMusicSource({ type: "cover", rawCategoryHint: "COVER" })).toBe("cover");
    expect(classifyMusicSource({ type: "original", rawCategoryHint: "SINGLE" })).toBe("original");
    expect(classifyMusicSource({ type: "original", rawCategoryHint: "EP" })).toBe("original");
    expect(classifyMusicSource({ type: "other", rawCategoryHint: "OTHERS" })).toBe("other");
    expect(classifyMusicSource(null)).toBe("unknown");
  });

  it("treats OTHERS source as original only when explicitly marked original-like", () => {
    expect(classifyMusicSource({ type: "other", rawCategoryHint: "OTHERS", originalLike: true })).toBe("original");
    expect(classifyMusicSource({ type: "other", rawCategoryHint: "OTHERS", originalLike: false })).toBe("other");
  });

  it("merges duplicate source classifications with deterministic precedence", () => {
    expect(mergeMusicItemTypes(["cover", "original"])).toBe("original");
    expect(mergeMusicItemTypes(["other", "cover", "unknown"])).toBe("cover");
    expect(mergeMusicItemTypes(["unknown", "other"])).toBe("other");
    expect(mergeMusicItemTypes([])).toBe("unknown");
  });
});
