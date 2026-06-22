import type { SongType } from "../../../../shared/schemas/domain.js";

export interface SongClassificationInput {
  title?: string | null;
  description?: string | null;
  tags?: string[] | null;
}

export interface SongClassificationResult {
  type: SongType;
  confidence: number;
  reason: string;
}

const coverMarkers = ["커버", "cover", "covered by", "歌ってみた"];
const originalMarkers = ["오리지널", "original song", "official mv"];

function normalizedText(input: SongClassificationInput): string {
  return [input.title, input.description, ...(input.tags ?? [])]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function includesAny(value: string, markers: string[]): boolean {
  return markers.some((marker) => value.includes(marker.toLowerCase()));
}

export function classifySongUpload(input: SongClassificationInput): SongClassificationResult {
  const text = normalizedText(input);
  if (!text.trim()) return { type: "unknown", confidence: 0, reason: "empty_metadata" };

  const hasCoverMarker = includesAny(text, coverMarkers);
  const hasOriginalMarker = includesAny(text, originalMarkers);

  if (hasCoverMarker && hasOriginalMarker) return { type: "unknown", confidence: 0.2, reason: "mixed_markers" };
  if (hasCoverMarker) return { type: "cover", confidence: 0.8, reason: "cover_marker" };
  if (hasOriginalMarker) return { type: "original", confidence: 0.8, reason: "original_marker" };

  return { type: "unknown", confidence: 0, reason: "no_marker" };
}
