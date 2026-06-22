import { describe, expect, it, vi } from "vitest";
import {
  PrismaMusicRepository,
  PrismaMusicSyncRunRepository,
} from "../src/repositories/musicRepository.js";

describe("PrismaMusicRepository", () => {
  it("upserts music members, source playlists, music items, and member links", async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const prisma = {
      musicMember: {
        upsert: vi.fn(async (args: unknown) => {
          calls.push({ name: "musicMember.upsert", args });
          return args;
        }),
      },
      sourcePlaylist: {
        upsert: vi.fn(async (args: unknown) => {
          calls.push({ name: "sourcePlaylist.upsert", args });
          return { id: "source-1", youtubePlaylistId: "PL_COVER" };
        }),
      },
      musicItem: {
        upsert: vi.fn(async (args: unknown) => {
          calls.push({ name: "musicItem.upsert", args });
          return { id: "music-1", youtubeVideoId: "video-1" };
        }),
      },
      musicItemMember: {
        deleteMany: vi.fn(async (args: unknown) => {
          calls.push({ name: "musicItemMember.deleteMany", args });
          return { count: 0 };
        }),
        createMany: vi.fn(async (args: unknown) => {
          calls.push({ name: "musicItemMember.createMany", args });
          return { count: 2 };
        }),
      },
    };

    const repository = new PrismaMusicRepository(prisma);
    await repository.upsertMember({
      id: "akane-lize",
      nameKo: "아카네 리제",
      nameEn: "Akane Lize",
      aliases: ["리제", "Lize"],
      youtubeChannelId: "UC123",
    });
    await repository.upsertSourcePlaylist({
      youtubePlaylistId: "PL_COVER",
      title: "COVER",
      type: "cover",
      rawCategoryHint: "COVER",
      memberId: null,
      isActive: true,
    });
    await repository.upsertMusicItem({
      youtubeVideoId: "video-1",
      title: "Starlight",
      description: "desc",
      type: "original",
      sourcePlaylistId: "source-1",
      publishedAt: "2026-06-22T00:00:00.000Z",
      thumbnailUrl: "https://i.ytimg.com/vi/video-1/maxresdefault.jpg",
      thumbnailWidth: 1280,
      thumbnailHeight: 720,
      duration: "PT3M21S",
      channelId: "UC123",
      channelTitle: "Akane Lize",
      isPublic: true,
      lastSeenAt: new Date("2026-06-22T00:00:00.000Z"),
      playlistPosition: 1,
      rawCategoryHint: "SINGLE",
    });
    await repository.replaceMusicItemMembers("music-1", [
      { memberId: "akane-lize", role: "main" },
      { memberId: "ayatsuno-yuni", role: "collaboration" },
    ]);

    expect(prisma.musicMember.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "akane-lize" },
    }));
    expect(prisma.sourcePlaylist.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { youtubePlaylistId: "PL_COVER" },
    }));
    expect(prisma.musicItem.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { youtubeVideoId: "video-1" },
    }));
    expect(prisma.musicItemMember.deleteMany).toHaveBeenCalledWith({ where: { musicItemId: "music-1" } });
    expect(prisma.musicItemMember.createMany).toHaveBeenCalledWith({
      data: [
        { musicItemId: "music-1", memberId: "akane-lize", role: "main" },
        { musicItemId: "music-1", memberId: "ayatsuno-yuni", role: "collaboration" },
      ],
      skipDuplicates: true,
    });
    expect(calls.map((call) => call.name)).toEqual([
      "musicMember.upsert",
      "sourcePlaylist.upsert",
      "musicItem.upsert",
      "musicItemMember.deleteMany",
      "musicItemMember.createMany",
    ]);
  });

  it("lists music items by type and member with cursor pagination", async () => {
    const prisma = {
      musicItem: {
        findMany: vi.fn(async () => [
          {
            id: "music-1",
            youtubeVideoId: "video-1",
            title: "Song",
            type: "cover",
            publishedAt: new Date("2026-06-22T00:00:00.000Z"),
            thumbnailUrl: null,
            duration: null,
            sourcePlaylistId: "source-1",
            members: [
              { memberId: "akane-lize", role: "main", member: { id: "akane-lize", nameKo: "아카네 리제", nameEn: "Akane Lize" } },
            ],
          },
          {
            id: "music-2",
            youtubeVideoId: "video-2",
            title: "Extra",
            type: "cover",
            publishedAt: new Date("2026-06-21T00:00:00.000Z"),
            thumbnailUrl: null,
            duration: null,
            sourcePlaylistId: "source-1",
            members: [],
          },
        ]),
      },
    };

    const repository = new PrismaMusicRepository(prisma);
    const result = await repository.listMusicItems({ type: "cover", memberId: "akane-lize", limit: 1 });

    expect(prisma.musicItem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        type: "cover",
        isPublic: true,
        members: { some: { memberId: "akane-lize" } },
      },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: 2,
    }));
    expect(result.items).toHaveLength(1);
    expect(result.items[0].members[0].role).toBe("main");
    expect(result.nextCursor).toBe("music-2");
  });

  it("marks missing source items conservatively without hard deleting", async () => {
    const prisma = {
      musicItem: {
        updateMany: vi.fn(async () => ({ count: 3 })),
      },
    };
    const repository = new PrismaMusicRepository(prisma);

    await expect(repository.markMissingFromSource({
      sourcePlaylistId: "source-1",
      seenYoutubeVideoIds: ["video-1"],
      missingCheckedAt: new Date("2026-06-22T00:00:00.000Z"),
    })).resolves.toEqual({ missingCount: 3 });

    expect(prisma.musicItem.updateMany).toHaveBeenCalledWith({
      where: {
        sourcePlaylistId: "source-1",
        youtubeVideoId: { notIn: ["video-1"] },
      },
      data: {
        missingCount: { increment: 1 },
      },
    });
  });

  it("lists active source playlists for sync wiring", async () => {
    const prisma = {
      sourcePlaylist: {
        upsert: vi.fn(),
        findMany: vi.fn(async () => [{
          id: "source-1",
          youtubePlaylistId: "PL_COVER",
          title: "COVER",
          type: "cover" as const,
          rawCategoryHint: "COVER" as const,
          memberId: "ayatsuno-yuni",
        }]),
      },
    };
    const repository = new PrismaMusicRepository(prisma);

    await expect(repository.listActiveSourcePlaylists()).resolves.toEqual([{
      id: "source-1",
      youtubePlaylistId: "PL_COVER",
      title: "COVER",
      type: "cover",
      rawCategoryHint: "COVER",
      memberId: "ayatsuno-yuni",
    }]);
    expect(prisma.sourcePlaylist.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { title: "asc" }],
    });
  });
});

describe("PrismaMusicSyncRunRepository", () => {
  it("creates, finishes, fails, and lists sync runs", async () => {
    const prisma = {
      musicSyncRun: {
        create: vi.fn(async () => ({ id: "run-1" })),
        update: vi.fn(async (args: unknown) => args),
        findMany: vi.fn(async () => [{ id: "run-1", status: "completed" }]),
      },
    };
    const repository = new PrismaMusicSyncRunRepository(prisma);

    await expect(repository.startRun({
      syncType: "light",
      source: "youtube",
      sourcePlaylistId: "source-1",
      startedAt: new Date("2026-06-22T00:00:00.000Z"),
    })).resolves.toEqual({ id: "run-1" });
    await repository.finishRun("run-1", {
      finishedAt: new Date("2026-06-22T00:01:00.000Z"),
      quotaUnits: 2,
      fetchedCount: 50,
      insertedCount: 1,
      updatedCount: 2,
      missingCount: 0,
      metadata: { pagesFetched: 1 },
    });
    await repository.failRun("run-1", {
      finishedAt: new Date("2026-06-22T00:01:00.000Z"),
      errorMessage: "youtube_forbidden",
      quotaUnits: 1,
    });
    await expect(repository.listRecent(10)).resolves.toEqual([{ id: "run-1", status: "completed" }]);

    expect(prisma.musicSyncRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "running" }),
    }));
    expect(prisma.musicSyncRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "completed" }),
    }));
    expect(prisma.musicSyncRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "failed", errorMessage: "youtube_forbidden" }),
    }));
    expect(prisma.musicSyncRun.findMany).toHaveBeenCalledWith({
      orderBy: [{ startedAt: "desc" }],
      take: 10,
    });
  });
});
