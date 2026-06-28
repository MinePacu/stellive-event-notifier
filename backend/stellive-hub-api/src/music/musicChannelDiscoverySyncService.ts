import type { MusicItemType, MusicMemberRole } from "../../../../shared/schemas/domain.js";
import type { YoutubeUploadCandidate } from "../adapters/youtube/youtubeAtomParser.js";
import type {
  YoutubeListUploadsResult,
  YoutubeUploadsPlaylistResult,
  YoutubeVideoDetail,
} from "../adapters/youtube/youtubeDataApiClient.js";
import type { MusicItemMemberInput, MusicItemUpsertInput } from "../repositories/musicRepository.js";
import { classifySongUpload } from "../songs/songClassifier.js";
import { classifyYoutubePremiere } from "../adapters/youtube/youtubePremiereClassifier.js";
import { classifyVideo, normalizeTitle } from "./musicClassifier.js";
import type { MusicSyncLock } from "./musicLocks.js";
import { matchMusicMembers, type MusicMemberAliasInput } from "./musicMemberMatcher.js";

export interface MusicChannelDiscoveryTarget {
  memberId?: string;
  channelId: string;
  maxResults?: number;
}

interface DiscoveryYoutubePort {
  getUploadsPlaylistId(channelId: string): Promise<YoutubeUploadsPlaylistResult>;
  listUploads(input: {
    channelId: string;
    uploadsPlaylistId: string;
    maxPages: number;
    maxResults?: number;
  }): Promise<YoutubeListUploadsResult>;
  fetchVideos(videoIds: string[]): Promise<YoutubeVideoDetail[]>;
}

interface DiscoveryRepository {
  getMusicItemsByVideoIds?(videoIds: string[]): Promise<unknown[]>;
  getMusicItemByVideoId(videoId: string): Promise<unknown>;
  getOverrideByVideoId(videoId: string): Promise<unknown>;
  upsertMusicItem(input: MusicItemUpsertInput): Promise<unknown>;
  replaceMusicItemMembers(musicItemId: string, links: MusicItemMemberInput[]): Promise<void>;
}

interface DiscoverySongIngestionPort {
  ingestYoutubeUpload(candidate: YoutubeUploadCandidate): Promise<unknown>;
}

interface ManualOverrideRecord {
  forcedType?: string | null;
  forcedMemberIds?: string[] | null;
  forceExcluded?: boolean;
  exclusionReason?: string | null;
}

export interface MusicChannelDiscoverySyncServiceOptions {
  repository: DiscoveryRepository;
  youtube: DiscoveryYoutubePort;
  locks: MusicSyncLock;
  members: MusicMemberAliasInput[];
  targets: MusicChannelDiscoveryTarget[];
  songIngestion?: DiscoverySongIngestionPort;
  maxPages?: number;
  lockTtlMs?: number;
  now?: () => Date;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function overrideRecord(value: unknown): ManualOverrideRecord | null {
  if (!value) return null;
  const row = record(value);
  return {
    forcedType: typeof row.forcedType === "string" ? row.forcedType : null,
    forcedMemberIds: Array.isArray(row.forcedMemberIds)
      ? row.forcedMemberIds.filter((item): item is string => typeof item === "string")
      : null,
    forceExcluded: row.forceExcluded === true,
    exclusionReason: typeof row.exclusionReason === "string" ? row.exclusionReason : null,
  };
}

function existingSourceBackedType(existing: Record<string, unknown>): MusicItemType | null {
  if (typeof existing.sourcePlaylistId !== "string") return null;
  if (existing.type === "cover" || existing.type === "original" || existing.type === "other") {
    return existing.type;
  }
  return null;
}

function dateString(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function shouldRefreshVideo(existing: Record<string, unknown> | undefined, now: Date): boolean {
  if (!existing) return true;
  if (["scheduled", "live", "unknown"].includes(String(existing.youtubePremiereState ?? ""))) return true;
  const fetchedAt = dateString(existing.youtubeMetadataFetchedAt);
  return !fetchedAt || now.getTime() - new Date(fetchedAt).getTime() >= 24 * 60 * 60 * 1_000;
}

function detailFromExisting(existing: Record<string, unknown>): YoutubeVideoDetail {
  return {
    videoId: String(existing.youtubeVideoId),
    channelId: typeof existing.channelId === "string" ? existing.channelId : undefined,
    channelTitle: typeof existing.channelTitle === "string" ? existing.channelTitle : undefined,
    title: typeof existing.title === "string" ? existing.title : undefined,
    description: typeof existing.description === "string" ? existing.description : undefined,
    publishedAt: dateString(existing.publishedAt),
    tags: Array.isArray(existing.tags) ? existing.tags.filter((tag): tag is string => typeof tag === "string") : [],
    duration: typeof existing.duration === "string" ? existing.duration : undefined,
    privacyStatus: typeof existing.privacyStatus === "string" ? existing.privacyStatus : undefined,
    liveBroadcastContent: existing.youtubePremiereState === "scheduled"
      ? "upcoming"
      : existing.youtubePremiereState === "live"
        ? "live"
        : "none",
    scheduledStartTime: dateString(existing.youtubeScheduledStartAt),
    actualStartTime: dateString(existing.youtubeActualStartAt),
    actualEndTime: dateString(existing.youtubeActualEndAt),
    thumbnailUrl: typeof existing.thumbnailUrl === "string" ? existing.thumbnailUrl : undefined,
    thumbnailWidth: typeof existing.thumbnailWidth === "number" ? existing.thumbnailWidth : undefined,
    thumbnailHeight: typeof existing.thumbnailHeight === "number" ? existing.thumbnailHeight : undefined,
  };
}

export class MusicChannelDiscoverySyncService {
  constructor(private readonly options: MusicChannelDiscoverySyncServiceOptions) {}

  async discover() {
    const release = this.options.locks.acquire(
      "music-channel-discovery",
      this.options.lockTtlMs ?? 30_000,
    );
    if (!release) return { status: "lock_not_acquired" };

    const summary = {
      status: "ok" as const,
      channelsChecked: 0,
      playlistItemsChecked: 0,
      uniqueVideos: 0,
      inserted: 0,
      updated: 0,
      needsReview: 0,
      excludedCandidates: 0,
      apiCallsEstimated: 0,
      failed: 0,
    };

    try {
      const candidates = new Map<string, { candidate: YoutubeUploadCandidate; target: MusicChannelDiscoveryTarget }>();
      for (const target of this.options.targets) {
        summary.channelsChecked += 1;
        try {
          const playlist = await this.options.youtube.getUploadsPlaylistId(target.channelId);
          summary.apiCallsEstimated += 1;
          if (playlist.status !== "ok") {
            summary.failed += 1;
            continue;
          }
          const uploads = await this.options.youtube.listUploads({
            channelId: target.channelId,
            uploadsPlaylistId: playlist.uploadsPlaylistId,
            maxPages: Math.max(1, Math.trunc(this.options.maxPages ?? 1)),
            maxResults: target.maxResults ?? 50,
          });
          summary.apiCallsEstimated += uploads.quotaUnits;
          if (uploads.status !== "ok") continue;
          summary.playlistItemsChecked += uploads.candidates.length;
          for (const candidate of uploads.candidates) {
            if (!candidates.has(candidate.videoId)) candidates.set(candidate.videoId, { candidate, target });
          }
        } catch {
          summary.failed += 1;
        }
      }

      summary.uniqueVideos = candidates.size;
      const videoIds = [...candidates.keys()];
      const existingRows = this.options.repository.getMusicItemsByVideoIds
        ? await this.options.repository.getMusicItemsByVideoIds(videoIds)
        : [];
      const existingById = new Map(existingRows.map((row) => {
        const value = record(row);
        return [String(value.youtubeVideoId), value] as const;
      }));
      const now = (this.options.now ?? (() => new Date()))();
      const refreshIds = videoIds.filter((videoId) => shouldRefreshVideo(existingById.get(videoId), now));
      const details = refreshIds.length > 0 ? await this.options.youtube.fetchVideos(refreshIds) : [];
      summary.apiCallsEstimated += Math.ceil(refreshIds.length / 50);
      const detailsById = new Map<string, YoutubeVideoDetail>([
        ...existingRows.map((row) => {
          const value = record(row);
          return [String(value.youtubeVideoId), detailFromExisting(value)] as const;
        }),
        ...details.map((detail) => [detail.videoId, detail] as const),
      ]);

      for (const [videoId, discovered] of candidates) {
        const detail = detailsById.get(videoId);
        const songClassification = classifySongUpload({
          title: detail?.title ?? discovered.candidate.title,
          description: detail?.description,
          tags: detail?.tags,
        });
        if (songClassification.type !== "cover" && songClassification.type !== "original") continue;

        const existing = existingById.get(videoId) ?? record(await this.options.repository.getMusicItemByVideoId(videoId));
        const manualOverride = overrideRecord(await this.options.repository.getOverrideByVideoId(videoId));
        const preservedSourceType = existingSourceBackedType(existing);
        const itemType = (manualOverride?.forcedType as MusicItemType | undefined) ?? preservedSourceType ?? songClassification.type;
        const premiere = classifyYoutubePremiere({
          musicType: itemType,
          liveBroadcastContent: detail?.liveBroadcastContent,
          scheduledStartTime: detail?.scheduledStartTime,
          actualStartTime: detail?.actualStartTime,
          actualEndTime: detail?.actualEndTime,
        });
        const rawCategoryHint = typeof existing.sourcePlaylistId === "string" && typeof existing.rawCategoryHint === "string"
          ? existing.rawCategoryHint
          : itemType.toUpperCase();
        const classification = classifyVideo({
          sourceTypes: [itemType],
          title: detail?.title ?? discovered.candidate.title,
          description: detail?.description,
          duration: detail?.duration ?? discovered.candidate.duration,
          privacyStatus: detail?.privacyStatus ?? discovered.candidate.privacyStatus,
        });
        const matched = matchMusicMembers({
          title: detail?.title ?? discovered.candidate.title,
          description: detail?.description ?? "",
          channelId: detail?.channelId ?? discovered.candidate.channelId,
          channelTitle: detail?.channelTitle,
          members: this.options.members,
        }).links;
        const automaticLinks = matched.length > 0
          ? matched
          : discovered.target.memberId
            ? [{
                memberId: discovered.target.memberId,
                role: "main" as MusicMemberRole,
                confidence: 1,
                source: "CHANNEL_ID",
              }]
            : [];
        const links = manualOverride?.forcedMemberIds
          ? manualOverride.forcedMemberIds.map((memberId, index) => ({
              memberId,
              role: (index === 0 ? "main" : "collaboration") as MusicMemberRole,
              confidence: 1,
              source: "MANUAL",
            }))
          : automaticLinks;
        const isExcluded = manualOverride?.forceExcluded ?? classification.isExcluded;
        const classificationStatus = manualOverride
          ? (isExcluded ? "MANUAL_EXCLUDED" : "MANUAL_CONFIRMED")
          : links.length === 0
            ? "NEEDS_REVIEW"
            : classification.classificationStatus;
        if (classificationStatus === "NEEDS_REVIEW") summary.needsReview += 1;
        if (isExcluded) summary.excludedCandidates += 1;

        const saved = record(await this.options.repository.upsertMusicItem({
          youtubeVideoId: videoId,
          title: detail?.title ?? discovered.candidate.title,
          normalizedTitle: normalizeTitle(detail?.title ?? discovered.candidate.title),
          description: detail?.description ?? null,
          type: itemType,
          sourcePlaylistId: typeof existing.sourcePlaylistId === "string" ? existing.sourcePlaylistId : null,
          publishedAt: detail?.publishedAt ?? discovered.candidate.publishedAt,
          thumbnailUrl: detail?.thumbnailUrl ?? discovered.candidate.thumbnailUrl ?? null,
          thumbnailWidth: detail?.thumbnailWidth ?? discovered.candidate.thumbnailWidth ?? null,
          thumbnailHeight: detail?.thumbnailHeight ?? discovered.candidate.thumbnailHeight ?? null,
          duration: detail?.duration ?? discovered.candidate.duration ?? null,
          durationSeconds: classification.durationSeconds,
          channelId: detail?.channelId ?? discovered.candidate.channelId,
          channelTitle: detail?.channelTitle ?? null,
          isPublic: classification.isAvailable,
          privacyStatus: detail?.privacyStatus ?? discovered.candidate.privacyStatus ?? null,
          embeddable: detail?.embeddable ?? null,
          madeForKids: detail?.madeForKids ?? null,
          dimension: detail?.dimension ?? null,
          definition: detail?.definition ?? null,
          caption: detail?.caption ?? null,
          tags: detail?.tags ?? [],
          isAvailable: classification.isAvailable,
          isExcluded,
          exclusionReason: manualOverride?.exclusionReason ?? classification.exclusionReason,
          classificationStatus,
          isInstrumental: classification.isInstrumental,
          specialFlags: classification.specialFlags,
          youtubePresentationType: premiere.presentationType,
          youtubePremiereState: premiere.state,
          youtubeScheduledStartAt: premiere.scheduledStartAt,
          youtubeActualStartAt: premiere.actualStartAt,
          youtubeActualEndAt: premiere.actualEndAt,
          youtubeMetadataFetchedAt: (this.options.now ?? (() => new Date()))(),
          listingPriority: premiere.listingPriority,
          fetchedAt: (this.options.now ?? (() => new Date()))(),
          lastSeenAt: (this.options.now ?? (() => new Date()))(),
          rawCategoryHint,
        }));
        const musicItemId = typeof saved.id === "string" ? saved.id : typeof existing.id === "string" ? existing.id : videoId;
        await this.options.repository.replaceMusicItemMembers(musicItemId, links);
        if (discovered.target.memberId) {
          await this.options.songIngestion?.ingestYoutubeUpload({
            ...discovered.candidate,
            title: detail?.title ?? discovered.candidate.title,
            description: detail?.description,
            tags: detail?.tags,
            channelId: detail?.channelId ?? discovered.candidate.channelId,
            channelTitle: detail?.channelTitle,
            publishedAt: detail?.publishedAt ?? discovered.candidate.publishedAt,
            thumbnailUrl: detail?.thumbnailUrl ?? discovered.candidate.thumbnailUrl,
            thumbnailWidth: detail?.thumbnailWidth ?? discovered.candidate.thumbnailWidth,
            thumbnailHeight: detail?.thumbnailHeight ?? discovered.candidate.thumbnailHeight,
            duration: detail?.duration ?? discovered.candidate.duration,
            privacyStatus: detail?.privacyStatus ?? discovered.candidate.privacyStatus,
            liveBroadcastContent: detail?.liveBroadcastContent,
            scheduledStartTime: detail?.scheduledStartTime,
            actualStartTime: detail?.actualStartTime,
            actualEndTime: detail?.actualEndTime,
          });
        }
        if (typeof existing.id === "string") summary.updated += 1;
        else summary.inserted += 1;
      }
      return summary;
    } finally {
      release();
    }
  }
}

export default MusicChannelDiscoverySyncService;
