import { describe, expect, it } from "vitest";
import { CatalogService } from "../src/catalog/catalog.js";

const catalog = new CatalogService();

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
});

