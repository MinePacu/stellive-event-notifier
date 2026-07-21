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

  it("classifies long member-channel Playlist compilations with a dedicated signal", () => {
    expect(classifySongUpload({
      title: "[Playlist] 새벽에 듣는 노래 모음",
      duration: "PT39M12S",
      privacyStatus: "public",
      broadcastState: "none" as const,
      isOfficialMemberChannel: true,
    })).toEqual({
      type: "cover",
      confidence: 0.65,
      reason: "member_channel_playlist_compilation",
      specialFlags: ["playlist_compilation"],
    });

    for (const title of ["새벽 플레이리스트", "새벽 플리 모음"]) {
      expect(classifySongUpload({
        title,
        duration: "PT8M",
        privacyStatus: "unlisted",
        broadcastState: "none",
        isOfficialMemberChannel: true,
      }).type).toBe("cover");
    }
    expect(classifySongUpload({
      title: "플리마켓 방문기",
      duration: "PT39M",
      privacyStatus: "public",
      broadcastState: "none",
      isOfficialMemberChannel: true,
    }).type).toBe("unknown");
  });

  it("requires the Playlist marker in the title and all member-channel metadata guards", () => {
    const validMetadata = {
      duration: "PT39M",
      privacyStatus: "public",
      broadcastState: "none" as const,
      isOfficialMemberChannel: true,
    };

    expect(classifySongUpload({ title: "새벽 노래 모음", description: "Playlist", ...validMetadata }).type).toBe("unknown");
    expect(classifySongUpload({ title: "새벽 노래 모음", tags: ["Playlist"], ...validMetadata }).type).toBe("unknown");
    expect(classifySongUpload({ title: "[Playlist] 새벽 노래 모음", ...validMetadata, isOfficialMemberChannel: false }).type).toBe("unknown");
    expect(classifySongUpload({ title: "[Playlist] 새벽 노래 모음", ...validMetadata, duration: "PT7M59S" }).type).toBe("unknown");
    expect(classifySongUpload({ title: "[Playlist] 새벽 노래 모음", ...validMetadata, privacyStatus: "private" }).type).toBe("unknown");
    expect(classifySongUpload({ title: "[Playlist] 새벽 노래 모음", ...validMetadata, broadcastState: undefined }).type).toBe("unknown");
    expect(classifySongUpload({ title: "[Playlist] 새벽 노래 모음", ...validMetadata, broadcastState: "scheduled" }).type).toBe("unknown");
    expect(classifySongUpload({ title: "[Playlist] 새벽 노래 모음", ...validMetadata, broadcastState: "live" }).type).toBe("unknown");
    expect(classifySongUpload({ title: "[Playlist] 새벽 노래 모음", ...validMetadata, broadcastState: "unknown" }).type).toBe("unknown");
    expect(classifySongUpload({ title: "[Playlist] 새벽 노래 모음", ...validMetadata, broadcastState: "completed" }).type).toBe("cover");
  });

  it("rejects non-music and broadcast Playlist titles", () => {
    const metadata = {
      duration: "PT39M",
      privacyStatus: "public",
      broadcastState: "none" as const,
      isOfficialMemberChannel: true,
    };

    for (const title of [
      "BGM Playlist",
      "게임 방송 다시보기 Playlist",
      "풀영상 Playlist",
      "Stream Archive Playlist",
      "Gameplay Playlist",
      "ASMR Playlist",
      "추천곡 Playlist",
      "노래 추천 Playlist",
      "Shorts Playlist",
      "Teaser Playlist",
      "Trailer Playlist",
      "Preview Playlist",
    ]) {
      expect(classifySongUpload({ title, ...metadata }).type, title).toBe("unknown");
    }
  });
});
