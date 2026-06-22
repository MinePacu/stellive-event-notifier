import type { YoutubeUploadCandidate } from "../adapters/youtube/youtubeAtomParser.js";
import type {
  YoutubeListUploadsResult,
  YoutubeUploadsPlaylistResult
} from "../adapters/youtube/youtubeDataApiClient.js";
import type { SongIngestionResult } from "./songIngestionService.js";

export interface SongBackfillTarget {
  memberId: string;
  channelId: string;
  uploadsPlaylistId?: string;
  playlistEtag?: string;
}

interface YoutubeBackfillPort {
  getUploadsPlaylistId(channelId: string): Promise<YoutubeUploadsPlaylistResult>;
  listUploads(input: {
    channelId: string;
    uploadsPlaylistId: string;
    maxPages: number;
    etag?: string;
  }): Promise<YoutubeListUploadsResult>;
}

interface SongIngestionPort {
  ingestYoutubeUpload(candidate: YoutubeUploadCandidate): Promise<SongIngestionResult>;
}

export interface SongBackfillServiceDependencies {
  youtube: YoutubeBackfillPort;
  ingestion: SongIngestionPort;
  targets: SongBackfillTarget[];
  maxPages: number;
  maxChannels: number;
}

export interface SongBackfillResult {
  status: "ok";
  checkedChannels: number;
  skippedChannels: number;
  pagesFetched: number;
  quotaUnits: number;
  ingested: number;
  skipped: number;
  notModified: number;
  failed: number;
}

export class SongBackfillService {
  constructor(readonly dependencies: SongBackfillServiceDependencies) {}

  backfill(): Promise<SongBackfillResult> {
    return this.run();
  }

  reconcile(): Promise<SongBackfillResult> {
    return this.run();
  }

  private async run(): Promise<SongBackfillResult> {
    const result: SongBackfillResult = {
      status: "ok",
      checkedChannels: 0,
      skippedChannels: Math.max(0, this.dependencies.targets.length - this.maxChannels()),
      pagesFetched: 0,
      quotaUnits: 0,
      ingested: 0,
      skipped: 0,
      notModified: 0,
      failed: 0,
    };

    for (const target of this.dependencies.targets.slice(0, this.maxChannels())) {
      result.checkedChannels += 1;
      try {
        const playlist = target.uploadsPlaylistId
          ? { status: "ok" as const, channelId: target.channelId, uploadsPlaylistId: target.uploadsPlaylistId }
          : await this.dependencies.youtube.getUploadsPlaylistId(target.channelId);
        if (playlist.status !== "ok") {
          result.failed += 1;
          result.quotaUnits += 1;
          continue;
        }
        if (!target.uploadsPlaylistId) result.quotaUnits += 1;

        const uploads = await this.dependencies.youtube.listUploads({
          channelId: target.channelId,
          uploadsPlaylistId: playlist.uploadsPlaylistId,
          maxPages: this.maxPages(),
          etag: target.playlistEtag,
        });
        result.quotaUnits += uploads.quotaUnits;
        result.pagesFetched += uploads.pagesFetched;
        if (uploads.status === "not_modified") {
          result.notModified += 1;
          continue;
        }

        for (const candidate of uploads.candidates) {
          const ingested = await this.dependencies.ingestion.ingestYoutubeUpload(candidate);
          if (ingested.ingested) result.ingested += 1;
          else result.skipped += 1;
        }
      } catch {
        result.failed += 1;
      }
    }

    return result;
  }

  private maxPages(): number {
    return Math.max(1, Math.trunc(this.dependencies.maxPages));
  }

  private maxChannels(): number {
    return Math.max(1, Math.trunc(this.dependencies.maxChannels));
  }
}

export default SongBackfillService;
