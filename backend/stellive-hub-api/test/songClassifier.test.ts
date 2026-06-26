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
});
