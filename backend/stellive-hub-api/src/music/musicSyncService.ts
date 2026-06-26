import type { MusicItemType } from "../../../../shared/schemas/domain.js";
import { classifyMusicSource } from "./musicClassifier.js";
import type { MusicSyncLock } from "./musicLocks.js";
import { matchMusicMembers, type MusicMemberAliasInput } from "./musicMemberMatcher.js";

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
  fetchPlaylistItems(
    playlistId: string,
    options?: { maxPages?: number },
  ): Promise<
    | { status: "ok"; items: MusicPlaylistItemForSync[]; pagesFetched: number; quotaUnits: number }
    | { status: "quota_exceeded" | "error"; items: MusicPlaylistItemForSync[]; pagesFetched: number; quotaUnits: number }
  >;
  fetchVideos(videoIds: string[]): Promise<MusicVideoDetailForSync[]>;
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
  }): Promise<number>;
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
    const release = this.options.locks.acquire(`music-source:${source.id}`, this.lockTtlMs);
    if (!release) return emptyResult("lock_not_acquired");

    const run = await this.options.syncRuns.startRun({ syncType: mode, source: source.id, startedAt: this.now() });
    let quotaUnits = 0;
    try {
      const playlistResult = await this.options.youtube.fetchPlaylistItems(
        source.youtubePlaylistId,
        mode === "light" ? { maxPages: this.lightMaxPages } : {},
      );
      quotaUnits += playlistResult.quotaUnits;
      if (playlistResult.status !== "ok") {
        await this.options.syncRuns.failRun(run.id, {
          finishedAt: this.now(),
          errorMessage: playlistResult.status,
          quotaUnits,
        });
        return { ...emptyResult("failed"), quotaUnits };
      }

      const videoIds = playlistResult.items.map((item) => item.videoId);
      const details = videoIds.length > 0 ? await this.options.youtube.fetchVideos(videoIds) : [];
      const detailsById = new Map(details.map((detail) => [detail.videoId, detail]));
      const musicType = classifyMusicSource(source);
      let upserted = 0;

      for (const item of playlistResult.items) {
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
          isPublic: detail?.privacyStatus !== "private",
          lastSeenAt: this.now(),
          playlistPosition: item.position ?? null,
          rawCategoryHint: source.rawCategoryHint,
        });
        upserted += 1;
        const match = matchMusicMembers({
          sourceMemberId: source.memberId,
          title: detail?.title ?? item.title,
          description: detail?.description ?? "",
          members: this.options.members,
        });
        await this.options.repository.replaceMusicItemMembers(saved.id, match.links);
      }

      const missingCount = mode === "full"
        ? await this.options.repository.markMissingFromSource({
          sourcePlaylistId: source.id,
          seenYoutubeVideoIds: videoIds,
          missingCheckedAt: this.now(),
        })
        : 0;

      await this.options.syncRuns.finishRun(run.id, {
        finishedAt: this.now(),
        fetchedCount: playlistResult.items.length,
        insertedCount: upserted,
        updatedCount: 0,
        missingCount,
        quotaUnits,
      });
      return {
        status: "ok",
        fetchedCount: playlistResult.items.length,
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
      release();
    }
  }

  async syncAllMusic(mode: MusicSyncMode): Promise<{
    status: "ok" | "partial";
    sourceCount: number;
    failedCount: number;
    quotaUnits: number;
  }> {
    const sources = await this.options.repository.listActiveSourcePlaylists();
    let failedCount = 0;
    let quotaUnits = 0;
    for (const source of sources) {
      const result = await this.syncSourcePlaylist(source, mode);
      quotaUnits += result.quotaUnits;
      if (result.status !== "ok") failedCount += 1;
    }
    return {
      status: failedCount === 0 ? "ok" : "partial",
      sourceCount: sources.length,
      failedCount,
      quotaUnits,
    };
  }
}

function emptyResult(status: MusicSourceSyncResult["status"]): MusicSourceSyncResult {
  return { status, fetchedCount: 0, insertedOrUpdatedCount: 0, missingCount: 0, quotaUnits: 0 };
}
