import { describe, expect, it, vi } from "vitest";

import { InMemoryMusicSyncLock } from "../src/music/musicLocks.js";
import { MusicSyncService, type MusicSyncSourcePlaylist } from "../src/music/musicSyncService.js";

const source: MusicSyncSourcePlaylist = {
  id: "source-1",
  youtubePlaylistId: "PLcover",
  title: "COVER",
  type: "cover",
  rawCategoryHint: "COVER",
  memberId: "ayatsuno-yuni",
};

const members = [
  { id: "ayatsuno-yuni", aliases: ["유니", "Yuni"] },
  { id: "shirayuki-hina", aliases: ["히나", "Hina"] },
];

function createService(overrides: Partial<ConstructorParameters<typeof MusicSyncService>[0]> = {}) {
  const repository = {
    listActiveSourcePlaylists: vi.fn(async () => [source]),
    upsertMusicItem: vi.fn(async () => ({ id: "music-1" })),
    replaceMusicItemMembers: vi.fn(async () => undefined),
    markMissingFromSource: vi.fn(async () => 0),
    markMissingFromSourceByLastSeen: vi.fn(async () => ({ missingCount: 0 })),
  };
  const syncRuns = {
    startRun: vi.fn(async () => ({ id: "run-1" })),
    finishRun: vi.fn(async () => undefined),
    failRun: vi.fn(async () => undefined),
  };
  const youtube = {
    fetchPlaylistItemsPage: vi.fn(async () => ({
      status: "ok" as const,
      items: [{ videoId: "video-1", title: "유니 cover", publishedAt: "2026-06-21T12:00:00.000Z", position: 0 }],
      nextPageToken: undefined as string | undefined,
      pagesFetched: 1,
      quotaUnits: 1,
    })),
    fetchPlaylistItems: vi.fn(async () => ({
      status: "ok" as const,
      items: [{ videoId: "video-1", title: "유니 cover", publishedAt: "2026-06-21T12:00:00.000Z", position: 0 }],
      pagesFetched: 1,
      quotaUnits: 1,
    })),
    fetchVideos: vi.fn(async (_videoIds: string[]) => [{
      videoId: "video-1",
      title: "유니 x 히나 cover",
      description: "with Hina",
      publishedAt: "2026-06-21T12:00:00.000Z",
      thumbnailUrl: "https://i.ytimg.com/vi/video-1/hqdefault.jpg",
      duration: "PT3M21S",
      channelId: "UC1",
      channelTitle: "Stellive",
      privacyStatus: "public",
    }]),
  };
  const locks = new InMemoryMusicSyncLock();
  const service = new MusicSyncService({
    repository,
    syncRuns,
    youtube,
    locks,
    members,
    now: () => new Date("2026-06-22T00:00:00.000Z"),
    lightMaxPages: 2,
    ...overrides,
  });
  return { service, repository, syncRuns, youtube, locks };
}

describe("MusicSyncService", () => {
  it("light sync fetches recent pages with page API, upserts items, and links members", async () => {
    const { service, repository, syncRuns, youtube } = createService();
    youtube.fetchPlaylistItemsPage
      .mockResolvedValueOnce({
        status: "ok",
        items: [{ videoId: "video-1", title: "유니 cover", publishedAt: "2026-06-21T12:00:00.000Z", position: 0 }],
        nextPageToken: "page-2",
        pagesFetched: 1,
        quotaUnits: 1,
      })
      .mockResolvedValueOnce({ status: "ok", items: [], nextPageToken: undefined, pagesFetched: 1, quotaUnits: 1 });

    await expect(service.syncSourcePlaylist(source, "light")).resolves.toMatchObject({
      status: "ok",
      fetchedCount: 1,
      insertedOrUpdatedCount: 1,
      quotaUnits: 2,
    });

    expect(youtube.fetchPlaylistItemsPage).toHaveBeenCalledTimes(2);
    expect(youtube.fetchPlaylistItemsPage).toHaveBeenNthCalledWith(1, {
      playlistId: "PLcover",
      pageToken: undefined,
    });
    expect(youtube.fetchPlaylistItemsPage).toHaveBeenNthCalledWith(2, {
      playlistId: "PLcover",
      pageToken: "page-2",
    });
    expect(youtube.fetchPlaylistItems).not.toHaveBeenCalled();
    expect(repository.upsertMusicItem).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "video-1",
      type: "cover",
      sourcePlaylistId: "source-1",
      isPublic: true,
      playlistPosition: 0,
    }));
    expect(repository.replaceMusicItemMembers).toHaveBeenCalledWith("music-1", [
      { memberId: "ayatsuno-yuni", role: "main", confidence: 0.9, source: "TITLE" },
      { memberId: "shirayuki-hina", role: "collaboration", confidence: 0.8, source: "TITLE" },
    ]);
    expect(syncRuns.finishRun).toHaveBeenCalledWith("run-1", expect.objectContaining({ fetchedCount: 1 }));
  });

  it("full sync processes multiple pages without accumulating all seen video ids", async () => {
    const { service, repository, youtube } = createService();
    repository.markMissingFromSourceByLastSeen.mockResolvedValueOnce({ missingCount: 2 });
    youtube.fetchPlaylistItemsPage
      .mockResolvedValueOnce({
        status: "ok",
        items: [{ videoId: "video-1", title: "one", publishedAt: "2026-06-21T12:00:00.000Z", position: 0 }],
        nextPageToken: "page-2",
        pagesFetched: 1,
        quotaUnits: 1,
      })
      .mockResolvedValueOnce({
        status: "ok",
        items: [{ videoId: "video-2", title: "two", publishedAt: "2026-06-20T12:00:00.000Z", position: 1 }],
        nextPageToken: undefined,
        pagesFetched: 1,
        quotaUnits: 1,
      });
    await expect(service.syncSourcePlaylist(source, "full")).resolves.toMatchObject({
      fetchedCount: 2,
      insertedOrUpdatedCount: 2,
      missingCount: 2,
      quotaUnits: 2,
    });

    expect(youtube.fetchVideos).toHaveBeenNthCalledWith(1, ["video-1"]);
    expect(youtube.fetchVideos).toHaveBeenNthCalledWith(2, ["video-2"]);
    expect(repository.markMissingFromSourceByLastSeen).toHaveBeenCalledWith({
      sourcePlaylistId: "source-1",
      seenAtOrAfter: new Date("2026-06-22T00:00:00.000Z"),
      missingCheckedAt: new Date("2026-06-22T00:00:00.000Z"),
    });
    expect(repository.markMissingFromSource).not.toHaveBeenCalled();
  });

  it("records quota failures from playlist page API and does not fetch videos", async () => {
    const youtube = {
      fetchPlaylistItemsPage: vi.fn(async () => ({ status: "quota_exceeded" as const, items: [], pagesFetched: 0, quotaUnits: 1 })),
      fetchPlaylistItems: vi.fn(async () => ({ status: "quota_exceeded" as const, items: [], pagesFetched: 0, quotaUnits: 1 })),
      fetchVideos: vi.fn(async () => []),
    };
    const { service, syncRuns } = createService({ youtube });

    await expect(service.syncSourcePlaylist(source, "light")).resolves.toMatchObject({ status: "failed", quotaUnits: 1 });

    expect(youtube.fetchPlaylistItemsPage).toHaveBeenCalledTimes(1);
    expect(youtube.fetchPlaylistItems).not.toHaveBeenCalled();
    expect(youtube.fetchVideos).not.toHaveBeenCalled();
    expect(syncRuns.failRun).toHaveBeenCalledWith("run-1", expect.objectContaining({ errorMessage: "quota_exceeded" }));
  });

  it("does not run duplicate syncs for the same source concurrently", async () => {
    const locks = new InMemoryMusicSyncLock();
    const release = locks.acquire("music-source:source-1", 30_000);
    const { service, youtube } = createService({ locks });

    await expect(service.syncSourcePlaylist(source, "light")).resolves.toEqual({
      status: "lock_not_acquired",
      fetchedCount: 0,
      insertedOrUpdatedCount: 0,
      missingCount: 0,
      quotaUnits: 0,
    });
    expect(youtube.fetchPlaylistItemsPage).not.toHaveBeenCalled();
    release?.();
  });

  it("waits for an asynchronous distributed lock and release", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const locks = { acquire: vi.fn().mockResolvedValue(release) };
    const { service, youtube } = createService({ locks });

    await expect(service.syncSourcePlaylist(source, "light")).resolves.toMatchObject({ status: "ok" });

    expect(youtube.fetchPlaylistItemsPage).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("continues syncing remaining sources when one source fails", async () => {
    const source2 = { ...source, id: "source-2", youtubePlaylistId: "PLoriginal", type: "original" as const };
    const { service, repository, youtube } = createService();
    repository.listActiveSourcePlaylists.mockResolvedValueOnce([source, source2]);
    youtube.fetchPlaylistItemsPage
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ status: "ok", items: [], nextPageToken: undefined, pagesFetched: 1, quotaUnits: 1 });

    await expect(service.syncAllMusic("light")).resolves.toMatchObject({
      status: "partial",
      sourceCount: 2,
      failedCount: 1,
    });
  });

  it("falls back to legacy fetchPlaylistItems when page API is unavailable", async () => {
    const youtube = {
      fetchPlaylistItems: vi.fn(async () => ({
        status: "ok" as const,
        items: [{ videoId: "legacy-video", title: "legacy", publishedAt: "2026-06-21T12:00:00.000Z" }],
        pagesFetched: 1,
        quotaUnits: 1,
      })),
      fetchVideos: vi.fn(async () => []),
    };
    const { service } = createService({ youtube });

    await expect(service.syncSourcePlaylist(source, "light")).resolves.toMatchObject({
      status: "ok",
      fetchedCount: 1,
    });
    expect(youtube.fetchPlaylistItems).toHaveBeenCalledWith("PLcover", { maxPages: 2 });
  });
});
