import type { MusicItemType, MusicMemberRole } from "../../../../shared/schemas/domain.js";
import type { YoutubeUploadCandidate } from "../adapters/youtube/youtubeAtomParser.js";
import type {
  YoutubeListUploadsResult,
  YoutubeUploadsPlaylistResult,
  YoutubeVideoDetail,
} from "../adapters/youtube/youtubeDataApiClient.js";
import type { MusicItemMemberInput, MusicItemUpsertInput } from "../repositories/musicRepository.js";
import { classifySongUpload, type SongBroadcastState } from "../songs/songClassifier.js";
import {
  classifyYoutubeBroadcastState,
  classifyYoutubePremiere,
} from "../adapters/youtube/youtubePremiereClassifier.js";
import { classifyVideo, normalizeTitle } from "./musicClassifier.js";
import type { MusicSyncLock } from "./musicLocks.js";
import { matchMusicMembers, type MusicMemberAliasInput } from "./musicMemberMatcher.js";
import {
  assessMusicOriginalTitleTrust,
  matchMusicOriginalTitle,
  type MusicDiscoveryChannelKind,
} from "./musicOriginalTitleMatcher.js";
import type { MusicVideoProcessorResult } from "./musicVideoIngestService.js";

export interface MusicChannelDiscoveryTarget {
  kind: MusicDiscoveryChannelKind;
  memberId?: string;
  channelId: string;
  maxResults?: number;
}

export interface MusicDiscoveryVideoProcessorResult extends MusicVideoProcessorResult {
  persistenceAction: "inserted" | "updated" | "would_insert" | "would_update" | "skipped";
  isExcluded: boolean;
  specialFlags: string[];
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

function broadcastStateFromExisting(existing: Record<string, unknown> | undefined): SongBroadcastState {
  const state = existing?.youtubePremiereState;
  if (state === "scheduled" || state === "live" || state === "completed" || state === "unknown") return state;
  return existing?.youtubePresentationType === "regular" ? "none" : "unknown";
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
    scheduledStartTime: dateString(existing.youtubeScheduledStartAt),
    actualStartTime: dateString(existing.youtubeActualStartAt),
    actualEndTime: dateString(existing.youtubeActualEndAt),
    thumbnailUrl: typeof existing.thumbnailUrl === "string" ? existing.thumbnailUrl : undefined,
    thumbnailWidth: typeof existing.thumbnailWidth === "number" ? existing.thumbnailWidth : undefined,
    thumbnailHeight: typeof existing.thumbnailHeight === "number" ? existing.thumbnailHeight : undefined,
  };
}

function isTrustedTarget(target: MusicChannelDiscoveryTarget): boolean {
  return target.kind === "stellive_official" ||
    (target.kind === "member" && Boolean(target.memberId));
}

function skippedUntrustedResult(): MusicDiscoveryVideoProcessorResult {
  return {
    action: "skipped_untrusted_channel",
    persistenceAction: "skipped",
    classificationType: null,
    classificationReason: "untrusted_channel",
    structuredMatchKind: null,
    memberIds: [],
    reviewRequired: false,
    isExcluded: true,
    specialFlags: [],
  };
}

function skippedResult(reason: string): MusicDiscoveryVideoProcessorResult {
  return {
    action: "skipped_untrusted_channel",
    persistenceAction: "skipped",
    classificationType: null,
    classificationReason: reason,
    structuredMatchKind: null,
    memberIds: [],
    reviewRequired: false,
    isExcluded: true,
    specialFlags: [],
  };
}

export class MusicChannelDiscoverySyncService {
  constructor(private readonly options: MusicChannelDiscoverySyncServiceOptions) {}

  async ingestVideoDetail(
    detail: YoutubeVideoDetail,
    options: { dryRun: boolean },
  ): Promise<MusicDiscoveryVideoProcessorResult> {
    const target = this.options.targets.find((candidate) =>
      candidate.channelId === detail.channelId && isTrustedTarget(candidate)
    );
    if (!target) return skippedUntrustedResult();
    return this.processVideo({
      videoId: detail.videoId,
      detail,
      target,
      dryRun: options.dryRun,
    });
  }

  private async processVideo(input: {
    videoId: string;
    detail: YoutubeVideoDetail;
    target: MusicChannelDiscoveryTarget;
    candidate?: YoutubeUploadCandidate;
    existing?: Record<string, unknown>;
    broadcastState?: SongBroadcastState;
    dryRun: boolean;
  }): Promise<MusicDiscoveryVideoProcessorResult> {
    const { videoId, detail, target, candidate, dryRun } = input;
    if (!isTrustedTarget(target) || (detail.channelId && detail.channelId !== target.channelId)) {
      return skippedUntrustedResult();
    }
    const title = detail.title ?? candidate?.title;
    if (!title) return skippedResult("missing_title");

    const structuredOriginal = matchMusicOriginalTitle(title, this.options.members);
    const structuredTrust = assessMusicOriginalTitleTrust(structuredOriginal, target);
    if (!structuredTrust.shouldPersist) return skippedUntrustedResult();

    const broadcastState = input.broadcastState ?? classifyYoutubeBroadcastState(detail);
    const songClassification = classifySongUpload({
      title,
      description: detail.description,
      tags: detail.tags,
      duration: detail.duration ?? candidate?.duration,
      privacyStatus: detail.privacyStatus ?? candidate?.privacyStatus,
      broadcastState,
      isOfficialMemberChannel: target.kind === "member",
    });
    const existing = input.existing ??
      record(await this.options.repository.getMusicItemByVideoId(videoId));
    const manualOverride = overrideRecord(await this.options.repository.getOverrideByVideoId(videoId));
    const preservedSourceType = existingSourceBackedType(existing);
    const keywordType = songClassification.reason !== "member_channel_playlist_compilation" &&
      (songClassification.type === "cover" || songClassification.type === "original")
      ? songClassification.type
      : null;
    const playlistCoverType = songClassification.reason === "member_channel_playlist_compilation"
      ? "cover"
      : null;
    const itemType = (manualOverride?.forcedType as MusicItemType | undefined)
      ?? preservedSourceType
      ?? structuredOriginal.classification?.type
      ?? keywordType
      ?? playlistCoverType
      ?? "unknown";
    if (itemType === "unknown" && structuredOriginal.status !== "partial") {
      return skippedResult(songClassification.reason);
    }

    const specialFlags = [
      ...structuredTrust.specialFlags,
      ...(songClassification.specialFlags ?? []),
    ];
    const classification = classifyVideo({
      sourceTypes: [itemType],
      title,
      description: detail.description,
      duration: detail.duration ?? candidate?.duration,
      privacyStatus: detail.privacyStatus ?? candidate?.privacyStatus,
      specialFlags,
    });
    const matched = matchMusicMembers({
      title,
      description: detail.description ?? "",
      channelId: detail.channelId ?? candidate?.channelId,
      channelTitle: detail.channelTitle,
      members: this.options.members,
      structuredOriginal,
    }).links;
    const automaticLinks = matched.length > 0
      ? matched
      : target.kind === "member" && target.memberId
        ? [{
            memberId: target.memberId,
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
    const unmatchedReview = links.length === 0;
    const trustReview = structuredTrust.needsReview;
    const forcedReview = trustReview || unmatchedReview;
    const isExcluded = manualOverride
      ? (manualOverride.forceExcluded ?? classification.isExcluded)
      : forcedReview
        ? true
        : classification.isExcluded;
    const exclusionReason = manualOverride
      ? (manualOverride.exclusionReason ?? classification.exclusionReason)
      : trustReview
        ? (classification.exclusionReason ?? structuredTrust.reason)
        : unmatchedReview
          ? "no_member_match"
          : classification.exclusionReason;
    const classificationStatus = manualOverride
      ? (isExcluded ? "MANUAL_EXCLUDED" : "MANUAL_CONFIRMED")
      : forcedReview
        ? "NEEDS_REVIEW"
        : classification.classificationStatus;
    const rawCategoryHint = structuredOriginal.status === "partial"
      ? "UNKNOWN"
      : typeof existing.sourcePlaylistId === "string" && typeof existing.rawCategoryHint === "string"
        ? existing.rawCategoryHint
        : itemType.toUpperCase();
    const premiere = classifyYoutubePremiere({
      musicType: itemType,
      liveBroadcastContent: detail.liveBroadcastContent,
      scheduledStartTime: detail.scheduledStartTime,
      actualStartTime: detail.actualStartTime,
      actualEndTime: detail.actualEndTime,
    });
    const persistenceAction = typeof existing.id === "string"
      ? (dryRun ? "would_update" : "updated")
      : (dryRun ? "would_insert" : "inserted");

    if (!dryRun) {
      const now = (this.options.now ?? (() => new Date()))();
      const saved = record(await this.options.repository.upsertMusicItem({
        youtubeVideoId: videoId,
        title,
        normalizedTitle: normalizeTitle(title),
        description: detail.description ?? null,
        type: itemType,
        sourcePlaylistId: typeof existing.sourcePlaylistId === "string" ? existing.sourcePlaylistId : null,
        publishedAt: detail.publishedAt ?? candidate?.publishedAt,
        thumbnailUrl: detail.thumbnailUrl ?? candidate?.thumbnailUrl ?? null,
        thumbnailWidth: detail.thumbnailWidth ?? candidate?.thumbnailWidth ?? null,
        thumbnailHeight: detail.thumbnailHeight ?? candidate?.thumbnailHeight ?? null,
        duration: detail.duration ?? candidate?.duration ?? null,
        durationSeconds: classification.durationSeconds,
        channelId: detail.channelId ?? candidate?.channelId ?? target.channelId,
        channelTitle: detail.channelTitle ?? candidate?.channelTitle ?? null,
        isPublic: classification.isAvailable,
        privacyStatus: detail.privacyStatus ?? candidate?.privacyStatus ?? null,
        embeddable: detail.embeddable ?? null,
        madeForKids: detail.madeForKids ?? null,
        dimension: detail.dimension ?? null,
        definition: detail.definition ?? null,
        caption: detail.caption ?? null,
        tags: detail.tags,
        isAvailable: classification.isAvailable,
        isExcluded,
        exclusionReason,
        classificationStatus,
        isInstrumental: classification.isInstrumental,
        specialFlags: classification.specialFlags,
        youtubePresentationType: premiere.presentationType,
        youtubePremiereState: premiere.state,
        youtubeScheduledStartAt: premiere.scheduledStartAt,
        youtubeActualStartAt: premiere.actualStartAt,
        youtubeActualEndAt: premiere.actualEndAt,
        youtubeMetadataFetchedAt: now,
        listingPriority: premiere.listingPriority,
        fetchedAt: now,
        lastSeenAt: now,
        rawCategoryHint,
      }));
      const musicItemId = typeof saved.id === "string"
        ? saved.id
        : typeof existing.id === "string"
          ? existing.id
          : videoId;
      await this.options.repository.replaceMusicItemMembers(musicItemId, links);
      if (target.kind === "member" && candidate) {
        await this.options.songIngestion?.ingestYoutubeUpload({
          ...candidate,
          title,
          description: detail.description,
          tags: detail.tags,
          channelId: detail.channelId ?? candidate.channelId,
          channelTitle: detail.channelTitle,
          publishedAt: detail.publishedAt ?? candidate.publishedAt,
          thumbnailUrl: detail.thumbnailUrl ?? candidate.thumbnailUrl,
          thumbnailWidth: detail.thumbnailWidth ?? candidate.thumbnailWidth,
          thumbnailHeight: detail.thumbnailHeight ?? candidate.thumbnailHeight,
          duration: detail.duration ?? candidate.duration,
          privacyStatus: detail.privacyStatus ?? candidate.privacyStatus,
          liveBroadcastContent: detail.liveBroadcastContent,
          scheduledStartTime: detail.scheduledStartTime,
          actualStartTime: detail.actualStartTime,
          actualEndTime: detail.actualEndTime,
        });
      }
    }

    const reviewRequired = classificationStatus === "NEEDS_REVIEW";
    return {
      action: reviewRequired
        ? "needs_review"
        : persistenceAction,
      persistenceAction,
      classificationType: itemType,
      classificationReason: structuredOriginal.status === "none"
        ? songClassification.reason
        : structuredTrust.reason,
      structuredMatchKind: structuredOriginal.status === "none" ? null : structuredOriginal.kind,
      memberIds: links.map((link) => link.memberId),
      reviewRequired,
      isExcluded,
      specialFlags: classification.specialFlags,
    };
  }

  async discover() {
    const release = await this.options.locks.acquire(
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
      const fetchedDetailsById = new Map(details.map((detail) => [detail.videoId, detail] as const));

      for (const [videoId, discovered] of candidates) {
        const detail = detailsById.get(videoId) ?? {
          videoId,
          channelId: discovered.candidate.channelId,
          title: discovered.candidate.title,
          tags: discovered.candidate.tags ?? [],
        };
        const fetchedDetail = fetchedDetailsById.get(videoId);
        const broadcastState = fetchedDetail
          ? classifyYoutubeBroadcastState(fetchedDetail)
          : existingById.has(videoId)
            ? broadcastStateFromExisting(existingById.get(videoId))
            : classifyYoutubeBroadcastState(discovered.candidate);
        const result = await this.processVideo({
          videoId,
          detail,
          target: discovered.target,
          candidate: discovered.candidate,
          existing: existingById.get(videoId),
          broadcastState,
          dryRun: false,
        });
        if (result.persistenceAction === "inserted") summary.inserted += 1;
        if (result.persistenceAction === "updated") summary.updated += 1;
        if (result.reviewRequired) summary.needsReview += 1;
        if (result.isExcluded) summary.excludedCandidates += 1;
      }
      return summary;
    } finally {
      await release();
    }
  }
}

export default MusicChannelDiscoverySyncService;
