import { describe, expect, it } from "vitest";
import { classifySongUpload } from "../src/songs/songClassifier.js";

describe("song classifier", () => {
  it("classifies common cover markers as cover", () => {
    expect(classifySongUpload({ title: "밤 산책 커버" }).type).toBe("cover");
    expect(classifySongUpload({ title: "covered by Yuni" }).type).toBe("cover");
    expect(classifySongUpload({ title: "歌ってみた" }).type).toBe("cover");
  });

  it("classifies original markers as original when no cover marker is present", () => {
    expect(classifySongUpload({ title: "오리지널 곡" }).type).toBe("original");
    expect(classifySongUpload({ title: "original song official mv" }).type).toBe("original");
  });

  it("keeps mixed or empty metadata unknown", () => {
    expect(classifySongUpload({ title: "original cover official mv" }).type).toBe("unknown");
    expect(classifySongUpload({ title: "" }).type).toBe("unknown");
  });

  it("does not classify member channel uploads from generic cover tags alone", () => {
    const result = classifySongUpload({
      title: "선배 생활 최대 위기 발생",
      description: "치지직 생방송과 다시보기 링크",
      tags: ["스텔라이브", "cover", "커버곡", "여자커버"],
    });

    expect(result).toEqual({ type: "unknown", confidence: 0, reason: "no_strong_marker" });
  });
});
