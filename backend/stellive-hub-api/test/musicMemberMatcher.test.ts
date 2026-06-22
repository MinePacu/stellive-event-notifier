import { describe, expect, it } from "vitest";

import { matchMusicMembers } from "../src/music/musicMemberMatcher.js";

const members = [
  { id: "ayatsuno-yuni", aliases: ["아야츠노 유니", "유니", "Yuni"] },
  { id: "shirayuki-hina", aliases: ["시라유키 히나", "히나", "Hina"] },
  { id: "akane-lize", aliases: ["아카네 리제", "리제", "Lize"] },
  { id: "aokumo-rin", aliases: ["아오쿠모 린", "린", "Rin"] },
];

describe("music member matcher", () => {
  it("links the source playlist member as main", () => {
    expect(matchMusicMembers({ sourceMemberId: "ayatsuno-yuni", title: "노래", description: "", members })).toEqual({
      links: [{ memberId: "ayatsuno-yuni", role: "main" }],
      diagnostics: [],
    });
  });

  it("links title and description alias matches as collaborations without duplicates", () => {
    expect(matchMusicMembers({
      sourceMemberId: "ayatsuno-yuni",
      title: "유니 x 히나 cover",
      description: "with Shirayuki Hina and 히나",
      members,
    })).toEqual({
      links: [
        { memberId: "ayatsuno-yuni", role: "main" },
        { memberId: "shirayuki-hina", role: "collaboration" },
      ],
      diagnostics: [],
    });
  });

  it("marks three or more matched members as group", () => {
    expect(matchMusicMembers({
      sourceMemberId: "ayatsuno-yuni",
      title: "유니 히나 리제",
      description: "",
      members,
    }).links).toEqual([
      { memberId: "ayatsuno-yuni", role: "group" },
      { memberId: "shirayuki-hina", role: "group" },
      { memberId: "akane-lize", role: "group" },
    ]);
  });

  it("returns an empty link list and diagnostic when no member matches", () => {
    expect(matchMusicMembers({ sourceMemberId: null, title: "unknown singer", description: "", members })).toEqual({
      links: [],
      diagnostics: ["no_member_match"],
    });
  });
});
