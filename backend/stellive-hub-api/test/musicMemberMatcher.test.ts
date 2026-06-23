import { describe, expect, it } from "vitest";

import { matchMusicMembers } from "../src/music/musicMemberMatcher.js";

const members = [
  { id: "ayatsuno-yuni", aliases: ["아야츠노 유니", "유니", "Yuni"], youtubeChannelId: "UC_YUNI" },
  { id: "shirayuki-hina", aliases: ["시라유키 히나", "히나", "Hina"], youtubeChannelId: "UC_HINA" },
  { id: "akane-lize", aliases: ["아카네 리제", "리제", "Lize"], youtubeChannelId: "UC_LIZE" },
  { id: "aokumo-rin", aliases: ["아오쿠모 린", "린", "Rin"], youtubeChannelId: "UC_RIN" },
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

  it("links group aliases with lower confidence and group role", () => {
    expect(matchMusicMembers({
      title: "STELLIVE Universe original",
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
