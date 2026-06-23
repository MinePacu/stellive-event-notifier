import { describe, expect, it } from "vitest";

import {
  OFFICIAL_STELLIVE_MUSIC_COVER_PLAYLIST_ID,
  OFFICIAL_STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID,
  TARGET_MUSIC_MEMBER_IDS,
  musicSourcePlaylistSeeds,
  musicSourceTypeForRawCategory,
  officialStelliveMusicSourcePlaylistSeeds,
} from "../src/music/musicSourcePlaylists.js";

describe("music source playlist seeds", () => {
  it("defines only 10 target active Stellive member ids", () => {
    expect(TARGET_MUSIC_MEMBER_IDS).toEqual([
      "ayatsuno-yuni",
      "sakihane-huya",
      "shirayuki-hina",
      "neneko-mashiro",
      "akane-lize",
      "arahashi-tabi",
      "tenko-shibuki",
      "aokumo-rin",
      "yuzuha-riko",
      "hanako-nana",
    ]);

    expect(TARGET_MUSIC_MEMBER_IDS).not.toContain("gangzi");
    expect(TARGET_MUSIC_MEMBER_IDS).not.toContain("stellive-official");
    expect(TARGET_MUSIC_MEMBER_IDS).not.toContain("gen4-placeholder");
  });

  it("keeps legacy placeholder source playlist metadata inactive", () => {
    expect(musicSourcePlaylistSeeds.every((seed) => seed.youtubePlaylistId === "")).toBe(true);
    expect(musicSourcePlaylistSeeds.every((seed) => seed.isActive === false)).toBe(true);
  });

  it("defines official Stellive music playlist seeds as active catalog sync sources", () => {
    expect(OFFICIAL_STELLIVE_MUSIC_COVER_PLAYLIST_ID).toBe("PLLjd981H8qSN9PQ8-X6wINqBF1GjGxusy");
    expect(OFFICIAL_STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID).toBe("PLLjd981H8qSMGC4Nir0hD2Gj9n9PDUoHX");
    expect(officialStelliveMusicSourcePlaylistSeeds).toEqual([
      {
        youtubePlaylistId: "PLLjd981H8qSN9PQ8-X6wINqBF1GjGxusy",
        title: "Stellive Official Music COVER",
        type: "cover",
        rawCategoryHint: "COVER",
        memberId: null,
        isActive: true,
      },
      {
        youtubePlaylistId: "PLLjd981H8qSMGC4Nir0hD2Gj9n9PDUoHX",
        title: "Stellive Official Music ORIGINAL",
        type: "original",
        rawCategoryHint: "ORIGINAL",
        memberId: null,
        isActive: true,
      },
    ]);
  });

  it("maps official MUSIC raw categories source playlist types", () => {
    expect(musicSourceTypeForRawCategory("COVER")).toBe("cover");
    expect(musicSourceTypeForRawCategory("SINGLE")).toBe("original");
    expect(musicSourceTypeForRawCategory("EP")).toBe("original");
    expect(musicSourceTypeForRawCategory("ORIGINAL")).toBe("original");
    expect(musicSourceTypeForRawCategory("OTHERS")).toBe("other");
    expect(musicSourceTypeForRawCategory("unknown")).toBe("unknown");
  });
});
