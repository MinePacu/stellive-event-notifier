import type { MusicItemType, MusicMemberRole } from "../../../../shared/schemas/domain.js";
import type { YoutubeUploadCandidate } from "../adapters/youtube/youtubeAtomParser.js";
import type {
  YoutubeListUploadsResult,
  YoutubeUploadsPlaylistResult,
  YoutubeVideoDetail,
} from "../adapters/youtube/youtubeDataApiClient.js";
import type { MusicItemMemberInput, MusicItemUpsertInput } from "../repositories/musicRepository.js";
import { classifySongUpload } from "../songs/songClassifier.js";
import { classifyVideo, normalizeTitle } from "./musicClassifier.js";
import type { MusicSyncLock } from "./musicLocks.js";
import { matchMusicMembers, type MusicMemberAliasInput } from "./musicMemberMatcher.js";

export interface MusicChannelDiscoveryTarget {
  memberId?: string;
  channelId: string;
}

interface DiscoveryYoutubePort {
  getUploadsPlaylistId(channelId: string): Promise<YoutubeUploadsPlaylistResult>;
  listUploads(input: {
    channelId: string;
    uploadsPlaylistId: string;
    maxPages: number;
  }): Promise<YoutubeListUploadsResult>;
  fetchVideos(videoIds: string[]): Promise<YoutubeVideoDetail[]>;
}

interface DiscoveryRepository {
  getMusicItemByVideoId(videoId: string): Promise<unknown>;
  getOverrideByVideoId(videoId: string): Promise<unknown>;
  upsertMusicItem(input: MusicItemUpsertInput): Promise<unknown>;
  replaceMusicItemMembers(musicItemId: string, links: MusicItemMemberInput[]): Promise<void>;
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
      const details = candidates.size > 0
        ? await this.options.youtube.fetchVideos([...candidates.keys()])
        : [];
      summary.apiCallsEstimated += Math.ceil(candidates.size / 50);
      const detailsById = new Map(details.map((detail) => [detail.videoId, detail]));

      for (const [videoId, discovered] of candidates) {
        const detail = detailsById.get(videoId);
        const songClassification = classifySongUpload({
          title: detail?.title ?? discovered.candidate.title,
          description: detail?.description,
          tags: detail?.tags,
        });
        if (songClassification.type !== "cover" && songClassification.type !== "original") continue;

        const existing = record(await this.options.repository.getMusicItemByVideoId(videoId));
        const manualOverride = overrideRecord(await this.options.repository.getOverrideByVideoId(videoId));
        const preservedSourceType = existingSourceBackedType(existing);
        const itemType = (manualOverride?.forcedType as MusicItemType | undefined) ?? preservedSourceType ?? songClassification.type;
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
          fetchedAt: (this.options.now ?? (() => new Date()))(),
          lastSeenAt: (this.options.now ?? (() => new Date()))(),
          rawCategoryHint,
        }));
        const musicItemId = typeof saved.id === "string" ? saved.id : typeof existing.id === "string" ? existing.id : videoId;
        await this.options.repository.replaceMusicItemMembers(musicItemId, links);
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
