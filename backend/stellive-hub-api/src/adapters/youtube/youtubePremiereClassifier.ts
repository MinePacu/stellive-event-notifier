import type { MusicItemType } from "../../../../../shared/schemas/domain.js";

export type YoutubePresentationType = "regular" | "premiere_assumed";
export type YoutubePremiereState = "scheduled" | "live" | "completed" | "unknown";

export interface YoutubePremiereClassificationInput {
  musicType: MusicItemType;
  liveBroadcastContent?: string;
  scheduledStartTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
}

export interface YoutubePremiereClassification {
  presentationType: YoutubePresentationType;
  state: YoutubePremiereState | null;
  scheduledStartAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
  listingPriority: number;
}

const regular: YoutubePremiereClassification = {
  presentationType: "regular",
  state: null,
  scheduledStartAt: null,
  actualStartAt: null,
  actualEndAt: null,
  listingPriority: 2,
};

export function classifyYoutubePremiere(input: YoutubePremiereClassificationInput): YoutubePremiereClassification {
  if (input.musicType !== "cover" && input.musicType !== "original") return regular;

  const hasBroadcastMetadata = input.liveBroadcastContent === "upcoming" ||
    input.liveBroadcastContent === "live" ||
    Boolean(input.scheduledStartTime || input.actualStartTime || input.actualEndTime);
  if (!hasBroadcastMetadata) return regular;

  const state: YoutubePremiereState = input.actualEndTime
    ? "completed"
    : input.liveBroadcastContent === "live" || input.actualStartTime
      ? "live"
      : input.liveBroadcastContent === "upcoming"
        ? "scheduled"
        : "unknown";

  return {
    presentationType: "premiere_assumed",
    state,
    scheduledStartAt: input.scheduledStartTime ?? null,
    actualStartAt: input.actualStartTime ?? null,
    actualEndAt: input.actualEndTime ?? null,
    listingPriority: state === "live" ? 0 : state === "scheduled" ? 1 : 2,
  };
}
