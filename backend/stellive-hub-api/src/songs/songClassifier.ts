import type { SongType } from "../../../../shared/schemas/domain.js";

export type SongBroadcastState = "none" | "scheduled" | "live" | "completed" | "unknown";

export interface SongClassificationInput {
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
  duration?: string | null;
  privacyStatus?: string | null;
  broadcastState?: SongBroadcastState | null;
  isOfficialMemberChannel?: boolean;
}

export interface SongClassificationResult {
  type: SongType;
  confidence: number;
  reason: string;
  specialFlags?: string[];
}

const coverMarkers = ["커버", "cover", "covered by", "歌ってみた"];
const originalMarkers = ["오리지널", "original song", "official mv"];
const playlistTitlePattern = /(?<![\p{L}\p{N}])(?:playlist|플리)(?![\p{L}\p{N}])|플레이리스트/iu;
const playlistExclusionPatterns = [
  /다시보기|풀영상/i,
  /\bstream\s*archive\b/i,
  /\bgame\s*(?:play|stream|broadcast)\b|게임\s*(?:방송|플레이|실황)/i,
  /\basmr\b|\bbgm\b/i,
  /추천곡|노래\s*추천/i,
  /#?shorts\b|쇼츠/i,
  /\bteaser\b|티저/i,
  /\btrailer\b|트레일러/i,
  /\bpreview\b|프리뷰/i,
];

function normalizedText(values: Array<string | null | undefined>): string {
  return values
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();
}

function includesAny(value: string, markers: string[]): boolean {
  return markers.some((marker) => value.includes(marker.toLowerCase()));
}

function parseDurationToSeconds(duration: string | null | undefined): number | null {
  if (!duration) return null;
  const match = /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.exec(duration);
  if (!match) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function isPlaylistCompilation(input: SongClassificationInput, titleText: string): boolean {
  if (!input.isOfficialMemberChannel || !playlistTitlePattern.test(titleText)) return false;
  if (playlistExclusionPatterns.some((pattern) => pattern.test(titleText))) return false;

  const durationSeconds = parseDurationToSeconds(input.duration);
  if (durationSeconds === null || durationSeconds < 8 * 60) return false;

  const privacyStatus = input.privacyStatus?.toLocaleLowerCase("en-US");
  if (privacyStatus !== "public" && privacyStatus !== "unlisted") return false;

  return input.broadcastState === "none" || input.broadcastState === "completed";
}

export function classifySongUpload(input: SongClassificationInput): SongClassificationResult {
  const allText = normalizedText([input.title, input.description, ...(input.tags ?? [])]);
  if (!allText.trim()) return { type: "unknown", confidence: 0, reason: "empty_metadata" };

  const titleText = normalizedText([input.title]);
  const titleAndDescriptionText = normalizedText([input.title, input.description]);
  const hasCoverMarker = includesAny(titleText, coverMarkers);
  const hasOriginalMarker = includesAny(titleAndDescriptionText, originalMarkers);

  if (hasCoverMarker && hasOriginalMarker) return { type: "unknown", confidence: 0.2, reason: "mixed_markers" };
  if (hasCoverMarker) return { type: "cover", confidence: 0.8, reason: "cover_marker" };
  if (hasOriginalMarker) return { type: "original", confidence: 0.8, reason: "original_marker" };
  if (isPlaylistCompilation(input, titleText)) {
    return {
      type: "cover",
      confidence: 0.65,
      reason: "member_channel_playlist_compilation",
      specialFlags: ["playlist_compilation"],
    };
  }

  return { type: "unknown", confidence: 0, reason: "no_strong_marker" };
}
