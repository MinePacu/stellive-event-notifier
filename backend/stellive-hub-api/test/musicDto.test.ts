import { describe, expect, it } from "vitest";

import type { MusicCatalogItem, MusicMemberSummary } from "../../../shared/schemas/domain.js";
import { createMusicCatalogDtoMapper } from "../src/music/musicDto.js";

const { toMusicCatalogDto } = createMusicCatalogDtoMapper(new Map([
  ["ayatsuno-yuni", {
    generationId: "gen1",
    generationName: "1기생",
    unitName: "Everys",
  }],
  ["sakihane-huya", {
    generationId: "gen1",
    generationName: "1기생",
    unitName: "Everys",
  }],
  ["shirayuki-hina", {
    generationId: "gen2",
    generationName: "2기생",
    unitName: "Universe",
  }],
]));

function musicItem(members: MusicMemberSummary[]): MusicCatalogItem {
  return {
    id: "music-1",
    youtubeVideoId: "abcdefghijk",
    title: "노래",
    type: "cover",
    publishedAt: null,
    thumbnailUrl: null,
    duration: null,
    members,
    youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk",
    sourcePlaylistId: null,
  };
}

function member(id: string): MusicMemberSummary {
  return { id, nameKo: id, nameEn: id, role: "main" };
}

describe("music DTO catalog metadata", () => {
  it("enriches members and emits a shared item generation from the catalog", () => {
    const dto = toMusicCatalogDto(musicItem([
      member("ayatsuno-yuni"),
      member("sakihane-huya"),
    ]));

    expect(dto.members).toEqual([
      expect.objectContaining({
        id: "ayatsuno-yuni",
        generationId: "gen1",
        generationName: "1기생",
        unitName: "Everys",
      }),
      expect.objectContaining({
        id: "sakihane-huya",
        generationId: "gen1",
        generationName: "1기생",
        unitName: "Everys",
      }),
    ]);
    expect(dto).toMatchObject({
      generationId: "gen1",
      generationName: "1기생",
    });
  });

  it("keeps item generation null for mixed or unknown catalog members", () => {
    const mixed = toMusicCatalogDto(musicItem([
      member("ayatsuno-yuni"),
      member("shirayuki-hina"),
    ]));
    const unknown = toMusicCatalogDto(musicItem([
      member("ayatsuno-yuni"),
      member("unknown-member"),
    ]));

    expect(mixed).toMatchObject({ generationId: null, generationName: null });
    expect(unknown).toMatchObject({ generationId: null, generationName: null });
    expect(unknown.members[1]).toMatchObject({
      generationId: null,
      generationName: null,
      unitName: null,
    });
  });
});
