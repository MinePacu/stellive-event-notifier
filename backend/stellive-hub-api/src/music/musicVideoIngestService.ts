import type { YoutubeVideoDetail } from "../adapters/youtube/youtubeDataApiClient.js";

export type MusicVideoIngestAction =
  | "inserted"
  | "updated"
  | "would_insert"
  | "would_update"
  | "needs_review"
  | "skipped_untrusted_channel"
  | "not_found"
  | "failed";

export interface MusicVideoIngestItem {
  videoId: string;
  status: "ok" | "review_required" | "skipped" | "not_found" | "failed";
  action: MusicVideoIngestAction;
  classificationType: string | null;
  classificationReason: string | null;
  structuredMatchKind: string | null;
  memberIds: string[];
  reviewRequired: boolean;
  error: string | null;
}

export interface MusicVideoIngestResult {
  items: MusicVideoIngestItem[];
  summary: {
    requested: number;
    uniqueRequested: number;
    fetched: number;
    inserted: number;
    updated: number;
    needsReview: number;
    skipped: number;
    notFound: number;
    failed: number;
    dryRun: boolean;
  };
}

export interface MusicVideoProcessorResult {
  action: Exclude<MusicVideoIngestAction, "not_found" | "failed">;
  persistenceAction?: "inserted" | "updated" | "would_insert" | "would_update" | "skipped";
  classificationType: string | null;
  classificationReason: string | null;
  structuredMatchKind: string | null;
  memberIds: string[];
  reviewRequired: boolean;
}

export interface MusicVideoIngestServiceOptions {
  youtube: {
    fetchVideos(videoIds: string[]): Promise<YoutubeVideoDetail[]>;
  };
  processor: {
    ingestVideoDetail(
      detail: YoutubeVideoDetail,
      options: { dryRun: boolean },
    ): Promise<MusicVideoProcessorResult>;
  };
}

function emptyItem(
  videoId: string,
  action: "not_found" | "failed",
  error: string | null,
): MusicVideoIngestItem {
  return {
    videoId,
    status: action,
    action,
    classificationType: null,
    classificationReason: null,
    structuredMatchKind: null,
    memberIds: [],
    reviewRequired: false,
    error,
  };
}

function statusFor(result: MusicVideoProcessorResult): MusicVideoIngestItem["status"] {
  if (result.action === "needs_review" || result.reviewRequired) return "review_required";
  if (result.action === "skipped_untrusted_channel") return "skipped";
  return "ok";
}

function createSummary(input: {
  requested: number;
  uniqueRequested: number;
  fetched: number;
  dryRun: boolean;
  items: MusicVideoIngestItem[];
  persistenceActions?: MusicVideoProcessorResult["persistenceAction"][];
}): MusicVideoIngestResult["summary"] {
  return {
    requested: input.requested,
    uniqueRequested: input.uniqueRequested,
    fetched: input.fetched,
    inserted: input.persistenceActions
      ? input.persistenceActions.filter((action) => action === "inserted").length
      : input.items.filter((item) => item.action === "inserted").length,
    updated: input.persistenceActions
      ? input.persistenceActions.filter((action) => action === "updated").length
      : input.items.filter((item) => item.action === "updated").length,
    needsReview: input.items.filter((item) => item.action === "needs_review").length,
    skipped: input.items.filter((item) => item.action === "skipped_untrusted_channel").length,
    notFound: input.items.filter((item) => item.action === "not_found").length,
    failed: input.items.filter((item) => item.action === "failed").length,
    dryRun: input.dryRun,
  };
}

export class MusicVideoIngestService {
  constructor(private readonly options: MusicVideoIngestServiceOptions) {}

  async ingestVideos(input: {
    videoIds: string[];
    dryRun?: boolean;
    requestedCount?: number;
  }): Promise<MusicVideoIngestResult> {
    const videoIds = Array.from(new Set(input.videoIds.map((videoId) => videoId.trim())));
    const dryRun = input.dryRun === true;
    let details: YoutubeVideoDetail[];

    try {
      // The internal route accepts at most 50 IDs, so this must remain one
      // videos.list batch rather than allowing the client to chunk requests.
      details = await this.options.youtube.fetchVideos(videoIds);
    } catch {
      const items = videoIds.map((videoId) => emptyItem(videoId, "failed", "youtube_fetch_failed"));
      return {
        items,
        summary: createSummary({
          requested: input.requestedCount ?? input.videoIds.length,
          uniqueRequested: videoIds.length,
          fetched: 0,
          dryRun,
          items,
        }),
      };
    }

    const requestedIds = new Set(videoIds);
    const detailsById = new Map(
      details
        .filter((detail) => requestedIds.has(detail.videoId))
        .map((detail) => [detail.videoId, detail] as const),
    );
    const items: MusicVideoIngestItem[] = [];
    const persistenceActions: MusicVideoProcessorResult["persistenceAction"][] = [];

    for (const videoId of videoIds) {
      const detail = detailsById.get(videoId);
      if (!detail) {
        items.push(emptyItem(videoId, "not_found", null));
        persistenceActions.push(undefined);
        continue;
      }

      try {
        const result = await this.options.processor.ingestVideoDetail(detail, { dryRun });
        items.push({
          videoId,
          status: statusFor(result),
          action: result.action,
          classificationType: result.classificationType,
          classificationReason: result.classificationReason,
          structuredMatchKind: result.structuredMatchKind,
          memberIds: [...result.memberIds],
          reviewRequired: result.reviewRequired,
          error: null,
        });
        persistenceActions.push(result.persistenceAction ?? (
          result.action === "inserted" ||
          result.action === "updated" ||
          result.action === "would_insert" ||
          result.action === "would_update"
            ? result.action
            : "skipped"
        ));
      } catch {
        items.push(emptyItem(videoId, "failed", "video_processing_failed"));
        persistenceActions.push(undefined);
      }
    }

    return {
      items,
      summary: createSummary({
        requested: input.requestedCount ?? input.videoIds.length,
        uniqueRequested: videoIds.length,
        fetched: detailsById.size,
        dryRun,
        items,
        persistenceActions,
      }),
    };
  }
}

export default MusicVideoIngestService;
