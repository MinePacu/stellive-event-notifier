import { describe, expect, it } from "vitest";

import { matchMusicMembers } from "../src/music/musicMemberMatcher.js";
import { matchMusicOriginalTitle } from "../src/music/musicOriginalTitleMatcher.js";

const members = [
  { id: "ayatsuno-yuni", nameKo: "아야츠노 유니", nameEn: "Ayatsuno Yuni", unitName: "Everys", aliases: ["아야츠노 유니", "유니", "Yuni"], youtubeChannelId: "UC_YUNI" },
  { id: "shirayuki-hina", nameKo: "시라유키 히나", nameEn: "Shirayuki Hina", unitName: "Universe", aliases: ["시라유키 히나", "히나", "Hina"], youtubeChannelId: "UC_HINA" },
  { id: "akane-lize", nameKo: "아카네 리제", nameEn: "Akane Lize", unitName: "Universe", aliases: ["아카네 리제", "리제", "Lize"], youtubeChannelId: "UC_LIZE" },
  { id: "aokumo-rin", nameKo: "아오쿠모 린", nameEn: "Aokumo Rin", unitName: "Cliche", aliases: ["아오쿠모 린", "린", "Rin"], youtubeChannelId: "UC_RIN" },
  { id: "tenko-shibuki", nameKo: "텐코 시부키", nameEn: "Tenko Shibuki", unitName: "Cliche", aliases: ["텐코 시부키", "시부키", "Shibuki"], youtubeChannelId: "UC_SHIBUKI" },
];

describe("music member matcher", () => {
  it("links source playlist member main with metadata", () => {
    expect(matchMusicMembers({ sourceMemberId: "ayatsuno-yuni", title: "노래", description: "", members })).toEqual({
      links: [{ memberId: "ayatsuno-yuni", role: "main", confidence: 0.9, source: "TITLE" }],
      diagnostics: [],
    });
  });

  it("prefers channel id match over text aliases", () => {
    expect(matchMusicMembers({
      channelId: "UC_HINA",
      title: "유니 cover",
      description: "",
      members,
    }).links[0]).toEqual({ memberId: "shirayuki-hina", role: "main", confidence: 1, source: "CHANNEL_ID" });
  });

  it("lets structured title performers win over channel and generic aliases", () => {
    const title = "아야츠노 유니 (AYATSUNO YUNI) | 'My Song'";
    const structuredOriginal = matchMusicOriginalTitle(title, members);
    expect(matchMusicMembers({
      channelId: "UC_HINA",
      title,
      description: "with Akane Lize",
      members,
      structuredOriginal,
    })).toEqual({
      links: [{
        memberId: "ayatsuno-yuni",
        role: "main",
        confidence: 0.95,
        source: "STRUCTURED_TITLE",
      }],
      diagnostics: ["matched/member"],
    });
  });

  it("links the bilingual Tenko regression as one main member without Cliche expansion", () => {
    const title =
      "텐코 시부키(Tenko Shibuki) | 베리 베리 스트로베리 'Berry Verry Strawberry'";
    const structuredOriginal = matchMusicOriginalTitle(title, members);

    expect(structuredOriginal.classification?.specialFlags).toContain("bilingual_song_title");
    expect(matchMusicMembers({
      channelId: "UC_SHIBUKI",
      title,
      description: "STELLIVE Cliche 1st EP",
      members,
      structuredOriginal,
    })).toEqual({
      links: [{
        memberId: "tenko-shibuki",
        role: "main",
        confidence: 0.95,
        source: "STRUCTURED_TITLE",
      }],
      diagnostics: ["matched/member"],
    });
  });

  it("links title description and channel title alias matches collaborations without duplicates", () => {
    expect(matchMusicMembers({
      title: "유니 x Hina cover",
      description: "with Akane Lize",
      channelTitle: "아오쿠모 린",
      members,
    }).links).toEqual([
      { memberId: "ayatsuno-yuni", role: "group", confidence: 0.8, source: "TITLE" },
      { memberId: "shirayuki-hina", role: "group", confidence: 0.8, source: "TITLE" },
      { memberId: "akane-lize", role: "group", confidence: 0.65, source: "DESCRIPTION" },
      { memberId: "aokumo-rin", role: "group", confidence: 0.55, source: "CHANNEL_TITLE" },
    ]);
  });

  it("limits fallback unit aliases to that unit with lower confidence and group role", () => {
    expect(matchMusicMembers({
      title: "STELLIVE uNiVeRsE original",
      description: "",
      members,
    })).toEqual({
      links: members
        .filter((member) => member.unitName === "Universe")
        .map((member) => ({
          memberId: member.id,
          role: "group",
          confidence: 0.4,
          source: "GROUP_ALIAS",
        })),
      diagnostics: ["group_alias_match"],
    });
  });

  it("never expands an unknown structured unit to every member", () => {
    expect(matchMusicMembers({
      title: "스텔라이브 (STELLIVE) MissingUnit | 'Song'",
      description: "",
      members,
    })).toEqual({
      links: [],
      diagnostics: ["partial/unknown_unit", "no_member_match"],
    });
  });

  it("links generic Stellive fallback aliases to all members", () => {
    expect(matchMusicMembers({
      title: "STELLIVE original",
      description: "",
      members,
    })).toEqual({
      links: members.map((member) => ({
        memberId: member.id,
        role: "group",
        confidence: 0.4,
        source: "GROUP_ALIAS",
      })),
      diagnostics: ["group_alias_match"],
    });
  });

  it("returns review diagnostic when no member is matched", () => {
    expect(matchMusicMembers({ title: "unknown song", description: "", members })).toEqual({
      links: [],
      diagnostics: ["no_member_match"],
    });
  });
});
