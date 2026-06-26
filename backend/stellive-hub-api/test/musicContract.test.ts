import { describe, expect, it } from "vitest";
import {
  musicItemTypeValues,
  musicMemberRoleValues,
  musicPublicTypeFilterValues,
} from "../../../shared/schemas/domain.js";
import type {
  MusicDetailResponse,
  MusicListResponse,
  MusicMemberMusicResponse,
} from "../../../shared/schemas/mobileApi.js";

describe("music API contract", () => {
  it("keeps music item and filter type values explicit", () => {
    expect(musicItemTypeValues).toEqual(["cover", "original", "other", "unknown"]);
    expect(musicPublicTypeFilterValues).toEqual(["all", "cover", "original", "other"]);
  });

  it("keeps music member roles explicit", () => {
    expect(musicMemberRoleValues).toEqual(["main", "collaboration", "group", "unknown"]);
  });

  it("models music list responses without leaking provider internals", () => {
    const response = {
      items: [
        {
          id: "music_1",
          youtubeVideoId: "abc123",
          title: "Starlight",
          type: "original",
          publishedAt: "2026-06-22T00:00:00.000Z",
          thumbnailUrl: "https://i.ytimg.com/vi/abc123/maxresdefault.jpg",
          duration: "PT3M21S",
          members: [
            { id: "akane-lize", nameKo: "아카네 리제", nameEn: "Akane Lize", role: "main" },
          ],
          youtubeUrl: "https://www.youtube.com/watch?v=abc123",
          sourcePlaylistId: "playlist_1",
        },
      ],
      nextCursor: null,
      serverTime: "2026-06-22T00:00:00.000Z",
    } satisfies MusicListResponse;

    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("apiKey");
    expect(serialized).not.toContain("rawPayload");
    expect(serialized).not.toContain("base64");
    expect(serialized).not.toContain("bytes");
    expect(serialized).not.toContain("assetPath");
    expect(serialized).not.toContain("filePath");
  });

  it("models music detail and member music responses", () => {
    const detail = {
      item: {
        id: "music_1",
        youtubeVideoId: "abc123",
        title: "Starlight",
        type: "cover",
        publishedAt: null,
        thumbnailUrl: null,
        duration: null,
        members: [
          { id: "ayatsuno-yuni", nameKo: "아야츠노 유니", nameEn: "Ayatsuno Yuni", role: "collaboration" },
        ],
        youtubeUrl: "https://www.youtube.com/watch?v=abc123",
        sourcePlaylistId: null,
      },
      serverTime: "2026-06-22T00:00:00.000Z",
    } satisfies MusicDetailResponse;

    const memberMusic = {
      member: { id: "ayatsuno-yuni", nameKo: "아야츠노 유니", nameEn: "Ayatsuno Yuni" },
      items: detail.item.members[0] ? [detail.item] : [],
      nextCursor: null,
      serverTime: "2026-06-22T00:00:00.000Z",
    } satisfies MusicMemberMusicResponse;

    expect(memberMusic.items[0].members[0].role).toBe("collaboration");
  });
});
