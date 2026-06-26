import { describe, expect, it } from "vitest";
import { CatalogService } from "../src/catalog/catalog.js";

const catalog = new CatalogService();
const musicMemberIds = [
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
];

describe("catalog seed policy", () => {
  it("contains no Former entries", () => {
    expect(catalog.assertNoFormerMembers()).toBe(true);
  });

  it("includes Gangzi in gamja as representative", () => {
    const gangzi = catalog.getMember("gangzi");
    expect(gangzi?.generationId).toBe("gamja");
    expect(gangzi?.generationName).toBe("감자");
    expect(gangzi?.catalogRole).toBe("representative");
    expect(gangzi?.roleLabel).toBe("스텔라이브 대표");
  });

  it("includes Stellive official channel in official category and excludes official YouTube live", () => {
    const official = catalog.getMember("stellive-official");
    expect(official?.generationId).toBe("official");
    expect(official?.generationName).toBe("기타");
    expect(official?.catalogRole).toBe("official_channel");
    expect(official?.platforms.youtubeChannelId).toBe("UC2b4WRE5BZ6SIUWBeJU8rwg");
    expect(official?.platforms.youtubeHandle).toBe("@stellive_official");
    expect(official?.platforms.xHandle).toBe("StelLive_kr");
    expect(catalog.isSupportedEventForMember("stellive-official", "official_youtube_upload")).toBe(true);
    expect(catalog.isSupportedEventForMember("stellive-official", "youtube_live_started")).toBe(false);
  });

  it("defines YouTube channel IDs for all target music members", () => {
    const missing = musicMemberIds.filter((memberId) => !catalog.getMember(memberId)?.platforms.youtubeChannelId);

    expect(missing).toEqual([]);
    expect(catalog.getMember("ayatsuno-yuni")?.platforms.youtubeChannelId).toBe("UClbYIn9LDbbFZ9w2shX3K0g");
    expect(catalog.getMember("shirayuki-hina")?.platforms.youtubeChannelId).toBe("UC1afpiIuBDcjYlmruAa0HiA");
    expect(catalog.getMember("neneko-mashiro")?.platforms.youtubeChannelId).toBe("UCnQt1xFonbwyexeHfYe6VaA");
    expect(catalog.getMember("akane-lize")?.platforms.youtubeChannelId).toBe("UC7-m6jQLinZQWIbwm9W-1iw");
    expect(catalog.getMember("arahashi-tabi")?.platforms.youtubeChannelId).toBe("UCAHVQ44O81aehLWfy9O6Elw");
  });
});
