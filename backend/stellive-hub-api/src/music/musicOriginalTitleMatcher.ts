export interface MusicOriginalTitleMember {
  id: string;
  nameKo?: string | null;
  nameEn?: string | null;
  unitName?: string | null;
}

export type MusicOriginalTitleMatchKind = "member" | "unit" | "stellive";

export type MusicOriginalTitleForm = "quoted" | "bilingual";

export type MusicOriginalTitlePartialReason =
  | "unknown_member"
  | "member_name_pair_mismatch"
  | "unknown_unit"
  | "malformed_song_quotes"
  | "malformed_separator";

export type MusicOriginalTitleMatchStatus = "matched" | "partial" | "none";

export interface MusicOriginalTitleMatch {
  status: MusicOriginalTitleMatchStatus;
  reason: MusicOriginalTitlePartialReason | null;
  normalizedTitle: string;
  memberIds: string[];
  songTitle: string | null;
  titleForm: MusicOriginalTitleForm | null;
  localizedSongTitle: string | null;
  englishSongTitle: string | null;
  displaySongTitle: string | null;
  detailFlags: string[];
  kind: MusicOriginalTitleMatchKind | null;
  exact: boolean;
  partial: boolean;
  classification: {
    type: "original";
    confidence: 0.95;
    reason:
      | "structured_original_member_title"
      | "structured_original_unit_title"
      | "structured_original_stellive_title";
    specialFlags: string[];
  } | null;
}

export type MusicDiscoveryChannelKind = "member" | "stellive_official";

export interface MusicDiscoveryChannelTrust {
  kind: MusicDiscoveryChannelKind;
  memberId?: string | null;
}

export type MusicOriginalTitleTrustReason =
  | "not_structured_original_title"
  | "untrusted_channel"
  | "trusted_member_title"
  | "trusted_unit_title"
  | "trusted_stellive_title"
  | "member_title_on_official_channel"
  | "member_channel_title_mismatch"
  | "member_channel_unit_mismatch"
  | "member_channel_stellive_mismatch"
  | MusicOriginalTitlePartialReason;

export interface MusicOriginalTitleTrustAssessment {
  shouldPersist: boolean;
  autoClassify: boolean;
  needsReview: boolean;
  isExcluded: boolean;
  reason: MusicOriginalTitleTrustReason;
  specialFlags: string[];
}

interface ParsedSongTitle {
  titleForm: MusicOriginalTitleForm;
  localizedSongTitle: string | null;
  englishSongTitle: string | null;
  displaySongTitle: string;
}

const exactQuotedSongPattern = /^'([^']+)'$/u;
const exactBilingualSongPattern = /^([^']+?)\s*'([^']+)'$/u;
const hangulPattern = /\p{Script=Hangul}/u;
const latinPattern = /\p{Script=Latin}/u;
const personalPerformerPattern = /^(.+?)\s*\(\s*([^)]+?)\s*\)$/u;
const stellivePerformerPattern = /^스텔라이브\s*\(\s*stellive\s*\)(?:\s+(.+))?$/iu;

export function normalizeMusicOriginalTitle(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[‘’＇`´]/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

export function matchMusicOriginalTitle(
  title: string,
  members: MusicOriginalTitleMember[],
): MusicOriginalTitleMatch {
  const normalizedTitle = normalizeMusicOriginalTitle(title);
  const separatorCount = [...normalizedTitle].filter((character) => character === "|").length;
  if (separatorCount !== 1) {
    return resemblesKnownStructuredPerformer(normalizedTitle, members)
      ? partialMatch(normalizedTitle, "malformed_separator", inferKind(normalizedTitle))
      : noMatch(normalizedTitle);
  }

  const [rawPerformer = "", rawSongTitle = ""] = normalizedTitle.split("|");
  const performer = rawPerformer.trim();
  if (!performer || !rawSongTitle.trim()) {
    return resemblesStructuredPerformer(performer, members)
      ? partialMatch(normalizedTitle, "malformed_separator", inferKind(performer))
      : noMatch(normalizedTitle);
  }

  const stelliveMatch = stellivePerformerPattern.exec(performer);
  if (stelliveMatch) {
    const unitName = stelliveMatch[1]?.trim();
    if (!unitName) {
      const parsedSongTitle = parseSongTitle(rawSongTitle);
      return parsedSongTitle
        ? exactMatch(normalizedTitle, "stellive", members.map((member) => member.id), parsedSongTitle)
        : partialMatch(
          normalizedTitle,
          "malformed_song_quotes",
          "stellive",
          diagnoseMalformedSongTitle(rawSongTitle),
        );
    }

    const unitMembers = members.filter((member) =>
      member.unitName && normalizeComparable(member.unitName) === normalizeComparable(unitName)
    );
    if (unitMembers.length === 0) {
      return partialMatch(normalizedTitle, "unknown_unit", "unit");
    }
    const parsedSongTitle = parseSongTitle(rawSongTitle);
    return parsedSongTitle
      ? exactMatch(normalizedTitle, "unit", unitMembers.map((member) => member.id), parsedSongTitle)
      : partialMatch(
        normalizedTitle,
        "malformed_song_quotes",
        "unit",
        diagnoseMalformedSongTitle(rawSongTitle),
      );
  }

  const personalMatch = personalPerformerPattern.exec(performer);
  if (!personalMatch) return noMatch(normalizedTitle);

  const koreanName = personalMatch[1].trim();
  const englishName = personalMatch[2].trim();
  const koreanMember = members.find((member) =>
    member.nameKo && normalizeComparable(member.nameKo) === normalizeComparable(koreanName)
  );
  const englishMember = members.find((member) =>
    member.nameEn && normalizeComparable(member.nameEn) === normalizeComparable(englishName)
  );

  if (!koreanMember && !englishMember) {
    return partialMatch(normalizedTitle, "unknown_member", "member");
  }
  if (!koreanMember || !englishMember || koreanMember.id !== englishMember.id) {
    return partialMatch(normalizedTitle, "member_name_pair_mismatch", "member");
  }

  const parsedSongTitle = parseSongTitle(rawSongTitle);
  return parsedSongTitle
    ? exactMatch(normalizedTitle, "member", [koreanMember.id], parsedSongTitle)
    : partialMatch(
      normalizedTitle,
      "malformed_song_quotes",
      "member",
      diagnoseMalformedSongTitle(rawSongTitle),
    );
}

export function assessMusicOriginalTitleTrust(
  match: MusicOriginalTitleMatch,
  channel: MusicDiscoveryChannelTrust | null | undefined,
): MusicOriginalTitleTrustAssessment {
  if (match.status === "none") {
    return assessment(true, false, false, false, "not_structured_original_title", []);
  }
  if (!channel || (channel.kind === "member" && !channel.memberId)) {
    return assessment(false, false, false, true, "untrusted_channel", structuredFlags(match));
  }
  if (match.status === "partial") {
    return assessment(
      true,
      false,
      true,
      true,
      match.reason ?? "malformed_separator",
      structuredFlags(match),
    );
  }

  if (channel.kind === "stellive_official") {
    if (match.kind === "member") {
      return assessment(
        true,
        false,
        true,
        true,
        "member_title_on_official_channel",
        [...structuredFlags(match), "structured_original_member_on_official_channel"],
      );
    }
    return assessment(
      true,
      true,
      false,
      false,
      match.kind === "unit" ? "trusted_unit_title" : "trusted_stellive_title",
      structuredFlags(match),
    );
  }

  if (match.memberIds.includes(channel.memberId ?? "")) {
    return assessment(
      true,
      true,
      false,
      false,
      match.kind === "member"
        ? "trusted_member_title"
        : match.kind === "unit"
          ? "trusted_unit_title"
          : "trusted_stellive_title",
      structuredFlags(match),
    );
  }

  const reason = match.kind === "member"
    ? "member_channel_title_mismatch"
    : match.kind === "unit"
      ? "member_channel_unit_mismatch"
      : "member_channel_stellive_mismatch";
  return assessment(
    true,
    false,
    true,
    true,
    reason,
    [...structuredFlags(match), `structured_original_${reason}`],
  );
}

function exactMatch(
  normalizedTitle: string,
  kind: MusicOriginalTitleMatchKind,
  memberIds: string[],
  parsedSongTitle: ParsedSongTitle,
): MusicOriginalTitleMatch {
  const reason = kind === "member"
    ? "structured_original_member_title"
    : kind === "unit"
      ? "structured_original_unit_title"
      : "structured_original_stellive_title";
  return {
    status: "matched",
    reason: null,
    normalizedTitle,
    memberIds,
    songTitle: parsedSongTitle.displaySongTitle,
    titleForm: parsedSongTitle.titleForm,
    localizedSongTitle: parsedSongTitle.localizedSongTitle,
    englishSongTitle: parsedSongTitle.englishSongTitle,
    displaySongTitle: parsedSongTitle.displaySongTitle,
    detailFlags: [],
    kind,
    exact: true,
    partial: false,
    classification: {
      type: "original",
      confidence: 0.95,
      reason,
      specialFlags: parsedSongTitle.titleForm === "bilingual"
        ? ["structured_original_title", "bilingual_song_title"]
        : ["structured_original_title"],
    },
  };
}

function partialMatch(
  normalizedTitle: string,
  reason: MusicOriginalTitlePartialReason,
  kind: MusicOriginalTitleMatchKind,
  detailFlags: string[] = [],
): MusicOriginalTitleMatch {
  return {
    status: "partial",
    reason,
    normalizedTitle,
    memberIds: [],
    songTitle: null,
    titleForm: null,
    localizedSongTitle: null,
    englishSongTitle: null,
    displaySongTitle: null,
    detailFlags,
    kind,
    exact: false,
    partial: true,
    classification: null,
  };
}

function noMatch(normalizedTitle: string): MusicOriginalTitleMatch {
  return {
    status: "none",
    reason: null,
    normalizedTitle,
    memberIds: [],
    songTitle: null,
    titleForm: null,
    localizedSongTitle: null,
    englishSongTitle: null,
    displaySongTitle: null,
    detailFlags: [],
    kind: null,
    exact: false,
    partial: false,
    classification: null,
  };
}

function parseSongTitle(value: string): ParsedSongTitle | null {
  const normalized = value.trim();
  const quotedMatch = exactQuotedSongPattern.exec(normalized);
  const quotedSongTitle = quotedMatch?.[1]?.trim();
  if (quotedSongTitle) {
    return {
      titleForm: "quoted",
      localizedSongTitle: null,
      englishSongTitle: null,
      displaySongTitle: quotedSongTitle,
    };
  }

  const bilingualMatch = exactBilingualSongPattern.exec(normalized);
  const localizedSongTitle = bilingualMatch?.[1]?.trim();
  const englishSongTitle = bilingualMatch?.[2]?.trim();
  if (
    !localizedSongTitle ||
    !englishSongTitle ||
    !hangulPattern.test(localizedSongTitle) ||
    !latinPattern.test(englishSongTitle)
  ) {
    return null;
  }
  return {
    titleForm: "bilingual",
    localizedSongTitle,
    englishSongTitle,
    displaySongTitle: localizedSongTitle,
  };
}

function diagnoseMalformedSongTitle(value: string): string[] {
  const normalized = value.trim();
  const quoteIndexes = [...normalized.matchAll(/'/gu)].map((match) => match.index);
  if (quoteIndexes.length === 0) {
    return hangulPattern.test(normalized) && latinPattern.test(normalized)
      ? ["missing_bilingual_english_quotes"]
      : [];
  }

  const firstQuoteIndex = quoteIndexes[0] ?? 0;
  const localizedCandidate = normalized.slice(0, firstQuoteIndex).trim();
  if (!localizedCandidate) return [];
  if (quoteIndexes.length > 2) return ["multiple_quoted_song_segments"];
  if (quoteIndexes.length !== 2) return [];

  const secondQuoteIndex = quoteIndexes[1] ?? normalized.length;
  if (secondQuoteIndex !== normalized.length - 1) {
    return ["non_terminal_english_title"];
  }

  const englishCandidate = normalized.slice(firstQuoteIndex + 1, secondQuoteIndex).trim();
  if (!englishCandidate) return ["empty_english_song_title"];
  if (!hangulPattern.test(localizedCandidate)) return ["localized_song_title_without_hangul"];
  if (!latinPattern.test(englishCandidate)) return ["english_song_title_without_latin"];
  return [];
}

function resemblesKnownStructuredPerformer(
  value: string,
  members: MusicOriginalTitleMember[],
): boolean {
  const performer = value.split("|", 1)[0]?.trim() ?? "";
  if (/^스텔라이브(?:\s|\(|$)/iu.test(performer)) return true;
  const performerPrefix = /^(.+?\s*\(\s*[^)]+\s*\))/u.exec(performer)?.[1] ?? performer;
  const personalMatch = personalPerformerPattern.exec(performerPrefix);
  if (!personalMatch) return false;
  const names = [personalMatch[1], personalMatch[2]].map(normalizeComparable);
  return members.some((member) =>
    [member.nameKo, member.nameEn]
      .filter((name): name is string => Boolean(name))
      .some((name) => names.includes(normalizeComparable(name)))
  );
}

function resemblesStructuredPerformer(
  value: string,
  members: MusicOriginalTitleMember[],
): boolean {
  return stellivePerformerPattern.test(value) ||
    personalPerformerPattern.test(value) ||
    resemblesKnownStructuredPerformer(value, members);
}

function inferKind(value: string): MusicOriginalTitleMatchKind {
  if (/^스텔라이브(?:\s|\(|$)/iu.test(value)) {
    return stellivePerformerPattern.exec(value)?.[1]?.trim() ? "unit" : "stellive";
  }
  return "member";
}

function structuredFlags(match: MusicOriginalTitleMatch): string[] {
  if (match.status === "partial") {
    return [
      "partial_structured_original_title",
      `structured_original_${match.reason ?? "malformed_separator"}`,
      ...match.detailFlags,
    ];
  }
  return match.classification?.specialFlags ?? ["structured_original_title"];
}

function assessment(
  shouldPersist: boolean,
  autoClassify: boolean,
  needsReview: boolean,
  isExcluded: boolean,
  reason: MusicOriginalTitleTrustReason,
  specialFlags: string[],
): MusicOriginalTitleTrustAssessment {
  return {
    shouldPersist,
    autoClassify,
    needsReview,
    isExcluded,
    reason,
    specialFlags,
  };
}

function normalizeComparable(value: string): string {
  return normalizeMusicOriginalTitle(value).toLocaleLowerCase("ko-KR");
}
