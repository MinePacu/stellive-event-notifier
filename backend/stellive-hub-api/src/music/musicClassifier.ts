import type { MusicItemType } from "../../../../shared/schemas/domain.js";

export interface MusicSourceClassificationInput {
  type: "cover" | "original" | "other";
  rawCategoryHint?: string | null;
  originalLike?: boolean;
}

const precedence: Record<MusicItemType, number> = {
  original: 4,
  cover: 3,
  other: 2,
  unknown: 1,
};

export function classifyMusicSource(input: MusicSourceClassificationInput | null | undefined): MusicItemType {
  if (!input) return "unknown";
  if (input.type === "original") return "original";
  if (input.type === "cover") return "cover";
  if (input.type === "other" && input.originalLike) return "original";
  if (input.type === "other") return "other";
  return "unknown";
}

export function mergeMusicItemTypes(types: MusicItemType[]): MusicItemType {
  return types.reduce<MusicItemType>((selected, candidate) => (
    precedence[candidate] > precedence[selected] ? candidate : selected
  ), "unknown");
}

export type MusicClassificationStatus = "AUTO_CLASSIFIED" | "NEEDS_REVIEW" | "MANUAL_CONFIRMED" | "MANUAL_EXCLUDED";

export interface MusicVideoClassificationInput {
  sourceTypes: MusicItemType[];
  title: string;
  description?: string | null;
  duration?: string | null;
  privacyStatus?: string | null;
  specialFlags?: string[] | null;
}

export interface MusicVideoClassificationResult {
  type: MusicItemType;
  classificationStatus: MusicClassificationStatus;
  durationSeconds: number | null;
  isAvailable: boolean;
  isExcluded: boolean;
  exclusionReason: string | null;
  isInstrumental: boolean;
  specialFlags: string[];
}

const instrumentalPattern = /\b(inst\.?|instrumental|off\s*vocal|mr)\b/i;
const coverTitlePattern = /커버|\bcover\b|covered by|歌ってみた/i;
const exclusionPatterns: Array<[RegExp, string]> = [
  [/#?shorts\b/i, "shorts"],
  [/\bteaser\b|티저/i, "teaser"],
  [/\btrailer\b/i, "trailer"],
  [/\bpreview\b/i, "preview"],
  [/\blive\s*clip\b/i, "live_clip"],
  [/\b3d\s*live\b/i, "3d_live"],
  [/\bbehind\b/i, "behind"],
  [/\bmaking\b/i, "making"],
];
const specialFlagPatterns: Array<[RegExp, string]> = [
  [/메들리|\bmedley\b/i, "medley"],
  [/\bmashup\b/i, "mashup"],
  [/\bost\b/i, "ost"],
  [/\bremix\b/i, "remix"],
];

export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

export function parseDurationToSeconds(isoDuration: string | null | undefined): number | null {
  if (!isoDuration) return null;
  const match = /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(isoDuration);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export function detectInstrumental(title: string): boolean {
  return instrumentalPattern.test(title);
}

export function detectExcludeCandidate(
  title: string,
  description: string | null | undefined,
): { isExcluded: boolean; reason: string | null } {
  const haystack = `${title}\n${description ?? ""}`;
  const matched = exclusionPatterns.find(([pattern, reason]) => {
    if (reason === "3d_live" && coverTitlePattern.test(title)) return false;
    return pattern.test(haystack);
  });
  return matched ? { isExcluded: true, reason: matched[1] } : { isExcluded: false, reason: null };
}

export function detectSpecialFlags(title: string, description: string | null | undefined): string[] {
  const haystack = `${title}\n${description ?? ""}`;
  const flags = specialFlagPatterns
    .filter(([pattern]) => pattern.test(haystack))
    .map(([, flag]) => flag);
  return [...new Set(flags)];
}

export function classifyVideo(input: MusicVideoClassificationInput): MusicVideoClassificationResult {
  const sourceTypes = [...new Set(input.sourceTypes.filter((type) => type !== "unknown"))];
  const type = mergeMusicItemTypes(sourceTypes);
  const durationSeconds = parseDurationToSeconds(input.duration);
  const exclusion = detectExcludeCandidate(input.title, input.description);
  const specialFlags = [...new Set([
    ...(input.specialFlags ?? []),
    ...detectSpecialFlags(input.title, input.description),
  ])];
  const isInstrumental = detectInstrumental(input.title);
  const isAvailable = !input.privacyStatus || ["public", "unlisted"].includes(input.privacyStatus.toLocaleLowerCase("en-US"));

  if (durationSeconds !== null && durationSeconds < 90) {
    specialFlags.push("short_or_preview");
  }
  if (durationSeconds !== null && durationSeconds > 15 * 60) {
    specialFlags.push("live_or_long_form");
  }

  const isPlaylistCompilation = specialFlags.includes("playlist_compilation");
  const hasReviewSpecialFlag = specialFlags.some((flag) => !(
    flag === "structured_original_title" ||
    flag === "bilingual_song_title" ||
    (isPlaylistCompilation && (flag === "playlist_compilation" || flag === "live_or_long_form"))
  ));
  const needsReview =
    sourceTypes.length > 1 ||
    !isAvailable ||
    isInstrumental ||
    exclusion.isExcluded ||
    (durationSeconds !== null && durationSeconds < 60) ||
    hasReviewSpecialFlag;

  return {
    type,
    classificationStatus: needsReview ? "NEEDS_REVIEW" : "AUTO_CLASSIFIED",
    durationSeconds,
    isAvailable,
    isExcluded: exclusion.isExcluded,
    exclusionReason: exclusion.reason,
    isInstrumental,
    specialFlags: [...new Set(specialFlags)],
  };
}
