import type { MusicItemType } from "../../../../shared/schemas/domain.js";

export type MusicSourceRawCategoryHint = "COVER" | "SINGLE" | "EP" | "ORIGINAL" | "OTHERS";

export interface MusicSourcePlaylistSeed {
  youtubePlaylistId: string;
  title: string;
  type: Exclude<MusicItemType, "unknown">;
  rawCategoryHint: MusicSourceRawCategoryHint;
  memberId: string | null;
  isActive: boolean;
}

export const TARGET_MUSIC_MEMBER_IDS = [
  "ayatsuno-yuni",
  "sakihane-huya",
  "shirayuki-hina",
  "neneko-mashiro",
  "akane-lize",
  "arahashi-tabi",
  "tenko-shibuki",
  "aokumo-rin",
  "yuzuha-riko",
  "hanako-nana",
] as const;

export const musicSourcePlaylistSeeds: MusicSourcePlaylistSeed[] = [
  {
    youtubePlaylistId: "",
    title: "Stellive MUSIC COVER",
    type: "cover",
    rawCategoryHint: "COVER",
    memberId: null,
    isActive: false,
  },
  {
    youtubePlaylistId: "",
    title: "Stellive MUSIC SINGLE",
    type: "original",
    rawCategoryHint: "SINGLE",
    memberId: null,
    isActive: false,
  },
  {
    youtubePlaylistId: "",
    title: "Stellive MUSIC EP",
    type: "original",
    rawCategoryHint: "EP",
    memberId: null,
    isActive: false,
  },
  {
    youtubePlaylistId: "",
    title: "Stellive MUSIC OTHERS",
    type: "other",
    rawCategoryHint: "OTHERS",
    memberId: null,
    isActive: false,
  },
];

export const OFFICIAL_STELLIVE_MUSIC_COVER_PLAYLIST_ID = "PLLjd981H8qSN9PQ8-X6wINqBF1GjGxusy";
export const OFFICIAL_STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID = "PLLjd981H8qSMGC4Nir0hD2Gj9n9PDUoHX";

export const officialStelliveMusicSourcePlaylistSeeds: MusicSourcePlaylistSeed[] = [
  {
    youtubePlaylistId: OFFICIAL_STELLIVE_MUSIC_COVER_PLAYLIST_ID,
    title: "Stellive Official Music COVER",
    type: "cover",
    rawCategoryHint: "COVER",
    memberId: null,
    isActive: true,
  },
  {
    youtubePlaylistId: OFFICIAL_STELLIVE_MUSIC_ORIGINAL_PLAYLIST_ID,
    title: "Stellive Official Music ORIGINAL",
    type: "original",
    rawCategoryHint: "ORIGINAL",
    memberId: null,
    isActive: true,
  },
];

export function musicSourceTypeForRawCategory(rawCategory: string): MusicItemType {
  switch (rawCategory.trim().toUpperCase()) {
    case "COVER":
      return "cover";
    case "SINGLE":
    case "EP":
    case "ORIGINAL":
      return "original";
    case "OTHERS":
      return "other";
    default:
      return "unknown";
  }
}
