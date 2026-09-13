import type { MusicItemType, MusicMemberRole } from "../../../../shared/schemas/domain.js";
import { classifyVideo, normalizeTitle } from "./musicClassifier.js";
import type { MusicSyncLock } from "./musicLocks.js";
import { matchMusicMembers, type MusicMemberAliasInput } from "./musicMemberMatcher.js";
import {
  assessMusicOriginalTitleTrust,
  matchMusicOriginalTitle,
} from "./musicOriginalTitleMatcher.js";
import {
  officialStelliveMusicSourcePlaylistSeeds,
  TARGET_MUSIC_MEMBER_IDS,
  type MusicSourcePlaylistSeed,
} from "./musicSourcePlaylists.js";
import type {
  MusicItemMemberInput,
  MusicItemUpsertInput,
  SourcePlaylistUpsertInput,
} from "../repositories/musicRepository.js";

type OfficialSyncMode = "full" | "light" | "manual";

export interface OfficialMusicPlaylistItem {
  playlistItemId?: string;
  videoId: string;
  title: string;
  publishedAt: string;
  position?: number;
  privacyStatus?: string;
}

export interface OfficialMusicVideoDetail {
  videoId: string;
  title?: string;
  description?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  duration?: string;
  dimension?: string;
  definition?: string;
  caption?: string;
  channelId?: string;
  channelTitle?: string;
  tags?: string[];
  privacyStatus?: string;
  embeddable?: boolean;
  madeForKids?: boolean;
}

interface OfficialSourcePlaylistRecord {
  id: string;
  youtubePlaylistId: string;
  title: string;
  type: "cover" | "original" | "other";
  rawCategoryHint: "COVER" | "SINGLE" | "EP" | "ORIGINAL" | "OTHERS";
  memberId?: string | null;
}

interface ManualOverrideRecord {
  forcedType?: string | null;
  forcedMemberIds?: string[] | null;
  forceExcluded?: boolean;
  exclusionReason?: string | null;
}

interface OfficialSyncRepository {
  upsertOfficialSourcePlaylists(seeds: SourcePlaylistUpsertInput[]): Promise<unknown[]>;
  upsertMusicItem(input: MusicItemUpsertInput): Promise<unknown>;
  upsertMusicItemSourcePlaylist(input: {
    musicItemId: string;
    sourcePlaylistId: string;
    youtubePlaylistItemId?: string | null;
    sourcePlaylistTitle?: string | null;
    sourcePlaylistPosition?: number | null;
    sourcePlaylistType: string;
    seenAt: Date;
  }): Promise<unknown>;
  replaceMusicItemMembers(musicItemId: string, links: MusicItemMemberInput[]): Promise<void>;
  getOverrideByVideoId(videoId: string): Promise<ManualOverrideRecord | null | unknown>;
}

interface OfficialYoutubePort {
  fetchPlaylistItems(
    playlistId: string,
    options?: { maxPages?: number },
  ): Promise<
    | { status: "ok"; items: OfficialMusicPlaylistItem[]; pagesFetched: number; quotaUnits: number }
    | { status: "quota_exceeded" | "error"; items: []; pagesFetched: number; quotaUnits: number }
  >;
  fetchVideos(videoIds: string[]): Promise<{
    status: "ok" | "quota_exceeded" | "error";
    items: OfficialMusicVideoDetail[];
  }>;
}

interface OfficialSyncRunsPort {
  startRun(input: { syncType: OfficialSyncMode; source: string; startedAt: Date }): Promise<{ id: string }>;
  finishRun(id: string, input: {
    finishedAt: Date;
    quotaUnits: number;
    fetchedCount: number;
    insertedCount: number;
    updatedCount: number;
    missingCount: number;
    metadata?: unknown;
  }): Promise<unknown>;
  failRun(id: string, input: { finishedAt: Date; errorMessage: string; quotaUnits: number }): Promise<unknown>;
}

export interface OfficialStelliveMusicSyncServiceOptions {
  repository: OfficialSyncRepository;
  youtube: OfficialYoutubePort;
  syncRuns: OfficialSyncRunsPort;
  locks: MusicSyncLock;
  members: MusicMemberAliasInput[];
  sourceSeeds?: MusicSourcePlaylistSeed[];
  now?: () => Date;
  lockTtlMs?: number;
  lightMaxPages?: number;
}

export class OfficialStelliveMusicSyncService {
  private readonly now: () => Date;
  private readonly lockTtlMs: number;
  private readonly lightMaxPages: number;
  private readonly sourceSeeds: MusicSourcePlaylistSeed[];
  private readonly members: MusicMemberAliasInput[];

  constructor(private readonly options: OfficialStelliveMusicSyncServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.lockTtlMs = options.lockTtlMs ?? 30_000;
    this.lightMaxPages = options.lightMaxPages ?? 2;
    this.sourceSeeds = options.sourceSeeds ?? officialStelliveMusicSourcePlaylistSeeds;
    const allowedMemberIds = new Set<string>(TARGET_MUSIC_MEMBER_IDS);
    this.members = options.members.filter((member) => allowedMemberIds.has(member.id));
  }

  async syncOfficialStelliveMusicPlaylists(mode: OfficialSyncMode = "manual") {
    const release = await this.options.locks.acquire("music-official-stellive", this.lockTtlMs);
    if (!release) return { status: "lock_not_acquired" };

    const run = await this.options.syncRuns.startRun({
      syncType: mode,
      source: "official-stellive-music",
      startedAt: this.now(),
    });

    let quotaUnits = 0;
    try {
      const sourceRows = await this.options.repository.upsertOfficialSourcePlaylists(this.sourceSeeds as SourcePlaylistUpsertInput[]);
      const sources = sourceRows.map((row, index) => normalizeSourceRow(row, this.sourceSeeds[index]));
      const playlistItems: Array<{ source: OfficialSourcePlaylistRecord; item: OfficialMusicPlaylistItem }> = [];

      for (const source of sources) {
        const result = await this.options.youtube.fetchPlaylistItems(
          source.youtubePlaylistId,
          mode === "light" ? { maxPages: this.lightMaxPages } : {},
        );
        quotaUnits += result.quotaUnits;
        if (result.status !== "ok") {
          await this.options.syncRuns.failRun(run.id, {
            finishedAt: this.now(),
            errorMessage: result.status,
            quotaUnits,
          });
          return { status: "failed", errorMessage: result.status, quotaUnits };
        }
        playlistItems.push(...result.items.map((item) => ({ source, item })));
      }

      const uniqueVideoIds = [...new Set(playlistItems.map(({ item }) => item.videoId))];
      const detailsResult = uniqueVideoIds.length > 0
        ? await this.options.youtube.fetchVideos(uniqueVideoIds)
        : { status: "ok" as const, items: [] as OfficialMusicVideoDetail[] };
      quotaUnits += Math.ceil(uniqueVideoIds.length / 50);
      // Missing details degrade to "unavailable/private" downstream, so an API failure
      // must fail the run instead of mass-hiding the official catalog.
      if (detailsResult.status !== "ok") {
        await this.options.syncRuns.failRun(run.id, {
          finishedAt: this.now(),
          errorMessage: detailsResult.status,
          quotaUnits,
        });
        return { status: "failed", errorMessage: detailsResult.status, quotaUnits };
      }
      const detailsByVideoId = new Map(detailsResult.items.map((detail) => [detail.videoId, detail]));

      let needsReview = 0;
      let excludedCandidates = 0;
      let unavailable = 0;

      for (const videoId of uniqueVideoIds) {
        const sourceItems = playlistItems.filter(({ item }) => item.videoId === videoId);
        const primary = sourceItems[0];
        const detail = detailsByVideoId.get(videoId);
        const title = detail?.title ?? primary.item.title;
        const structuredOriginal = matchMusicOriginalTitle(title, this.members);
        const structuredTrust = assessMusicOriginalTitleTrust(structuredOriginal, {
          kind: "stellive_official",
        });
        const structuredPartial = structuredOriginal.status === "partial";
        const sourceTypes = sourceItems.map(({ source }) => source.type as MusicItemType);
        const classification = classifyVideo({
          sourceTypes,
          title,
          description: detail?.description,
          duration: detail?.duration,
          privacyStatus: detail?.privacyStatus ?? primary.item.privacyStatus,
          specialFlags: structuredPartial
            ? structuredTrust.specialFlags
            : structuredOriginal.classification?.specialFlags,
        });
        const override = normalizeOverride(await this.options.repository.getOverrideByVideoId(videoId));
        const itemType = (override?.forcedType as MusicItemType | undefined) ?? classification.type;
        const isExcluded = override?.forceExcluded
          ?? (structuredPartial ? true : classification.isExcluded);
        const exclusionReason = override?.exclusionReason
          ?? (structuredPartial
            ? (classification.exclusionReason ?? structuredTrust.reason)
            : classification.exclusionReason);
        const classificationStatus = override
          ? (isExcluded ? "MANUAL_EXCLUDED" : "MANUAL_CONFIRMED")
          : structuredPartial
            ? "NEEDS_REVIEW"
            : classification.classificationStatus;

        if (classificationStatus === "NEEDS_REVIEW") needsReview += 1;
        if (isExcluded) excludedCandidates += 1;
        if (!classification.isAvailable) unavailable += 1;

        const saved = await this.options.repository.upsertMusicItem({
          youtubeVideoId: videoId,
          title,
          normalizedTitle: normalizeTitle(title),
          description: detail?.description ?? null,
          type: itemType,
          sourcePlaylistId: primary.source.id,
          publishedAt: detail?.publishedAt ?? primary.item.publishedAt,
          thumbnailUrl: detail?.thumbnailUrl ?? null,
          thumbnailWidth: detail?.thumbnailWidth ?? null,
          thumbnailHeight: detail?.thumbnailHeight ?? null,
          duration: detail?.duration ?? null,
          durationSeconds: classification.durationSeconds,
          channelId: detail?.channelId ?? null,
          channelTitle: detail?.channelTitle ?? null,
          isPublic: classification.isAvailable,
          privacyStatus: detail?.privacyStatus ?? primary.item.privacyStatus ?? null,
          embeddable: detail?.embeddable ?? null,
          madeForKids: detail?.madeForKids ?? null,
          dimension: detail?.dimension ?? null,
          definition: detail?.definition ?? null,
          caption: detail?.caption ?? null,
          tags: detail?.tags ?? [],
          isAvailable: classification.isAvailable,
          isExcluded,
          exclusionReason,
          classificationStatus,
          isInstrumental: classification.isInstrumental,
          specialFlags: classification.specialFlags,
          fetchedAt: this.now(),
          lastSeenAt: this.now(),
          playlistPosition: primary.item.position ?? null,
          rawCategoryHint: structuredPartial ? "UNKNOWN" : primary.source.rawCategoryHint,
        });
        const musicItemId = extractMusicItemId(saved);

        for (const { source, item } of sourceItems) {
          await this.options.repository.upsertMusicItemSourcePlaylist({
            musicItemId,
            sourcePlaylistId: source.id,
            youtubePlaylistItemId: item.playlistItemId ?? null,
            sourcePlaylistTitle: source.title,
            sourcePlaylistPosition: item.position ?? null,
            sourcePlaylistType: source.type,
            seenAt: this.now(),
          });
        }

        const links = override?.forcedMemberIds
          ? override.forcedMemberIds.map((memberId, index) => ({
            memberId,
            role: (index === 0 ? "main" : "collaboration") as MusicMemberRole,
            confidence: 1,
            source: "MANUAL",
          }))
          : matchMusicMembers({
            title,
            description: detail?.description ?? "",
            channelId: detail?.channelId,
            channelTitle: detail?.channelTitle,
            members: this.members,
            structuredOriginal,
          }).links;
        await this.options.repository.replaceMusicItemMembers(musicItemId, links);
      }

      const summary = {
        status: "ok",
        totalPlaylistItems: playlistItems.length,
        uniqueVideos: uniqueVideoIds.length,
        inserted: uniqueVideoIds.length,
        updated: 0,
        unavailable,
        needsReview,
        excludedCandidates,
        apiCallsEstimated: quotaUnits,
        quotaUnits,
      };
      await this.options.syncRuns.finishRun(run.id, {
        finishedAt: this.now(),
        quotaUnits,
        fetchedCount: playlistItems.length,
        insertedCount: summary.inserted,
        updatedCount: summary.updated,
        missingCount: unavailable,
        metadata: { uniqueVideos: uniqueVideoIds.length, excludedCandidates, needsReview },
      });
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : "official_music_sync_failed";
      await this.options.syncRuns.failRun(run.id, {
        finishedAt: this.now(),
        errorMessage: message,
        quotaUnits,
      });
      return { status: "failed", errorMessage: message, quotaUnits };
    } finally {
      await release();
    }
  }
}

function normalizeSourceRow(row: unknown, fallback: MusicSourcePlaylistSeed): OfficialSourcePlaylistRecord {
  const value = (typeof row === "object" && row !== null ? row : {}) as Partial<OfficialSourcePlaylistRecord>;
  return {
    id: value.id ?? fallback.youtubePlaylistId,
    youtubePlaylistId: value.youtubePlaylistId ?? fallback.youtubePlaylistId,
    title: value.title ?? fallback.title,
    type: value.type ?? fallback.type,
    rawCategoryHint: value.rawCategoryHint ?? fallback.rawCategoryHint,
    memberId: value.memberId ?? null,
  };
}

function normalizeOverride(value: unknown): ManualOverrideRecord | null {
  if (!value || typeof value !== "object") return null;
  return value as ManualOverrideRecord;
}

function extractMusicItemId(value: unknown): string {
  if (typeof value === "object" && value !== null && "id" in value && typeof value.id === "string") {
    return value.id;
  }
  throw new Error("music_item_upsert_missing_id");
}
