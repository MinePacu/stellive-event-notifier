import type { MusicItemType } from "../../../../shared/schemas/domain.js";
import { classifyMusicSource } from "./musicClassifier.js";
import type { MusicSyncLock } from "./musicLocks.js";
import { matchMusicMembers, type MusicMemberAliasInput } from "./musicMemberMatcher.js";
import { matchMusicOriginalTitle } from "./musicOriginalTitleMatcher.js";

export type MusicSyncMode = "light" | "full";

export interface MusicSyncSourcePlaylist {
  id: string;
  youtubePlaylistId: string;
  title: string;
  type: "cover" | "original" | "other";
  rawCategoryHint: "COVER" | "SINGLE" | "EP" | "OTHERS";
  memberId?: string | null;
}

export interface MusicPlaylistItemForSync {
  videoId: string;
  title: string;
  publishedAt: string;
  position?: number;
}

export interface MusicVideoDetailForSync {
  videoId: string;
  title?: string;
  description?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  duration?: string;
  channelId?: string;
  channelTitle?: string;
  privacyStatus?: string;
}

export interface MusicYoutubeSyncPort {
  fetchPlaylistItemsPage?(input: {
    playlistId: string;
    pageToken?: string;
  }): Promise<
    | { status: "ok"; items: MusicPlaylistItemForSync[]; nextPageToken?: string; pagesFetched: number; quotaUnits: number }
    | { status: "quota_exceeded" | "error"; items: MusicPlaylistItemForSync[]; nextPageToken?: undefined; pagesFetched: number; quotaUnits: number }
  >;
  fetchPlaylistItems(
    playlistId: string,
    options?: { maxPages?: number },
  ): Promise<
    | { status: "ok"; items: MusicPlaylistItemForSync[]; pagesFetched: number; quotaUnits: number }
    | { status: "quota_exceeded" | "error"; items: MusicPlaylistItemForSync[]; pagesFetched: number; quotaUnits: number }
  >;
  fetchVideos(videoIds: string[]): Promise<{
    status: "ok" | "quota_exceeded" | "error";
    items: MusicVideoDetailForSync[];
  }>;
}

export interface MusicSyncRepositoryPort {
  listActiveSourcePlaylists(): Promise<MusicSyncSourcePlaylist[]>;
  upsertMusicItem(input: {
    youtubeVideoId: string;
    title: string;
    description?: string | null;
    type: MusicItemType;
    sourcePlaylistId: string;
    publishedAt?: string | null;
    thumbnailUrl?: string | null;
    thumbnailWidth?: number | null;
    thumbnailHeight?: number | null;
    duration?: string | null;
    channelId?: string | null;
    channelTitle?: string | null;
    isPublic: boolean;
    lastSeenAt: Date;
    playlistPosition?: number | null;
    rawCategoryHint?: string | null;
  }): Promise<{ id: string }>;
  replaceMusicItemMembers(musicItemId: string, links: { memberId: string; role: string }[]): Promise<void>;
  markMissingFromSource(input: {
    sourcePlaylistId: string;
    seenYoutubeVideoIds: string[];
    missingCheckedAt: Date;
  }): Promise<number | { missingCount: number }>;
  markMissingFromSourceByLastSeen?(input: {
    sourcePlaylistId: string;
    seenAtOrAfter: Date;
    missingCheckedAt: Date;
  }): Promise<number | { missingCount: number }>;
}

export interface MusicSyncRunPort {
  startRun(input: { syncType: MusicSyncMode; source: string; startedAt: Date }): Promise<{ id: string }>;
  finishRun(id: string, input: {
    finishedAt: Date;
    fetchedCount: number;
    insertedCount: number;
    updatedCount: number;
    missingCount: number;
    quotaUnits: number;
  }): Promise<unknown>;
  failRun(id: string, input: { finishedAt: Date; errorMessage: string; quotaUnits: number }): Promise<unknown>;
}

export interface MusicSyncServiceOptions {
  repository: MusicSyncRepositoryPort;
  syncRuns: MusicSyncRunPort;
  youtube: MusicYoutubeSyncPort;
  locks: MusicSyncLock;
  members: MusicMemberAliasInput[];
  now?: () => Date;
  lightMaxPages?: number;
  lockTtlMs?: number;
}

export interface MusicSourceSyncResult {
  status: "ok" | "failed" | "lock_not_acquired";
  fetchedCount: number;
  insertedOrUpdatedCount: number;
  missingCount: number;
  quotaUnits: number;
}

export class MusicSyncService {
  private readonly now: () => Date;
  private readonly lightMaxPages: number;
  private readonly lockTtlMs: number;

  constructor(private readonly options: MusicSyncServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.lightMaxPages = options.lightMaxPages ?? 2;
    this.lockTtlMs = options.lockTtlMs ?? 30_000;
  }

  async syncSourcePlaylist(source: MusicSyncSourcePlaylist, mode: MusicSyncMode): Promise<MusicSourceSyncResult> {
    const release = await this.options.locks.acquire(`music-source:${source.id}`, this.lockTtlMs);
    if (!release) return emptyResult("lock_not_acquired");

    const syncStartedAt = this.now();
    const run = await this.options.syncRuns.startRun({ syncType: mode, source: source.id, startedAt: syncStartedAt });
    let quotaUnits = 0;
    let fetchedCount = 0;
    let upserted = 0;
    const seenYoutubeVideoIds = mode === "full" && !this.options.repository.markMissingFromSourceByLastSeen
      ? [] as string[]
      : undefined;
    try {
      const processPage = async (items: MusicPlaylistItemForSync[]): Promise<"quota_exceeded" | "error" | null> => {
        const videoIds = items.map((item) => item.videoId);
        if (seenYoutubeVideoIds) seenYoutubeVideoIds.push(...videoIds);
        // A videos.list failure must not be mistaken for "these videos are private":
        // `isPublic` below defaults to false when a detail is missing, so a transient
        // 403/5xx would silently hide the whole page. Fail the sync instead.
        const detailsResult = videoIds.length > 0
          ? await this.options.youtube.fetchVideos(videoIds)
          : { status: "ok" as const, items: [] as MusicVideoDetailForSync[] };
        if (detailsResult.status !== "ok") return detailsResult.status;
        const detailsById = new Map(detailsResult.items.map((detail) => [detail.videoId, detail]));
        const musicType = classifyMusicSource(source);

        for (const item of items) {
          const detail = detailsById.get(item.videoId);
          const saved = await this.options.repository.upsertMusicItem({
            youtubeVideoId: item.videoId,
            title: detail?.title ?? item.title,
            description: detail?.description ?? null,
            type: musicType,
            sourcePlaylistId: source.id,
            publishedAt: detail?.publishedAt ?? item.publishedAt,
            thumbnailUrl: detail?.thumbnailUrl ?? null,
            thumbnailWidth: detail?.thumbnailWidth ?? null,
            thumbnailHeight: detail?.thumbnailHeight ?? null,
            duration: detail?.duration ?? null,
            channelId: detail?.channelId ?? null,
            channelTitle: detail?.channelTitle ?? null,
            isPublic: detail ? detail.privacyStatus !== "private" : false,
            lastSeenAt: syncStartedAt,
            playlistPosition: item.position ?? null,
            rawCategoryHint: source.rawCategoryHint,
          });
          upserted += 1;
          const structuredOriginal = matchMusicOriginalTitle(detail?.title ?? item.title, this.options.members);
          const match = matchMusicMembers({
            sourceMemberId: source.memberId,
            title: detail?.title ?? item.title,
            description: detail?.description ?? "",
            channelId: detail?.channelId,
            channelTitle: detail?.channelTitle,
            members: this.options.members,
            structuredOriginal,
          });
          await this.options.repository.replaceMusicItemMembers(saved.id, match.links);
        }
        fetchedCount += items.length;
        return null;
      };

      const failForPlaylistStatus = async (status: "quota_exceeded" | "error") => {
        await this.options.syncRuns.failRun(run.id, {
          finishedAt: this.now(),
          errorMessage: status,
          quotaUnits,
        });
        return {
          status: "failed" as const,
          fetchedCount,
          insertedOrUpdatedCount: upserted,
          missingCount: 0,
          quotaUnits,
        };
      };

      if (this.options.youtube.fetchPlaylistItemsPage) {
        let pageToken: string | undefined;
        let pagesFetched = 0;
        do {
          const page = await this.options.youtube.fetchPlaylistItemsPage({
            playlistId: source.youtubePlaylistId,
            pageToken,
          });
          quotaUnits += page.quotaUnits;
          if (page.status !== "ok") return failForPlaylistStatus(page.status);
          const pageFailure = await processPage(page.items);
          if (pageFailure) return failForPlaylistStatus(pageFailure);
          pagesFetched += page.pagesFetched;
          pageToken = page.nextPageToken;
          if (mode === "light" && pagesFetched >= this.lightMaxPages) break;
        } while (pageToken);
      } else {
        const playlistResult = await this.options.youtube.fetchPlaylistItems(
          source.youtubePlaylistId,
          mode === "light" ? { maxPages: this.lightMaxPages } : {},
        );
        quotaUnits += playlistResult.quotaUnits;
        if (playlistResult.status !== "ok") return failForPlaylistStatus(playlistResult.status);
        const pageFailure = await processPage(playlistResult.items);
        if (pageFailure) return failForPlaylistStatus(pageFailure);
      }

      let missingCount = 0;
      // Guard: only reconcile "missing" items when the full sync actually observed
      // at least one item. A successful-but-empty fetch (transient YouTube glitch or a
      // momentarily empty playlist response) would otherwise mark the entire source as
      // missing/private — both the byLastSeen (lastSeenAt < syncStartedAt) and the
      // notIn(seen) reconciliation paths match every row when nothing was seen.
      if (mode === "full" && fetchedCount > 0) {
        const missingResult = this.options.repository.markMissingFromSourceByLastSeen
          ? await this.options.repository.markMissingFromSourceByLastSeen({
            sourcePlaylistId: source.id,
            seenAtOrAfter: syncStartedAt,
            missingCheckedAt: this.now(),
          })
          : await this.options.repository.markMissingFromSource({
            sourcePlaylistId: source.id,
            seenYoutubeVideoIds: seenYoutubeVideoIds ?? [],
            missingCheckedAt: this.now(),
          });
        missingCount = normalizeMissingCount(missingResult);
      }

      await this.options.syncRuns.finishRun(run.id, {
        finishedAt: this.now(),
        fetchedCount,
        insertedCount: upserted,
        updatedCount: 0,
        missingCount,
        quotaUnits,
      });
      return {
        status: "ok",
        fetchedCount,
        insertedOrUpdatedCount: upserted,
        missingCount,
        quotaUnits,
      };
    } catch (error) {
      await this.options.syncRuns.failRun(run.id, {
        finishedAt: this.now(),
        errorMessage: error instanceof Error ? error.message : "unknown_error",
        quotaUnits,
      });
      return { ...emptyResult("failed"), quotaUnits };
    } finally {
      await release();
    }
  }

  async syncAllMusic(mode: MusicSyncMode): Promise<{
    status: "ok" | "partial";
    sourceCount: number;
    failedCount: number;
    insertedOrUpdatedCount: number;
    missingCount: number;
    quotaUnits: number;
  }> {
    const sources = await this.options.repository.listActiveSourcePlaylists();
    let failedCount = 0;
    let insertedOrUpdatedCount = 0;
    let missingCount = 0;
    let quotaUnits = 0;
    for (const source of sources) {
      const result = await this.syncSourcePlaylist(source, mode);
      insertedOrUpdatedCount += result.insertedOrUpdatedCount;
      missingCount += result.missingCount;
      quotaUnits += result.quotaUnits;
      if (result.status !== "ok") failedCount += 1;
    }
    return {
      status: failedCount === 0 ? "ok" : "partial",
      sourceCount: sources.length,
      failedCount,
      insertedOrUpdatedCount,
      missingCount,
      quotaUnits,
    };
  }
}

function normalizeMissingCount(result: number | { missingCount: number }): number {
  return typeof result === "number" ? result : result.missingCount;
}

function emptyResult(status: MusicSourceSyncResult["status"]): MusicSourceSyncResult {
  return { status, fetchedCount: 0, insertedOrUpdatedCount: 0, missingCount: 0, quotaUnits: 0 };
}
