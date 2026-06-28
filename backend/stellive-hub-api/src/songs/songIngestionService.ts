import type { MobileSongType, SongCatalogGenerationId } from "../../../../shared/schemas/domain.js";
import type { YoutubeUploadCandidate } from "../adapters/youtube/youtubeAtomParser.js";
import type { YoutubeSongUpsertInput } from "../repositories/songRepository.js";
import { classifySongUpload } from "./songClassifier.js";
import { classifyYoutubePremiere } from "../adapters/youtube/youtubePremiereClassifier.js";

interface SongCatalogTarget {
  memberId: string;
  memberName: string;
  generationId: string;
  generationName: string;
}

interface SongCatalogPort {
  findByYoutubeChannelId(channelId: string): SongCatalogTarget | undefined;
}

interface SongUpsertPort {
  upsertSongFromYoutubeUpload(input: YoutubeSongUpsertInput): Promise<{ id: string }>;
}

export type SongIngestionResult =
  | { ingested: true; songId: string }
  | { ingested: false; reason: "unknown_youtube_channel" | "unsupported_song_generation" | "unknown_song_type" };

export interface SongIngestionServiceDependencies {
  catalog: SongCatalogPort;
  songs: SongUpsertPort;
}

const supportedSongGenerations = new Set(["gen1", "gen2", "gen3"]);

function isSongGeneration(value: string): value is SongCatalogGenerationId {
  return supportedSongGenerations.has(value);
}

function isMobileSongType(value: string): value is MobileSongType {
  return value === "original" || value === "cover";
}

export class SongIngestionService {
  constructor(private readonly dependencies: SongIngestionServiceDependencies) {}

  async ingestYoutubeUpload(candidate: YoutubeUploadCandidate): Promise<SongIngestionResult> {
    const target = this.dependencies.catalog.findByYoutubeChannelId(candidate.channelId);
    if (!target) return { ingested: false, reason: "unknown_youtube_channel" };
    if (!isSongGeneration(target.generationId)) return { ingested: false, reason: "unsupported_song_generation" };

    const classification = classifySongUpload({
      title: candidate.title,
      description: candidate.description,
      tags: candidate.tags,
    });
    if (!isMobileSongType(classification.type)) return { ingested: false, reason: "unknown_song_type" };
    const premiere = classifyYoutubePremiere({
      musicType: classification.type,
      liveBroadcastContent: candidate.liveBroadcastContent,
      scheduledStartTime: candidate.scheduledStartTime,
      actualStartTime: candidate.actualStartTime,
      actualEndTime: candidate.actualEndTime,
    });
    const hasBroadcastDetail = candidate.liveBroadcastContent !== undefined ||
      Boolean(candidate.scheduledStartTime || candidate.actualStartTime || candidate.actualEndTime);

    const song = await this.dependencies.songs.upsertSongFromYoutubeUpload({
      youtubeVideoId: candidate.videoId,
      youtubeChannelId: candidate.channelId,
      dedupeKey: `youtube:upload:${candidate.channelId}:${candidate.videoId}`,
      title: candidate.title,
      memberId: target.memberId,
      memberName: target.memberName,
      generationId: target.generationId,
      generationName: target.generationName,
      songType: classification.type,
      classificationConfidence: classification.confidence,
      sourceUrl: candidate.sourceUrl,
      thumbnailUrl: candidate.thumbnailUrl,
      thumbnailWidth: candidate.thumbnailWidth,
      thumbnailHeight: candidate.thumbnailHeight,
      duration: candidate.duration,
      privacyStatus: candidate.privacyStatus,
      ...(hasBroadcastDetail ? {
        youtubePresentationType: premiere.presentationType,
        youtubePremiereState: premiere.state,
        youtubeScheduledStartAt: premiere.scheduledStartAt,
        youtubeActualStartAt: premiere.actualStartAt,
        youtubeActualEndAt: premiere.actualEndAt,
        youtubeMetadataFetchedAt: new Date(),
        listingPriority: premiere.listingPriority,
      } : {}),
      publishedAt: candidate.publishedAt,
    });

    return { ingested: true, songId: song.id };
  }
}

export default SongIngestionService;
