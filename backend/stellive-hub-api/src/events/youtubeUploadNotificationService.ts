import type { Member, PlatformEvent, PlatformEventType } from "../types.js";
import type { YoutubeVideoDetail } from "../adapters/youtube/youtubeDataApiClient.js";
import type { YoutubeUploadCandidate } from "../adapters/youtube/youtubeAtomParser.js";
import { PrismaEventPersistenceUnitOfWork, type EventPersistenceUnitOfWork } from "../storage/eventPersistenceUnitOfWork.js";

export interface YoutubeUploadMetadataPort {
  fetchVideos(videoIds: string[]): Promise<YoutubeVideoDetail[]>;
}

export interface YoutubeUploadNotificationCatalogPort {
  getMembers(): Member[];
  isSupportedEventForMember(memberId: string, eventType: string): boolean;
}

export interface YoutubeUploadNotificationServiceOptions {
  catalog: YoutubeUploadNotificationCatalogPort;
  youtube?: YoutubeUploadMetadataPort;
  unitOfWork?: EventPersistenceUnitOfWork;
  now?: () => Date;
}

export type YoutubeUploadNotificationResult =
  | { status: "created"; eventId: string; eventType: PlatformEventType }
  | { status: "duplicate"; eventId: string; eventType: PlatformEventType }
  | {
      status: "skipped";
      reason: "unknown_channel" | "unsupported_event" | "official_metadata_unavailable" | "official_live";
    };

export class YoutubeUploadMetadataRetryableError extends Error {
  constructor(reason: "official_upload_metadata_unavailable" | "official_upload_channel_mismatch") {
    super(reason);
    this.name = "YoutubeUploadMetadataRetryableError";
  }
}

const memberGenerations = new Set(["gen1", "gen2", "gen3"]);

function targetForCandidate(
  catalog: YoutubeUploadNotificationCatalogPort,
  candidate: YoutubeUploadCandidate,
): { member: Member; eventType: PlatformEventType } | undefined {
  const member = catalog
    .getMembers()
    .find((entry) => entry.platforms.youtubeChannelId?.trim() === candidate.channelId);
  if (!member) return undefined;
  if (member.activeStatus !== "active" && member.activeStatus !== "upcoming") return undefined;
  if (member.catalogRole !== "member" && member.catalogRole !== "official_channel") return undefined;

  const eventType: PlatformEventType = member.catalogRole === "official_channel"
    ? "official_youtube_upload"
    : memberGenerations.has(member.generationId)
      ? "youtube_upload"
      : "event_updated";
  if (eventType === "event_updated" || !catalog.isSupportedEventForMember(member.id, eventType)) return undefined;
  return { member, eventType };
}

function hasLiveMetadata(detail: YoutubeVideoDetail): boolean {
  return Boolean(detail.scheduledStartTime || detail.actualStartTime || detail.actualEndTime);
}

function toEvent(
  candidate: YoutubeUploadCandidate,
  target: { member: Member; eventType: PlatformEventType },
  now: Date,
): PlatformEvent {
  return {
    id: `youtube-${target.eventType}-${candidate.channelId}-${candidate.videoId}`,
    source: "youtube",
    type: target.eventType,
    memberId: target.member.id,
    generationId: target.member.generationId,
    title: candidate.title || `${target.member.koreanName} YouTube 업로드`,
    body: `${target.member.koreanName}의 새 YouTube 동영상이 업로드되었습니다.`,
    platformUrl: candidate.sourceUrl,
    appDeepLink: `stellivehub://events/youtube/${candidate.videoId}`,
    occurredAt: candidate.publishedAt,
    receivedAt: now.toISOString(),
    dedupeKey: `youtube:${target.eventType}:${candidate.channelId}:${candidate.videoId}`,
    rawPayload: {
      youtubeVideoId: candidate.videoId,
      youtubeChannelId: candidate.channelId,
      publishedAt: candidate.publishedAt,
      updatedAt: candidate.updatedAt,
    },
    realtimeEligible: true,
    deliveryMode: "standard",
  };
}

export class YoutubeUploadNotificationService {
  private readonly unitOfWork: EventPersistenceUnitOfWork;

  constructor(private readonly options: YoutubeUploadNotificationServiceOptions) {
    this.unitOfWork = options.unitOfWork ?? new PrismaEventPersistenceUnitOfWork();
  }

  async handleYoutubeUpload(candidate: YoutubeUploadCandidate): Promise<YoutubeUploadNotificationResult> {
    const target = targetForCandidate(this.options.catalog, candidate);
    if (!target) {
      const hasChannel = this.options.catalog.getMembers().some(
        (member) => member.platforms.youtubeChannelId?.trim() === candidate.channelId,
      );
      return { status: "skipped", reason: hasChannel ? "unsupported_event" : "unknown_channel" };
    }

    if (target.eventType === "official_youtube_upload") {
      if (!this.options.youtube) return { status: "skipped", reason: "official_metadata_unavailable" };
      let details: YoutubeVideoDetail[];
      try {
        details = await this.options.youtube.fetchVideos([candidate.videoId]);
      } catch {
        throw new YoutubeUploadMetadataRetryableError("official_upload_metadata_unavailable");
      }
      const detail = details.find((entry) => entry.videoId === candidate.videoId);
      if (!detail) throw new YoutubeUploadMetadataRetryableError("official_upload_metadata_unavailable");
      if (detail.channelId !== candidate.channelId) {
        throw new YoutubeUploadMetadataRetryableError("official_upload_channel_mismatch");
      }
      if (!detail.liveBroadcastContent) {
        throw new YoutubeUploadMetadataRetryableError("official_upload_metadata_unavailable");
      }
      if (detail.liveBroadcastContent !== "none" || hasLiveMetadata(detail)) {
        return { status: "skipped", reason: "official_live" };
      }
    }

    const event = toEvent(candidate, target, this.options.now?.() ?? new Date());
    return this.unitOfWork.runInTransaction(async (scope) => {
      const persisted = await scope.platformEvents.createIfNotExists(event);
      await scope.notificationJobs.enqueue({
        eventId: persisted.eventId,
        priority: event.realtimeEligible ? 1 : 5,
      });
      return persisted.created
        ? { status: "created" as const, eventId: persisted.eventId, eventType: event.type }
        : { status: "duplicate" as const, eventId: persisted.eventId, eventType: event.type };
    });
  }
}

export default YoutubeUploadNotificationService;
