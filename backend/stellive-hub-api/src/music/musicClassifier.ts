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
