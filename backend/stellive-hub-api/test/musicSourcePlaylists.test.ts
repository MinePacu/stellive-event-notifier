import { describe, expect, it } from "vitest";

import {
  TARGET_MUSIC_MEMBER_IDS,
  musicSourcePlaylistSeeds,
  musicSourceTypeForRawCategory,
} from "../src/music/musicSourcePlaylists.js";

describe("music source playlist seeds", () => {
  it("defines only the 10 target active Stellive member ids", () => {
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

  it("defines source playlist seed metadata without guessed playlist ids", () => {
    expect(musicSourcePlaylistSeeds).toEqual([
      {
        youtubePlaylistId: "",
        title: "Stellive MUSIC COVER",
        type: "cover",
        rawCategoryHint: "COVER",
        memberId: null,
        isActive: false,
      },
      {
        youtubePlaylistId: "",
        title: "Stellive MUSIC SINGLE",
        type: "original",
        rawCategoryHint: "SINGLE",
        memberId: null,
        isActive: false,
      },
      {
        youtubePlaylistId: "",
        title: "Stellive MUSIC EP",
        type: "original",
        rawCategoryHint: "EP",
        memberId: null,
        isActive: false,
      },
      {
        youtubePlaylistId: "",
        title: "Stellive MUSIC OTHERS",
        type: "other",
        rawCategoryHint: "OTHERS",
        memberId: null,
        isActive: false,
      },
    ]);
  });

  it("maps official MUSIC raw categories to source playlist types", () => {
    expect(musicSourceTypeForRawCategory("COVER")).toBe("cover");
    expect(musicSourceTypeForRawCategory("SINGLE")).toBe("original");
    expect(musicSourceTypeForRawCategory("EP")).toBe("original");
    expect(musicSourceTypeForRawCategory("OTHERS")).toBe("other");
    expect(musicSourceTypeForRawCategory("unknown")).toBe("unknown");
  });
});
