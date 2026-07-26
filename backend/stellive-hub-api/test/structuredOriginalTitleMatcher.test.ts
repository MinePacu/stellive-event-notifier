import { describe, expect, it } from "vitest";

import {
  assessMusicOriginalTitleTrust,
  matchMusicOriginalTitle,
  normalizeMusicOriginalTitle,
} from "../src/music/musicOriginalTitleMatcher.js";

const members = [
  {
    id: "ayatsuno-yuni",
    nameKo: "아야츠노 유니",
    nameEn: "Ayatsuno Yuni",
    unitName: "Everys",
  },
  {
    id: "shirayuki-hina",
    nameKo: "시라유키 히나",
    nameEn: "Shirayuki Hina",
    unitName: "Universe",
  },
  {
    id: "akane-lize",
    nameKo: "아카네 리제",
    nameEn: "Akane Lize",
    unitName: "Universe",
  },
  {
    id: "yuzuha-riko",
    nameKo: "유즈하 리코",
    nameEn: "Yuzuha Riko",
    unitName: "Cliche",
  },
  {
    id: "tenko-shibuki",
    nameKo: "텐코 시부키",
    nameEn: "Tenko Shibuki",
    unitName: "Cliche",
  },
];

describe("structured original title matcher", () => {
  it("normalizes Unicode, whitespace, and supported single quote variants", () => {
    expect(normalizeMusicOriginalTitle("  유즈하　리코 （YUZUHA RIKO）  |  ‘악당주의보’  "))
      .toBe("유즈하 리코 (YUZUHA RIKO) | '악당주의보'");
    expect(normalizeMusicOriginalTitle(
      "  텐코　시부키（TENKO SHIBUKI） | 베리　베리 스트로베리 ‘Berry Verry Strawberry’ ",
    )).toBe("텐코 시부키(TENKO SHIBUKI) | 베리 베리 스트로베리 'Berry Verry Strawberry'");
  });

  it.each([
    {
      videoId: "P_oxx3_VpIY",
      title: "유즈하 리코(Yuzuha Riko) | '악당주의보'",
      kind: "member",
      memberIds: ["yuzuha-riko"],
      reason: "structured_original_member_title",
    },
    {
      videoId: "nsZmnwC9ukE",
      title: "텐코 시부키(Tenko Shibuki) | 베리 베리 스트로베리 'Berry Verry Strawberry'",
      kind: "member",
      memberIds: ["tenko-shibuki"],
      reason: "structured_original_member_title",
    },
  ])("matches fixed regression $videoId from title metadata without ID rules", (fixture) => {
    const result = matchMusicOriginalTitle(fixture.title, members);

    expect(result).toMatchObject({
      status: "matched",
      kind: fixture.kind,
      reason: null,
      exact: true,
      partial: false,
      memberIds: fixture.memberIds,
      classification: {
        type: "original",
        confidence: 0.95,
        reason: fixture.reason,
      },
    });
    expect(result.classification?.specialFlags).toEqual(
      fixture.videoId === "nsZmnwC9ukE"
        ? ["structured_original_title", "bilingual_song_title"]
        : ["structured_original_title"],
    );
  });

  it("matches member English names and unit names case-insensitively with optional pre-parenthesis spacing", () => {
    expect(matchMusicOriginalTitle(
      "유즈하 리코 (yUzUhA rIkO) | '악당주의보'",
      members,
    )).toMatchObject({
      status: "matched",
      kind: "member",
      memberIds: ["yuzuha-riko"],
      songTitle: "악당주의보",
      titleForm: "quoted",
      localizedSongTitle: null,
      englishSongTitle: null,
      displaySongTitle: "악당주의보",
    });
    expect(matchMusicOriginalTitle(
      "스텔라이브 (StelLive) Cliche | '노래 제목'",
      members,
    )).toMatchObject({
      status: "matched",
      kind: "unit",
      memberIds: ["yuzuha-riko", "tenko-shibuki"],
    });
  });

  it("matches the whole Stellive format to every active music target", () => {
    expect(matchMusicOriginalTitle(
      "스텔라이브 (STELLIVE) | 'Our Song'",
      members,
    )).toMatchObject({
      status: "matched",
      kind: "stellive",
      memberIds: members.map((member) => member.id),
      classification: {
        reason: "structured_original_stellive_title",
      },
    });
  });

  it("parses member, unit, and whole-Stellive bilingual song forms without expanding member titles", () => {
    expect(matchMusicOriginalTitle(
      "텐코 시부키(Tenko Shibuki) | 베리 베리 스트로베리 'Berry Verry Strawberry'",
      members,
    )).toMatchObject({
      status: "matched",
      kind: "member",
      memberIds: ["tenko-shibuki"],
      songTitle: "베리 베리 스트로베리",
      titleForm: "bilingual",
      localizedSongTitle: "베리 베리 스트로베리",
      englishSongTitle: "Berry Verry Strawberry",
      displaySongTitle: "베리 베리 스트로베리",
      classification: {
        specialFlags: ["structured_original_title", "bilingual_song_title"],
      },
    });
    expect(matchMusicOriginalTitle(
      "스텔라이브 (STELLIVE) Universe | 마음악보 'Score of the Heart'",
      members,
    )).toMatchObject({
      status: "matched",
      kind: "unit",
      memberIds: ["shirayuki-hina", "akane-lize"],
      titleForm: "bilingual",
      localizedSongTitle: "마음악보",
      englishSongTitle: "Score of the Heart",
      displaySongTitle: "마음악보",
    });
    expect(matchMusicOriginalTitle(
      "스텔라이브 (STELLIVE) | 우리의 노래 'Our Song'",
      members,
    )).toMatchObject({
      status: "matched",
      kind: "stellive",
      memberIds: members.map((member) => member.id),
      titleForm: "bilingual",
      localizedSongTitle: "우리의 노래",
      englishSongTitle: "Our Song",
      displaySongTitle: "우리의 노래",
    });
  });

  it("accepts a bilingual song title without whitespace before the terminal English quote", () => {
    expect(matchMusicOriginalTitle(
      "텐코 시부키(Tenko Shibuki) | 베리 베리 스트로베리'Berry Verry Strawberry'",
      members,
    )).toMatchObject({
      status: "matched",
      kind: "member",
      memberIds: ["tenko-shibuki"],
      songTitle: "베리 베리 스트로베리",
      titleForm: "bilingual",
      localizedSongTitle: "베리 베리 스트로베리",
      englishSongTitle: "Berry Verry Strawberry",
      displaySongTitle: "베리 베리 스트로베리",
      classification: {
        specialFlags: ["structured_original_title", "bilingual_song_title"],
      },
    });
  });

  it.each([
    ["없는 멤버(Unknown Member) | 'Song'", "unknown_member"],
    ["유즈하 리코(Ayatsuno Yuni) | 'Song'", "member_name_pair_mismatch"],
    ["스텔라이브 (STELLIVE) MissingUnit | 'Song'", "unknown_unit"],
    ["유즈하 리코(Yuzuha Riko) | 악당주의보", "malformed_song_quotes"],
    ["유즈하 리코(Yuzuha Riko) | '악당주의보", "malformed_song_quotes"],
    ["유즈하 리코(Yuzuha Riko) | ''", "malformed_song_quotes"],
    ["유즈하 리코(Yuzuha Riko) '악당주의보'", "malformed_separator"],
    ["스텔라이브 (STELLIVE) || 'Song'", "malformed_separator"],
  ])("returns a reviewable partial status for %s", (title, reason) => {
    expect(matchMusicOriginalTitle(title, members)).toMatchObject({
      status: "partial",
      reason,
      exact: false,
      partial: true,
      classification: null,
    });
  });

  it.each([
    [
      "텐코 시부키(Tenko Shibuki) | 베리 베리 Strawberry",
      "missing_bilingual_english_quotes",
    ],
    [
      "텐코 시부키(Tenko Shibuki) | 베리 베리 ''",
      "empty_english_song_title",
    ],
    [
      "텐코 시부키(Tenko Shibuki) | 베리 베리 'Berry' teaser",
      "non_terminal_english_title",
    ],
    [
      "텐코 시부키(Tenko Shibuki) | 베리 'Berry' 딸기 'Strawberry'",
      "multiple_quoted_song_segments",
    ],
    [
      "텐코 시부키(Tenko Shibuki) | Berry 'Strawberry'",
      "localized_song_title_without_hangul",
    ],
    [
      "텐코 시부키(Tenko Shibuki) | 베리 '딸기'",
      "english_song_title_without_latin",
    ],
  ])("keeps invalid bilingual near-form %s partial with a focused detail flag", (title, detailFlag) => {
    const result = matchMusicOriginalTitle(title, members);
    expect(result).toMatchObject({
      status: "partial",
      reason: "malformed_song_quotes",
      titleForm: null,
      localizedSongTitle: null,
      englishSongTitle: null,
      displaySongTitle: null,
      detailFlags: [detailFlag],
    });
    expect(assessMusicOriginalTitleTrust(result, {
      kind: "member",
      memberId: "tenko-shibuki",
    }).specialFlags).toEqual([
      "partial_structured_original_title",
      "structured_original_malformed_song_quotes",
      detailFlag,
    ]);
  });

  it("does not broaden exact matching for unpaired or repeated terminal quote segments", () => {
    for (const title of [
      "텐코 시부키(Tenko Shibuki) | 베리 베리 'Berry",
      "텐코 시부키(Tenko Shibuki) | 베리 베리 'Berry''",
    ]) {
      expect(matchMusicOriginalTitle(title, members)).toMatchObject({
        status: "partial",
        reason: "malformed_song_quotes",
        exact: false,
      });
    }
  });

  it("does not treat arbitrary quoted titles as structured Stellive originals", () => {
    expect(matchMusicOriginalTitle(
      "게임 방송 | '오늘의 하이라이트'",
      members,
    )).toMatchObject({
      status: "none",
      exact: false,
      partial: false,
    });
  });

  it("applies channel trust rules without video-id exceptions", () => {
    const memberMatch = matchMusicOriginalTitle(
      "유즈하 리코(Yuzuha Riko) | '악당주의보'",
      members,
    );
    expect(assessMusicOriginalTitleTrust(memberMatch, {
      kind: "member",
      memberId: "yuzuha-riko",
    })).toMatchObject({
      shouldPersist: true,
      autoClassify: true,
      needsReview: false,
      reason: "trusted_member_title",
    });
    expect(assessMusicOriginalTitleTrust(memberMatch, {
      kind: "member",
      memberId: "ayatsuno-yuni",
    })).toMatchObject({
      shouldPersist: true,
      autoClassify: false,
      needsReview: true,
      isExcluded: true,
      reason: "member_channel_title_mismatch",
    });
    expect(assessMusicOriginalTitleTrust(memberMatch, {
      kind: "stellive_official",
    })).toMatchObject({
      shouldPersist: true,
      autoClassify: false,
      needsReview: true,
      isExcluded: true,
      reason: "member_title_on_official_channel",
    });
    expect(assessMusicOriginalTitleTrust(memberMatch, null)).toMatchObject({
      shouldPersist: false,
      reason: "untrusted_channel",
    });
  });

  it("adds detailed flags to partial structured titles", () => {
    const partial = matchMusicOriginalTitle(
      "유즈하 리코(Yuzuha Riko) | 악당주의보",
      members,
    );
    expect(assessMusicOriginalTitleTrust(partial, {
      kind: "member",
      memberId: "yuzuha-riko",
    })).toMatchObject({
      needsReview: true,
      isExcluded: true,
      specialFlags: [
        "partial_structured_original_title",
        "structured_original_malformed_song_quotes",
      ],
    });
  });
});
